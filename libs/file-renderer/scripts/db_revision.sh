#!/bin/bash
# =============================================================================
# Database Migration Revision Script
# =============================================================================
# Usage: ./scripts/db_revision.sh <message> [--autogenerate]
#   message: Migration description (required)
#   --autogenerate: Auto-generate migration from model changes
#
# Examples:
#   ./scripts/db_revision.sh "add user table"
#   ./scripts/db_revision.sh "update file model" --autogenerate
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
MESSAGE=""
AUTOGENERATE=""

for arg in "$@"; do
    if [ "$arg" == "--autogenerate" ] || [ "$arg" == "-a" ]; then
        AUTOGENERATE="--autogenerate"
    elif [ -z "$MESSAGE" ]; then
        MESSAGE="$arg"
    fi
done

# Validate message
if [ -z "$MESSAGE" ]; then
    echo -e "${RED}Error: Migration message is required.${NC}"
    echo ""
    echo "Usage: $0 <message> [--autogenerate]"
    echo "  message: Migration description (required)"
    echo "  --autogenerate: Auto-generate from model changes"
    echo ""
    echo "Examples:"
    echo "  $0 \"add user table\""
    echo "  $0 \"update file model\" --autogenerate"
    exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Create New Migration Revision${NC}"
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

# Create revision
echo -e "${YELLOW}Creating migration: $MESSAGE${NC}"
if [ -n "$AUTOGENERATE" ]; then
    echo -e "${BLUE}Mode: Auto-generate from models${NC}"
else
    echo -e "${BLUE}Mode: Empty migration (manual editing required)${NC}"
fi
echo ""

if $ALEMBIC_CMD revision $AUTOGENERATE -m "$MESSAGE"; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Migration created successfully!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""

    # Show the newly created migration file
    echo -e "${BLUE}Latest migration files:${NC}"
    ls -la alembic/versions/*.py 2>/dev/null | tail -5 || true
    echo ""

    if [ -z "$AUTOGENERATE" ]; then
        echo -e "${YELLOW}Note: You need to manually edit the migration file to add your changes.${NC}"
        echo -e "${YELLOW}File location: alembic/versions/XXX_your_message.py${NC}"
    fi
else
    echo ""
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  Failed to create migration!${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
