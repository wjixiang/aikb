#!/bin/bash

# Stop Workers started with nohup
# This script stops workers that were started with start-workers-nohup.sh

set -e

echo "🛑 Stopping PDF Processing Workers..."

# Function to stop workers by PID file
stop_by_pid_file() {
    if [ -f ".worker-pids.txt" ]; then
        echo "Found PID file, stopping workers by PID..."
        
        while IFS= read -r pid; do
            if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
                echo "Stopping process $pid..."
                kill -TERM "$pid"
                
                # Wait for graceful shutdown
                sleep 2
                
                # Check if process is still running
                if kill -0 "$pid" 2>/dev/null; then
                    echo "Force killing process $pid..."
                    kill -KILL "$pid"
                fi
            fi
        done < ".worker-pids.txt"
        
        rm -f ".worker-pids.txt"
        echo "✅ Workers stopped by PID file"
    else
        echo "❌ PID file not found"
    fi
}

# Function to stop workers by process name
stop_by_process_name() {
    echo "Stopping workers by process name..."
    
    # Find all worker processes
    local workers=$(ps aux | grep -E "tsx.*worker" | grep -v grep | awk '{print $2}')
    
    if [ -z "$workers" ]; then
        echo "⚠️  No worker processes found"
        return 0
    fi
    
    for pid in $workers; do
        if kill -0 "$pid" 2>/dev/null; then
            echo "Stopping worker process $pid..."
            kill -TERM "$pid"
            
            # Wait for graceful shutdown
            sleep 2
            
            # Check if process is still running
            if kill -0 "$pid" 2>/dev/null; then
                echo "Force killing worker process $pid..."
                kill -KILL "$pid"
            fi
        fi
    done
    
    echo "✅ Workers stopped by process name"
}

# Stop workers
stop_by_pid_file
stop_by_process_name

# Ask about log files
echo ""
read -p "Remove log files? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -d "logs" ]; then
        rm -f logs/*-worker.log
        echo "✅ Log files removed"
    else
        echo "⚠️  No logs directory found"
    fi
fi

echo ""
echo "🎉 All workers stopped successfully!"