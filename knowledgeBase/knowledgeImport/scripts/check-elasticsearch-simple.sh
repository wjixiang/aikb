#!/bin/bash

# Simple script to check and start Elasticsearch using curl and docker-compose
# This avoids Node.js compatibility issues with the Elasticsearch client

set -e

ELASTICSEARCH_URL=${ELASTICSEARCH_URL:-"http://elasticsearch:9200"}
ELASTICSEARCH_HOST=$(echo "$ELASTICSEARCH_URL" | sed 's|^https\?://||' | sed 's|:.*||')
ELASTICSEARCH_PORT=$(echo "$ELASTICSEARCH_URL" | sed 's|^https\?://[^:]*:||' | sed 's|/.*||')

echo "=== Elasticsearch Check and Start Script ==="
echo "Checking Elasticsearch at: $ELASTICSEARCH_URL"
echo ""

# Function to check if Elasticsearch is available
check_elasticsearch() {
    echo "Checking Elasticsearch availability..."
    
    if curl -s --connect-timeout 5 "$ELASTICSEARCH_URL" > /dev/null 2>&1; then
        echo "✅ Elasticsearch is available at $ELASTICSEARCH_URL"
        return 0
    else
        echo "❌ Elasticsearch is not available at $ELASTICSEARCH_URL"
        return 1
    fi
}

# Function to start Elasticsearch
start_elasticsearch() {
    echo ""
    echo "Attempting to start Elasticsearch..."
    
    ELASTIC_START_DIR="$(dirname "$0")/../../elastic-start-local"
    
    if [ ! -d "$ELASTIC_START_DIR" ]; then
        echo "❌ elastic-start-local directory not found at $ELASTIC_START_DIR"
        return 1
    fi

    # Check if .env file exists
    if [ ! -f "$ELASTIC_START_DIR/.env" ]; then
        echo "Creating .env file for Elasticsearch..."
        cat > "$ELASTIC_START_DIR/.env" << EOF
ES_LOCAL_VERSION=8.15.1
ES_LOCAL_CONTAINER_NAME=dev-elasticsearch
ES_LOCAL_PORT=9200
ES_LOCAL_PASSWORD=changeme
ES_LOCAL_HEAP_INIT=1g
ES_LOCAL_HEAP_MAX=1g
ES_LOCAL_DISK_SPACE_REQUIRED=2gb
KIBANA_LOCAL_CONTAINER_NAME=dev-kibana
KIBANA_LOCAL_PORT=5601
KIBANA_LOCAL_PASSWORD=changeme
KIBANA_ENCRYPTION_KEY=32_characters_long_string_here
ES_LOCAL_URL=http://elasticsearch:9200
ES_LOCAL_API_KEY=
ES_LOCAL_LICENSE=basic
EOF
    fi

    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        echo "❌ Docker is not running. Please start Docker first."
        return 1
    fi

    # Start Elasticsearch using docker-compose
    echo "Starting Elasticsearch with docker-compose..."
    cd "$ELASTIC_START_DIR"
    
    # Try to start only Elasticsearch
    if command -v docker-compose > /dev/null 2>&1; then
        docker-compose up -d elasticsearch
    else
        docker compose up -d elasticsearch
    fi
    
    echo ""
    echo "Waiting for Elasticsearch to be ready..."
    
    # Wait for Elasticsearch to be ready (max 60 seconds)
    for i in {1..30}; do
        if curl -s --connect-timeout 5 "$ELASTICSEARCH_URL" > /dev/null 2>&1; then
            echo "✅ Elasticsearch is now ready!"
            return 0
        fi
        echo -n "."
        sleep 2
    done
    
    echo ""
    echo "❌ Failed to start Elasticsearch within timeout"
    return 1
}

# Main execution
if check_elasticsearch; then
    echo ""
    echo "✅ Elasticsearch is ready for use!"
    echo "You can now run tests or examples that use Elasticsearch."
else
    if start_elasticsearch; then
        echo ""
        echo "✅ Elasticsearch is now ready for use!"
        echo "You can now run tests or examples that use Elasticsearch."
    else
        echo ""
        echo "❌ Could not start Elasticsearch automatically."
        echo "Please start it manually using:"
        echo "  cd elastic-start-local && ./start.sh"
        echo "Or check if Docker is running and you have sufficient permissions."
        exit 1
    fi
fi