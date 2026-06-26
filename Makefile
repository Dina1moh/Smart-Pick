.PHONY: run stop backend frontend install install-backend install-frontend build docker docker-stop clean cache-clear lint test test-cov help

# Default target
help:
	@echo "SmartPick - Available commands:"
	@echo ""
	@echo "  make run              Start with Docker (./run.sh)"
	@echo "  make run-local        Start both backend + frontend (no Docker)"
	@echo "  make stop             Stop all running services"
	@echo "  make backend          Start backend only"
	@echo "  make frontend         Start frontend only"
	@echo ""
	@echo "  make install          Install all dependencies"
	@echo "  make install-backend  Install Python dependencies"
	@echo "  make install-frontend Install Node dependencies"
	@echo ""
	@echo "  make test             Run all backend tests"
	@echo "  make test-cov         Run tests with coverage report"
	@echo ""
	@echo "  make docker           Build and run with Docker"
	@echo "  make docker-stop      Stop Docker containers"
	@echo "  make build            Build frontend for production"
	@echo ""
	@echo "  make cache-clear      Clear search result cache"
	@echo "  make clean            Remove caches, builds, node_modules"
	@echo ""

# Run both services with Docker
run:
	@./run.sh

# Run both services locally (no Docker)
run-local:
	@./run-local.sh

# Stop all services
stop:
	@lsof -ti:8000 | xargs kill -9 2>/dev/null || true
	@lsof -ti:3000 | xargs kill -9 2>/dev/null || true
	@echo "All services stopped"

# Backend only
backend:
	cd backend && source venv/bin/activate && PYTHONUNBUFFERED=1 python main.py

# Frontend only
frontend:
	cd frontend && npm run dev

# Install all
install: install-backend install-frontend

# Install backend dependencies
install-backend:
	cd backend && \
	/opt/homebrew/opt/python@3.13/bin/python3.13 -m venv venv && \
	source venv/bin/activate && \
	pip install -r requirements.txt

# Install frontend dependencies
install-frontend:
	cd frontend && npm install

# Build frontend for production
build:
	cd frontend && npm run build

# Docker
docker:
	docker compose up --build

docker-stop:
	docker compose down

# Clear search cache
cache-clear:
	rm -rf backend/.cache
	@echo "Cache cleared"

# Run backend tests
test:
	cd backend && source venv/bin/activate && python -m pytest tests/ -v

# Run tests with coverage
test-cov:
	cd backend && source venv/bin/activate && python -m pytest tests/ -v --cov=backend --cov-report=term-missing --cov-report=html

# Run specific test file
test-file:
	@if [ -z "$(FILE)" ]; then echo "Usage: make test-file FILE=test_search_tool.py"; exit 1; fi
	cd backend && source venv/bin/activate && python -m pytest tests/$(FILE) -v

# Clean everything
clean:
	rm -rf backend/.cache
	rm -rf backend/__pycache__
	rm -rf backend/agents/__pycache__
	rm -rf backend/tools/__pycache__
	rm -rf backend/tests/__pycache__
	rm -rf backend/.pytest_cache
	rm -rf backend/htmlcov
	rm -rf frontend/.next
	rm -rf frontend/node_modules
	@echo "Cleaned all build artifacts"
