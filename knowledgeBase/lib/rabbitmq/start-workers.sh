#!/bin/bash

# Start all PDF processing workers
# This script starts all the necessary workers for PDF processing

set -e

echo "🚀 Starting all PDF processing workers..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found. Please create one based on .env.example"
    exit 1
fi

# Load environment variables
export $(cat .env | xargs)

# Function to check if a service is running
check_service() {
    local service_name=$1
    local host=$2
    local port=$3
    
    echo "🔍 Checking $service_name at $host:$port..."
    
    if command -v nc >/dev/null 2>&1; then
        if nc -z $host $port; then
            echo "✅ $service_name is running"
            return 0
        else
            echo "❌ $service_name is not running at $host:$port"
            return 1
        fi
    else
        echo "⚠️  netcat not available, skipping $service_name check"
        return 0
    fi
}

# Check required services
echo "📋 Checking required services..."

# Check RabbitMQ
RABBITMQ_HOST=${RABBITMQ_HOST:-localhost}
RABBITMQ_PORT=${RABBITMQ_PORT:-5672}
check_service "RabbitMQ" $RABBITMQ_HOST $RABBITMQ_PORT || {
    echo "💡 Please make sure RabbitMQ is running:"
    echo "   docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management"
    exit 1
}

# Check Elasticsearch
ELASTICSEARCH_HOST=${ELASTICSEARCH_URL:-http://localhost:9200}
ELASTICSEARCH_HOST_CLEAN=$(echo $ELASTICSEARCH_HOST | sed 's|https\?://||' | sed 's|:.*||')
ELASTICSEARCH_PORT=$(echo $ELASTICSEARCH_HOST | sed 's|.*:||')
check_service "Elasticsearch" $ELASTICSEARCH_HOST_CLEAN $ELASTICSEARCH_PORT || {
    echo "💡 Please make sure Elasticsearch is running:"
    echo "   docker run -d --name elasticsearch -p 9200:9200 -e \"discovery.type=single-node\" elasticsearch:8.8.0"
    exit 1
}

# Check MongoDB (if used)
if [ -n "$MONGODB_URL" ]; then
    MONGODB_HOST=$(echo $MONGODB_URL | sed 's|mongodb://||' | sed 's|:.*||')
    MONGODB_PORT=$(echo $MONGODB_URL | sed 's|.*:||' | sed 's|/.*||')
    check_service "MongoDB" $MONGODB_HOST $MONGODB_PORT || {
        echo "💡 Please make sure MongoDB is running:"
        echo "   docker run -d --name mongodb -p 27017:27017 mongo:6.0"
        exit 1
    }
fi

echo "✅ All required services are running!"

# Start the workers
echo "🏃 Starting workers..."

# Use tsx to run the TypeScript file directly
if command -v pnpm >/dev/null 2>&1; then
    echo "Using pnpm to run workers..."
    cd /workspace && pnpm tsx knowledgeBase/lib/rabbitmq/start-all-workers.ts
elif command -v npx >/dev/null 2>&1; then
    echo "Using npx to run workers..."
    npx tsx knowledgeBase/lib/rabbitmq/start-all-workers.ts
else
    echo "❌ Error: Neither pnpm nor npx found. Please install Node.js and pnpm/npx."
    exit 1
fi