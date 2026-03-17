#!/bin/bash
# =============================================================================
# Database Reset Script
# =============================================================================
# Usage: ./scripts/db_reset.sh [--force]
#   --force: Skip confirmation prompt
#
# WARNING: This script will:
#   1. Downgrade to base (remove all tables)
#   2. Upgrade to head (recreate all tables)
#   All data will be lost!
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Change to project root
cd "$PROJECT_ROOT"

# Parse arguments
FORCE=false
for arg in "$@"; do
    if [ "$arg" == "--force" ] || [ "$arg" == "-f" ]; then
        FORCE=true
    fi
done

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Database Reset${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Warning message
echo -e "${RED}WARNING: This will delete ALL data in the database!${NC}"
echo -e "${YELLOW}The following actions will be performed:${NC}"
echo "  1. Downgrade to base (drop all tables)"
echo "  2. Upgrade to head (recreate all tables)"
echo ""

# Confirmation
if [ "$FORCE" = false ]; then
    echo -e "${YELLOW}Are you sure you want to continue?${NC}"
    read -p "Type 'yes' to proceed: " -r
    echo
    if [[ ! $REPLY =~ ^yes$ ]]; then
        echo -e "${YELLOW}Reset cancelled.${NC}"
        exit 0
    fi
else
    echo -e "${YELLOW}Force mode enabled, skipping confirmation...${NC}"
fi

# Check if alembic is installed
if ! command -v alembic &> /dev/null; then
    echo -e "${YELLOW}Alembic not found in PATH, trying to use from virtual environment...${NC}"

    if [ -f "$PROJECT_ROOT/.venv/bin/alembic" ]; then
        ALEMBIC_CMD="$PROJECT_ROOT/.venv/bin/alembic"
    elif [ -f "$PROJECT_ROOT/venv/bin/alembic" ]; then
        ALEMBIC_CMD="$PROJECT_ROOT/venv/bin/alembic"
    elif [ -f "$PROJECT_ROOT/.venv/Scripts/alembic.exe" ]; then
        ALEMBIC_CMD="$PROJECT_ROOT/.venv/Scripts/alembic.exe"
    elif command -v uv &> /dev/null; then
        echo -e "${BLUE}Using uv to run alembic...${NC}"
        ALEMBIC_CMD="uv run alembic"
    else
        echo -e "${RED}Error: Alembic not found. Please install it or activate your virtual environment.${NC}"
        exit 1
    fi
else
    ALEMBIC_CMD="alembic"
fi

# Check if .env file exists and load it
if [ -f "$PROJECT_ROOT/.env" ]; then
    echo -e "${BLUE}Loading environment from .env file...${NC}"
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

echo ""
echo -e "${BLUE}Step 1/2: Downgrading to base...${NC}"
if $ALEMBIC_CMD downgrade base; then
    echo -e "${GREEN}  ✓ Downgrade completed${NC}"
else
    echo -e "${RED}  ✗ Downgrade failed${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Step 2/2: Upgrading to head...${NC}"
if $ALEMBIC_CMD upgrade head; then
    echo -e "${GREEN}  ✓ Upgrade completed${NC}"
else
    echo -e "${RED}  ✗ Upgrade failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Database reset completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Show final status
echo -e "${BLUE}Current migration status:${NC}"
$ALEMBIC_CMD current
