#!/bin/bash

# Start Workers using nohup
# This script starts workers as background processes using nohup

set -e

echo "🚀 Starting PDF Processing Workers with nohup..."

# Create logs directory if it doesn't exist
mkdir -p logs

# Load environment variables
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Function to start a worker
start_worker() {
    local worker_name=$1
    local worker_script=$2
    local log_file=$3
    
    echo "Starting $worker_name..."
    
    # Check if worker is already running
    if pgrep -f "$worker_script" > /dev/null; then
        echo "⚠️  $worker_name is already running"
        return 0
    fi
    
    # Start worker with nohup
    nohup pnpm tsx "$worker_script" > "logs/$log_file" 2>&1 &
    local pid=$!
    
    echo "✅ $worker_name started (PID: $pid)"
    echo "$pid" >> ".worker-pids.txt"
    
    # Wait a moment to check if process is still running
    sleep 2
    if kill -0 $pid 2>/dev/null; then
        echo "✅ $worker_name is running successfully"
    else
        echo "❌ $worker_name failed to start"
        return 1
    fi
}

# Clear previous PID file
> .worker-pids.txt

# Start all workers
start_worker "PDF Analysis Worker" "knowledgeBase/lib/rabbitmq/pdf-analysis.worker.ts" "pdf-analysis-worker.log"
start_worker "PDF Processing Coordinator Worker" "knowledgeBase/lib/rabbitmq/pdf-processing-coordinator.worker.ts" "pdf-processing-coordinator-worker.log"
start_worker "PDF Conversion Worker" "knowledgeBase/lib/rabbitmq/pdf-conversion.worker.ts" "pdf-conversion-worker.log"
start_worker "Markdown Storage Worker" "knowledgeBase/lib/rabbitmq/markdown-storage.worker.ts" "markdown-storage-worker.log"

echo ""
echo "🎉 Worker startup completed!"
echo ""
echo "📋 Worker Information:"
echo "  • PDF Analysis Worker: logs/pdf-analysis-worker.log"
echo "  • PDF Processing Coordinator Worker: logs/pdf-processing-coordinator-worker.log"
echo "  • PDF Conversion Worker: logs/pdf-conversion-worker.log"
echo "  • PDF Markdown Storage Worker: logs/markdown-storage-worker.log"
echo ""
echo "💡 Management Commands:"
echo "  • Check status: pnpm check:workers"
echo "  • View logs: tail -f logs/[worker-name].log"
echo "  • Stop workers: ./stop-workers-nohup.sh"
echo "  • List running workers: ps aux | grep tsx | grep worker"
echo ""
echo "📁 PID file: .worker-pids.txt"
echo "📁 Log directory: logs/"