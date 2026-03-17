"""
Alembic environment configuration for SQLAlchemy 2.0 async/sync support

This module configures Alembic database migrations with support for:
- Both sync and async database drivers
- Environment variable configuration
- Auto-discovery of SQLAlchemy models
- Comprehensive logging
"""

import asyncio
import os
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Add project root to sys.path for imports
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Import project models and config
from config import settings
from models.database import Base

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Add your model's MetaData object here for 'autogenerate' support
# This allows Alembic to detect model changes automatically
target_metadata = Base.metadata

# Get database URL from settings with fallback to environment variable
def get_database_url() -> str:
    """Get database URL from settings or environment variable."""
    # Priority: 1. Environment variable, 2. Settings, 3. Default
    env_url = os.getenv("DATABASE_URL")
    if env_url:
        return env_url
    return settings.database.database_url


# Override sqlalchemy.url with actual database URL
database_url = get_database_url()
config.set_main_option("sqlalchemy.url", database_url)


def include_object(object, name, type_, reflected, compare_to):
    """
    Filter function for including/excluding objects in migrations.

    Returns True if the object should be included in the migration.
    """
    # Exclude tables that start with underscore (internal tables)
    if type_ == "table" and name.startswith("_"):
        return False
    return True


def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode.

    This configures the context with just a URL and not an Engine.
    By skipping the Engine creation we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the script output.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
        include_object=include_object,
        # Include schemas in migration
        include_schemas=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Run migrations with the given connection."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
        include_object=include_object,
        include_schemas=True,
        # Transaction per migration for better error handling
        transaction_per_migration=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        do_run_migrations(connection)


async def run_async_migrations() -> None:
    """
    Run migrations asynchronously.

    For async database operations, use this function.
    Requires asyncpg driver.
    """
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online_async() -> None:
    """Entry point for async migrations."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    # Check if using async driver
    if database_url.startswith("postgresql+asyncpg"):
        run_migrations_online_async()
    else:
        run_migrations_online()
