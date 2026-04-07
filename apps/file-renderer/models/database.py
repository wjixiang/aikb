"""
Database models and session management.

Unified Task model for async task tracking + async/sync SQLAlchemy engines.
"""

from datetime import datetime
from typing import AsyncGenerator
from uuid import uuid4

from sqlalchemy import String, Text, Float, DateTime, JSON, func, select, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, Session, sessionmaker

from config import settings


class Base(DeclarativeBase):
    """Base class for all models"""

    pass


class Task(Base):
    """Unified task model for conversion and chunking operations"""

    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    task_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="pending",
        index=True,
    )
    input_params: Mapped[dict] = mapped_column(JSON, nullable=False)
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    progress: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    def __repr__(self) -> str:
        return f"<Task(id={self.id}, type={self.task_type}, status={self.status})>"


# --- Async engine (for FastAPI endpoints) ---


def _get_async_url() -> str:
    url = settings.database.url
    if url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


async_engine = create_async_engine(
    _get_async_url(),
    pool_pre_ping=True,
    pool_size=settings.database.pool_size,
    max_overflow=settings.database.max_overflow,
    pool_recycle=3600,
    echo=settings.debug,
)

AsyncSessionLocal = async_sessionmaker(
    async_engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


async def get_async_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for async DB sessions."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    """Create all tables."""
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def check_db() -> bool:
    """Check database connectivity."""
    try:
        async with async_engine.connect() as conn:
            await conn.execute(select(1))
        return True
    except Exception:
        return False


async def dispose_db() -> None:
    """Dispose the async engine."""
    await async_engine.dispose()


# --- Sync engine (lazy, for use inside ThreadPoolExecutor threads) ---

_sync_engine = None
_sync_session_local = None


def _get_sync_url() -> str:
    url = settings.database.url
    if url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", "postgresql://", 1)
    return url


def get_sync_engine():
    """Lazy-init sync engine (avoids psycopg2 import at module load)."""
    global _sync_engine, _sync_session_local
    if _sync_engine is None:
        from sqlalchemy import create_engine

        _sync_engine = create_engine(
            _get_sync_url(),
            pool_pre_ping=True,
            pool_size=settings.database.pool_size,
            max_overflow=settings.database.max_overflow,
            pool_recycle=3600,
            echo=False,
        )
        _sync_session_local = sessionmaker(
            _sync_engine,
            autocommit=False,
            autoflush=False,
            expire_on_commit=False,
        )
    return _sync_engine


def SyncSessionLocal():
    """Get a sync session factory (lazy-init)."""
    get_sync_engine()
    return _sync_session_local()
