#!/bin/bash
# BibMax Document Processing Service startup script

set -e

# Default values
HOST=${SERVER_HOST:-0.0.0.0}
PORT=${SERVER_PORT:-8001}
WORKERS=${SERVER_WORKERS:-1}
LOG_LEVEL=${SERVER_LOG_LEVEL:-INFO}
RELOAD=${SERVER_RELOAD:-false}

echo "Starting BibMax Document Processing Service..."
echo "Host: $HOST"
echo "Port: $PORT"
echo "Workers: $WORKERS"
echo "Log Level: $LOG_LEVEL"

# Check if .env exists
if [ ! -f .env ]; then
    echo "Warning: .env file not found. Using default configuration."
    echo "Copy .env.example to .env to customize settings."
fi

# Install dependencies if needed
if [ ! -d ".venv" ]; then
    echo "Installing dependencies..."
    uv sync
fi

# Start the service
if [ "$RELOAD" = "true" ]; then
    echo "Starting in development mode with auto-reload..."
    uv run uvicorn main:app --host $HOST --port $PORT --reload --log-level $LOG_LEVEL
else
    echo "Starting in production mode..."
    uv run uvicorn main:app --host $HOST --port $PORT --workers $WORKERS --log-level $LOG_LEVEL
fi
