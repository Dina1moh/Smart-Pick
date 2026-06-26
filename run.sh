#!/bin/bash

# SmartPick - Run with Docker Compose

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

cleanup() {
    echo ""
    echo "Shutting down..."
    docker compose down
    exit 0
}

trap cleanup SIGINT SIGTERM

echo "Building and starting SmartPick..."
docker compose up --build -d

echo ""
echo "=================================="
echo "  SmartPick is running!"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo "=================================="
echo "  Press Ctrl+C to stop"
echo ""

docker compose logs -f
