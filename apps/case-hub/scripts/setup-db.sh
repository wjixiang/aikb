#!/bin/bash
# ==========================================
# Case Hub - Database Initialization Script
# Runs automatically when PostgreSQL container starts
# ==========================================

set -e

echo "=============================================="
echo "Case Hub Database Initialization"
echo "=============================================="

# This script runs as part of the PostgreSQL initialization
# It executes when the container starts for the first time

echo "Creating extensions..."

# Create uuid-ossp extension for UUID generation
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Enable UUID extension
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Enable pg_trgm for text search
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";

    -- Enable unaccent for better text search
    CREATE EXTENSION IF NOT EXISTS "unaccent";

    -- Create schema if not exists
    CREATE SCHEMA IF NOT EXISTS public;

    -- Grant permissions
    GRANT ALL PRIVILEGES ON SCHEMA public TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $POSTGRES_USER;
EOSQL

echo "Database initialization completed!"
echo "Database: $POSTGRES_DB"
echo "User: $POSTGRES_USER"
