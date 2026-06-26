#!/bin/bash

# SmartPick - Run locally without Docker
# Creates venv, installs Python + Node deps, then starts backend and frontend.

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
    echo ""
    echo "Shutting down..."
    if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

pick_python() {
    if command -v python3.13 >/dev/null 2>&1; then
        echo "python3.13"
    elif command -v python3 >/dev/null 2>&1; then
        echo "python3"
    else
        echo ""
    fi
}

echo "=== SmartPick local setup ==="
echo ""

# --- Prerequisites ---
PYTHON="$(pick_python)"
if [[ -z "$PYTHON" ]]; then
    echo "Error: Python 3.13+ is required (CrewAI needs Python < 3.14)."
    echo "       Install with: brew install python@3.13"
    exit 1
fi

if ! command -v node >/dev/null 2>&1; then
    echo "Error: Node.js is required for the frontend."
    echo "       Install with: brew install node"
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    echo "Error: npm is required for the frontend."
    exit 1
fi

echo "Python: $($PYTHON --version)"
echo "Node:   $(node --version)"
echo "npm:    $(npm --version)"
echo ""

if [[ ! -f "$DIR/.env" ]]; then
    echo "Warning: .env not found at $DIR/.env"
    echo "         Create it with your API keys (OPENROUTER_API_KEY, APIFY_API_KEY, etc.)"
    echo ""
fi

# --- Backend: venv + pip packages ---
if [[ ! -d "$DIR/backend/venv" ]]; then
    echo "Creating Python virtual environment..."
    "$PYTHON" -m venv "$DIR/backend/venv"
fi

# shellcheck source=/dev/null
source "$DIR/backend/venv/bin/activate"

echo "Installing/updating Python dependencies..."
pip install -q --upgrade pip
pip install -q -r "$DIR/backend/requirements.txt"
echo "Backend dependencies ready."
echo ""

# --- Frontend: node_modules ---
need_npm_install=false
if [[ ! -d "$DIR/frontend/node_modules" ]]; then
    need_npm_install=true
elif [[ "$DIR/frontend/package-lock.json" -nt "$DIR/frontend/node_modules" ]]; then
    echo "package-lock.json changed — refreshing frontend dependencies..."
    need_npm_install=true
fi

if [[ "$need_npm_install" == true ]]; then
    echo "Installing frontend dependencies..."
    (cd "$DIR/frontend" && npm ci 2>/dev/null || npm install)
fi
echo "Frontend dependencies ready."
echo ""

export PYTHONUNBUFFERED=1
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8000}"

echo "Starting SmartPick..."
echo ""

cd "$DIR/backend"
python main.py &
BACKEND_PID=$!

cd "$DIR/frontend"
npm run dev &
FRONTEND_PID=$!

sleep 2

echo "=================================="
echo "  SmartPick is running!"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo "=================================="
echo "  Press Ctrl+C to stop both services"
echo ""

wait
