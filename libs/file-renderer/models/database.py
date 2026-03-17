"""
Database Models - SQLAlchemy models (SQLAlchemy 2.0 style)

This module defines all database models for the file-renderer service:
- FileMetadata: Stores file metadata and S3 location
- FileVersion: Tracks file versions
- PdfParseResult: Caches PDF parsing results

Usage:
    from models.database import get_db, init_db, FileMetadata
    from sqlalchemy.orm import Session

    # Initialize database (create tables)
    init_db()

    # Get database session
    db: Session = next(get_db())

    # Query files
    files = db.query(FileMetadata).all()
"""

from datetime import datetime
from typing import Any, AsyncGenerator, Generator
from uuid import uuid4

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship,
    sessionmaker,
)
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from config import settings


class Base(DeclarativeBase):
    """SQLAlchemy 2.0 声明式基类"""
    pass


class FileMetadata(Base):
    """
    文件元数据表

    存储文件的基本信息、S3位置、版本和自定义元数据。
    每个文件对应S3中的一个对象。
    """

    __tablename__ = "file_metadata"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
        comment="文件唯一标识符 (UUID)"
    )
    filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="原始文件名"
    )
    content_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="MIME类型 (如: text/plain, application/pdf)"
    )
    size: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        comment="文件大小 (字节)"
    )
    s3_key: Mapped[str] = mapped_column(
        String(512),
        unique=True,
        nullable=False,
        index=True,
        comment="S3对象键"
    )
    s3_bucket: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="S3存储桶名称"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=func.now(),
        nullable=False,
        comment="创建时间"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="更新时间"
    )
    version: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
        comment="当前版本号"
    )
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="自定义元数据 (JSON格式)"
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="文件描述"
    )
    created_by: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="创建者标识"
    )
    is_deleted: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
        comment="软删除标记"
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="删除时间"
    )

    # Relationships
    versions: Mapped[list["FileVersion"]] = relationship(
        "FileVersion",
        back_populates="file",
        cascade="all, delete-orphan",
        order_by="desc(FileVersion.version_number)",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<FileMetadata(id={self.id}, filename={self.filename}, s3_key={self.s3_key})>"


class FileVersion(Base):
    """
    文件版本表

    跟踪文件的历史版本，支持版本回滚和审计。
    每个版本对应S3中的一个独立对象。
    """

    __tablename__ = "file_versions"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
        comment="版本唯一标识符 (UUID)"
    )
    file_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("file_metadata.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="关联的文件ID"
    )
    version_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="版本号 (从1开始递增)"
    )
    s3_key: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
        comment="该版本对应的S3对象键"
    )
    size: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        comment="版本文件大小 (字节)"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=func.now(),
        nullable=False,
        comment="版本创建时间"
    )
    change_summary: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="变更摘要/说明"
    )
    created_by: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="版本创建者"
    )
    checksum: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        comment="文件校验和 (SHA-256)"
    )

    # Relationships
    file: Mapped["FileMetadata"] = relationship("FileMetadata", back_populates="versions")

    # Unique constraint: each file can only have one version with a specific number
    __table_args__ = (
        # This is handled by the UniqueConstraint in the table definition
        # but we can add additional constraints here if needed
    )

    def __repr__(self) -> str:
        return f"<FileVersion(id={self.id}, file_id={self.file_id}, version={self.version_number})>"


class PdfParseResult(Base):
    """
    PDF 解析结果缓存表

    缓存PDF文件的解析结果，避免重复解析。
    使用S3键作为唯一标识，当文件修改时会重新解析。
    """

    __tablename__ = "pdf_parse_results"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        comment="自增主键"
    )
    s3_key: Mapped[str] = mapped_column(
        String(512),
        unique=True,
        nullable=False,
        index=True,
        comment="S3对象键"
    )
    file_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="原始文件名"
    )
    file_size: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        comment="文件大小 (字节)"
    )
    modified_time: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        comment="文件修改时间戳"
    )
    total_page: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="总页数"
    )
    pages: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        comment="页面内容 (JSON格式)"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=func.now(),
        nullable=False,
        comment="缓存创建时间"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="缓存更新时间"
    )

    def __repr__(self) -> str:
        return f"<PdfParseResult(id={self.id}, s3_key={self.s3_key}, pages={self.total_page})>"


class ConversionCache(Base):
    """
    文档转换缓存表

    缓存各种格式文档的转换结果，支持多种输出格式。
    使用缓存键作为唯一标识，当文件修改时会重新转换。
    """

    __tablename__ = "conversion_cache"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        comment="自增主键"
    )
    cache_key: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
        comment="缓存键 (SHA256)"
    )
    s3_key: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
        index=True,
        comment="S3对象键"
    )
    file_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="原始文件名"
    )
    file_size: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        comment="文件大小 (字节)"
    )
    modified_time: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        comment="文件修改时间戳"
    )
    total_pages: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="总页数"
    )
    content: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        comment="转换内容 (JSON格式)"
    )
    doc_metadata: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        comment="文档元数据"
    )
    output_format: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="markdown",
        comment="输出格式"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=func.now(),
        nullable=False,
        comment="缓存创建时间"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="缓存更新时间"
    )

    def __repr__(self) -> str:
        return f"<ConversionCache(id={self.id}, cache_key={self.cache_key}, s3_key={self.s3_key})>"


class ConversionTask(Base):
    """
    转换任务表

    跟踪文档转换任务的执行状态和结果。
    支持单文件转换和批量转换任务。
    """

    __tablename__ = "conversion_tasks"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        comment="自增主键"
    )
    task_id: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
        comment="任务唯一标识符"
    )
    task_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="任务类型: single, batch"
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
        comment="任务状态: pending, processing, success, failed, cancelled"
    )
    s3_keys: Mapped[list[str]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        comment="S3对象键列表"
    )
    total_files: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        comment="总文件数"
    )
    completed_files: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="已完成文件数"
    )
    failed_files: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="失败文件数"
    )
    result: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="任务结果"
    )
    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="错误信息"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=func.now(),
        nullable=False,
        comment="任务创建时间"
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="任务完成时间"
    )

    def __repr__(self) -> str:
        return f"<ConversionTask(id={self.id}, task_id={self.task_id}, status={self.status})>"


# ============================================================================
# 数据库引擎和会话配置
# ============================================================================

def get_engine_url() -> str:
    """获取数据库连接URL，处理同步/异步驱动转换"""
    url = settings.database.database_url
    # If using asyncpg but we need sync connection, convert to psycopg2
    if url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", "postgresql://")
    return url


def get_async_engine_url() -> str:
    """获取异步数据库连接URL"""
    url = settings.database.database_url
    # If using psycopg2 but we need async connection, convert to asyncpg
    if url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


# 同步引擎配置
engine = create_engine(
    get_engine_url(),
    pool_pre_ping=True,  # 连接前ping检查，自动回收失效连接
    pool_size=10,        # 连接池大小
    max_overflow=20,     # 最大溢出连接数
    pool_recycle=3600,   # 连接回收时间(秒)
    pool_timeout=30,     # 获取连接超时时间(秒)
    echo=False,          # 是否打印SQL语句(调试用)
)

# 同步会话工厂
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,  # 提交后不过期对象
)

# 异步引擎配置
async_engine = create_async_engine(
    get_async_engine_url(),
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=3600,
    pool_timeout=30,
    echo=False,
)

# 异步会话工厂
AsyncSessionLocal = async_sessionmaker(
    async_engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


# ============================================================================
# 会话管理函数
# ============================================================================

def get_db() -> Generator[Any, None, None]:
    """
    获取同步数据库会话

    用于依赖注入，如 FastAPI 的 Depends(get_db)

    Yields:
        Session: SQLAlchemy数据库会话

    Example:
        @app.get("/items")
        def get_items(db: Session = Depends(get_db)):
            return db.query(Item).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_async_db() -> AsyncGenerator[AsyncSession, None]:
    """
    获取异步数据库会话

    用于异步依赖注入

    Yields:
        AsyncSession: SQLAlchemy异步数据库会话

    Example:
        @app.get("/items")
        async def get_items(db: AsyncSession = Depends(get_async_db)):
            result = await db.execute(select(Item))
            return result.scalars().all()
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# ============================================================================
# 数据库初始化函数
# ============================================================================

def init_db() -> None:
    """
    初始化数据库表 (同步方式)

    创建所有定义的表结构。注意：不会删除现有表。
    生产环境建议使用 Alembic 迁移而不是此函数。

    Raises:
        Exception: 数据库连接或创建表失败时抛出
    """
    Base.metadata.create_all(bind=engine)


async def init_db_async() -> None:
    """
    初始化数据库表 (异步方式)

    创建所有定义的表结构。用于异步应用启动时初始化。
    """
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


def drop_db() -> None:
    """
    删除所有数据库表 (危险操作！)

    仅用于开发和测试环境。
    """
    Base.metadata.drop_all(bind=engine)


async def drop_db_async() -> None:
    """
    异步删除所有数据库表 (危险操作！)

    仅用于开发和测试环境。
    """
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


# ============================================================================
# 健康检查函数
# ============================================================================

def check_database_connection() -> bool:
    """
    检查数据库连接是否正常

    Returns:
        bool: 连接正常返回True，否则返回False
    """
    try:
        with engine.connect() as conn:
            conn.execute("SELECT 1")
        return True
    except Exception:
        return False


async def check_database_connection_async() -> bool:
    """
    异步检查数据库连接是否正常

    Returns:
        bool: 连接正常返回True，否则返回False
    """
    try:
        async with async_engine.connect() as conn:
            await conn.execute("SELECT 1")
        return True
    except Exception:
        return False
