#!/bin/bash
# =============================================================================
# Database Downgrade Script
# =============================================================================
# Usage: ./scripts/db_downgrade.sh [revision]
#   revision: Target revision (default: -1, one step back)
#
# Examples:
#   ./scripts/db_downgrade.sh       # Downgrade one revision
#   ./scripts/db_downgrade.sh -1    # Downgrade one revision
#   ./scripts/db_downgrade.sh -2    # Downgrade two revisions
#   ./scripts/db_downgrade.sh 001   # Downgrade to specific revision
#   ./scripts/db_downgrade.sh base  # Downgrade to base (empty database)
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
REVISION="${1:--1}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Database Migration Downgrade${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

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

# Show current status
echo -e "${BLUE}Current migration status:${NC}"
$ALEMBIC_CMD current || true
echo ""

# Confirm downgrade if going to base
if [ "$REVISION" == "base" ]; then
    echo -e "${YELLOW}WARNING: You are about to downgrade to base (empty database)!${NC}"
    read -p "Are you sure? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Downgrade cancelled.${NC}"
        exit 0
    fi
fi

# Perform downgrade
echo -e "${YELLOW}Downgrading to revision: $REVISION${NC}"
echo ""

if $ALEMBIC_CMD downgrade "$REVISION"; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Downgrade completed successfully!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""

    # Show new status
    echo -e "${BLUE}New migration status:${NC}"
    $ALEMBIC_CMD current
else
    echo ""
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  Downgrade failed!${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
