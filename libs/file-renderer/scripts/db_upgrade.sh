#!/bin/bash
# =============================================================================
# Database Upgrade Script
# =============================================================================
# Usage: ./scripts/db_upgrade.sh [revision]
#   revision: Target revision (default: head)
#
# Examples:
#   ./scripts/db_upgrade.sh           # Upgrade to latest (head)
#   ./scripts/db_upgrade.sh head      # Upgrade to latest
#   ./scripts/db_upgrade.sh +1        # Upgrade one revision
#   ./scripts/db_upgrade.sh 001       # Upgrade to specific revision
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

# Default revision
REVISION="${1:-head}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Database Migration Upgrade${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if alembic is installed
if ! command -v alembic &> /dev/null; then
    echo -e "${YELLOW}Alembic not found in PATH, trying to use from virtual environment...${NC}"

    # Check for common virtual environment locations
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

# Show current status
echo -e "${BLUE}Current migration status:${NC}"
$ALEMBIC_CMD current || true
echo ""

# Perform upgrade
echo -e "${YELLOW}Upgrading to revision: $REVISION${NC}"
echo ""

if $ALEMBIC_CMD upgrade "$REVISION"; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Migration completed successfully!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""

    # Show new status
    echo -e "${BLUE}New migration status:${NC}"
    $ALEMBIC_CMD current
else
    echo ""
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  Migration failed!${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
