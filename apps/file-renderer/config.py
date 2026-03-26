"""
BibMax Document Processing Service Configuration

Simplified configuration focused on:
- PDF to text/markdown conversion
- Text chunking for embeddings
- File metadata extraction
"""

from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class ConversionSettings(BaseSettings):
    """File conversion configuration"""

    model_config = SettingsConfigDict(
        env_prefix="CONVERSION_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    max_file_size: int = Field(
        default=100 * 1024 * 1024,  # 100MB
        description="Maximum file size in bytes",
    )
    timeout: int = Field(
        default=300,
        description="Conversion timeout in seconds",
    )
    enable_ocr: bool = Field(
        default=True,
        description="Enable OCR for scanned PDFs",
    )
    ocr_languages: list[str] = Field(
        default_factory=lambda: ["eng", "chi_sim"],
        description="OCR language list",
    )
    enable_table_extraction: bool = Field(
        default=True,
        description="Enable table extraction",
    )
    enable_cache: bool = Field(
        default=True,
        description="Enable conversion result caching",
    )


class ChunkingSettings(BaseSettings):
    """Text chunking configuration for embeddings"""

    model_config = SettingsConfigDict(
        env_prefix="CHUNKING_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    default_chunk_size: int = Field(
        default=1000,
        description="Default chunk size in characters",
    )
    max_chunk_size: int = Field(
        default=2000,
        description="Maximum chunk size in characters",
    )
    chunk_overlap: int = Field(
        default=200,
        description="Overlap between chunks",
    )
    semantic_chunk_size: int = Field(
        default=2000,
        description="Semantic chunk size",
    )
    semantic_overlap: int = Field(
        default=200,
        description="Semantic chunk overlap",
    )


class ServerSettings(BaseSettings):
    """Server configuration"""

    model_config = SettingsConfigDict(
        env_prefix="SERVER_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str = Field(
        default="0.0.0.0",
        description="Server host",
    )
    port: int = Field(
        default=8001,
        description="Server port",
    )
    reload: bool = Field(
        default=False,
        description="Enable auto-reload",
    )
    workers: int = Field(
        default=1,
        description="Number of worker processes",
    )
    log_level: str = Field(
        default="INFO",
        description="Log level",
    )


class DatabaseSettings(BaseSettings):
    """Database configuration"""

    model_config = SettingsConfigDict(
        env_prefix="DATABASE_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    url: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/bibmax_docs",
        description="Database connection URL",
    )
    pool_size: int = Field(
        default=5,
        description="Connection pool size",
    )
    max_overflow: int = Field(
        default=10,
        description="Max overflow connections",
    )


class Settings(BaseSettings):
    """Application settings"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = Field(
        default="BibMax Document Processing Service",
        description="Application name",
    )
    app_version: str = Field(
        default="1.0.0",
        description="Application version",
    )
    debug: bool = Field(
        default=False,
        description="Debug mode",
    )
    api_prefix: str = Field(
        default="/api/v1",
        description="API prefix",
    )

    # Nested settings
    conversion: ConversionSettings = Field(
        default_factory=ConversionSettings,
    )
    chunking: ChunkingSettings = Field(
        default_factory=ChunkingSettings,
    )
    server: ServerSettings = Field(
        default_factory=ServerSettings,
    )
    database: DatabaseSettings = Field(
        default_factory=DatabaseSettings,
    )


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Global settings instance
settings = get_settings()
