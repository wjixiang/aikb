#!/bin/bash
# ==========================================
# Case Hub - Development Startup Script
# ==========================================

set -e

echo "=============================================="
echo "Case Hub Development Environment Startup"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env file exists
if [ ! -f .env ]; then
    print_warn ".env file not found, copying from .env.example"
    if [ -f .env.example ]; then
        cp .env.example .env
        print_info ".env file created from .env.example"
        print_warn "Please update .env with your actual configuration values"
    else
        print_error ".env.example not found!"
        exit 1
    fi
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    print_error "pnpm is not installed. Please install it first:"
    echo "npm install -g pnpm@10.7.0"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

print_info "Installing dependencies..."
pnpm install

print_info "Generating Prisma client..."
pnpm prisma:generate

# Check if database is running
if ! docker ps | grep -q "case-hub-postgres"; then
    print_info "Starting PostgreSQL database..."
    docker compose up -d postgres

    # Wait for database to be ready
    print_info "Waiting for database to be ready..."
    sleep 5

    until docker exec case-hub-postgres pg_isready -U casehub -d case_hub &> /dev/null; do
        print_warn "Database not ready yet, waiting..."
        sleep 2
    done

    print_info "Database is ready!"
else
    print_info "PostgreSQL is already running"
fi

# Run database migrations
print_info "Running database migrations..."
pnpm prisma:migrate || pnpm prisma:push

# Seed database if needed
print_info "Seeding database..."
pnpm db:seed || print_warn "Database seeding skipped or failed"

print_info "Starting development server..."
echo "=============================================="
echo "Case Hub will be available at:"
echo "  API:       http://localhost:3002/api"
echo "  Swagger:   http://localhost:3002/api/docs"
echo "=============================================="

# Start the development server
pnpm start:dev
