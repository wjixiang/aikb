#!/bin/bash

# Test script for Python PDF Splitting Worker integration
# This script will start the Python worker and run the integration test

echo "🚀 Starting Python PDF Splitting Worker Integration Test"
echo "=================================================="

# Load environment variables from .env file if it exists
if [ -f ".env" ]; then
    echo "📋 Loading environment variables from .env file..."
    export $(grep -v '^#' .env | xargs)
fi

# Check if required environment variables are set, use defaults matching TypeScript config
if [ -z "$RABBITMQ_HOSTNAME" ]; then
    echo "❌ RABBITMQ_HOSTNAME not set, using default: rabbitmq"
    export RABBITMQ_HOSTNAME=rabbitmq
fi

if [ -z "$RABBITMQ_USERNAME" ]; then
    echo "❌ RABBITMQ_USERNAME not set, using default: admin"
    export RABBITMQ_USERNAME=admin
fi

if [ -z "$RABBITMQ_PASSWORD" ]; then
    echo "❌ RABBITMQ_PASSWORD not set, using default: admin123"
    export RABBITMQ_PASSWORD=admin123
fi

if [ -z "$RABBITMQ_VHOST" ]; then
    echo "❌ RABBITMQ_VHOST not set, using default: my_vhost"
    export RABBITMQ_VHOST=my_vhost
fi

if [ -z "$PDF_OSS_BUCKET_NAME" ]; then
    echo "❌ PDF_OSS_BUCKET_NAME not set, using default: aikb-pdf"
    export PDF_OSS_BUCKET_NAME=aikb-pdf
fi

echo "📋 Configuration:"
echo "  RabbitMQ Host: $RABBITMQ_HOSTNAME"
echo "  RabbitMQ User: $RABBITMQ_USERNAME"
echo "  S3 Bucket: $PDF_OSS_BUCKET_NAME"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🧹 Cleaning up..."
    
    # Kill the Python worker if it's running
    if [ ! -z "$PYTHON_WORKER_PID" ]; then
        echo "Stopping Python worker (PID: $PYTHON_WORKER_PID)"
        kill $PYTHON_WORKER_PID 2>/dev/null
        wait $PYTHON_WORKER_PID 2>/dev/null
    fi
    
    echo "✅ Cleanup completed"
}

# Set up trap to cleanup on script exit
trap cleanup EXIT INT TERM

# Start the Python PDF splitting worker in background
echo "🔧 Starting Python PDF Splitting Worker..."
cd /workspace
uv run python pdfProcess/start_pdf_splitting_worker.py &
PYTHON_WORKER_PID=$!

echo "Python worker started with PID: $PYTHON_WORKER_PID"

# Wait a bit for the worker to start up
echo "⏳ Waiting for worker to initialize..."
sleep 10

# Check if the worker is still running
if ! kill -0 $PYTHON_WORKER_PID 2>/dev/null; then
    echo "❌ Python worker failed to start"
    exit 1
fi

echo "✅ Python worker is running"

# Run the integration test
echo ""
echo "🧪 Running TypeScript integration test..."
echo "This will test the Python worker through RabbitMQ messages"
echo ""

# Run the test
npx vitest run knowledgeBase/knowledgeImport/__tests__/python-pdf-splitting-integration.test.ts --reporter=verbose

TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "🎉 Integration test passed!"
    echo "✅ Python PDF Splitting Worker is working correctly with the existing system"
else
    echo ""
    echo "❌ Integration test failed!"
    echo "Check the logs above for details"
fi

# Exit with the test exit code
exit $TEST_EXIT_CODE