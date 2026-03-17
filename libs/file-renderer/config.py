"""
统一配置模块

使用方式:
    from config import settings
    print(settings.s3.bucket)
"""

from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class S3Settings(BaseSettings):
    """S3/OSS存储配置"""

    model_config = SettingsConfigDict(
        env_prefix="S3_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    endpoint: str = Field(
        default="oss-cn-hangzhou.aliyuncs.com",
        description="S3/OSS endpoint (不含protocol)",
    )
    access_key_id: str = Field(
        default="",
        description="Access Key ID",
    )
    access_key_secret: str = Field(
        default="",
        description="Access Key Secret",
    )
    bucket: str = Field(
        default="",
        description="存储桶名称",
    )
    region: str = Field(
        default="cn-hangzhou",
        description="区域",
    )
    force_path_style: bool = Field(
        default=False,
        description="是否使用path-style (S3=true, 阿里云OSS=false)",
    )


class PaginationSettings(BaseSettings):
    """分页配置"""

    model_config = SettingsConfigDict(
        env_prefix="",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    default_page_size: int = Field(
        default=4000,
        description="默认每页字符数",
    )
    semantic_chunk_size: int = Field(
        default=2000,
        description="语义分块大小",
    )
    semantic_overlap: int = Field(
        default=200,
        description="语义块重叠字符数",
    )


class ConversionSettings(BaseSettings):
    """文件转换配置"""

    model_config = SettingsConfigDict(
        env_prefix="CONVERSION_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    max_file_size: int = Field(
        default=100 * 1024 * 1024,  # 100MB
        description="最大文件大小(字节)",
    )
    timeout: int = Field(
        default=300,
        description="转换超时时间(秒)",
    )
    enable_ocr: bool = Field(
        default=True,
        description="是否启用OCR",
    )
    ocr_languages: list[str] = Field(
        default_factory=lambda: ["eng", "chi_sim"],
        description="OCR识别语言列表",
    )
    enable_table_extraction: bool = Field(
        default=True,
        description="是否启用表格识别",
    )
    enable_image_extraction: bool = Field(
        default=False,
        description="是否启用图片提取",
    )
    max_workers: int = Field(
        default=4,
        description="并发转换工作线程数",
    )
    enable_cache: bool = Field(
        default=True,
        description="是否启用转换缓存",
    )
    cache_ttl_hours: int = Field(
        default=168,  # 7 days
        description="缓存有效期(小时)",
    )


class ServerSettings(BaseSettings):
    """服务器配置"""

    model_config = SettingsConfigDict(
        env_prefix="SERVER_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str = Field(
        default="0.0.0.0",
        description="服务监听地址",
    )
    port: int = Field(
        default=8000,
        description="服务监听端口",
    )
    reload: bool = Field(
        default=False,
        description="是否启用热重载",
    )
    log_level: str = Field(
        default="INFO",
        description="日志级别",
    )


class DatabaseSettings(BaseSettings):
    """数据库配置"""

    model_config = SettingsConfigDict(
        env_prefix="",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/filerenderer",
        description="PostgreSQL 数据库连接字符串",
    )


class Settings(BaseSettings):
    """全局配置"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    s3: S3Settings = Field(default_factory=S3Settings)
    pagination: PaginationSettings = Field(default_factory=PaginationSettings)
    conversion: ConversionSettings = Field(default_factory=ConversionSettings)
    server: ServerSettings = Field(default_factory=ServerSettings)
    database: DatabaseSettings = Field(default_factory=DatabaseSettings)

    # 应用元信息
    app_name: str = Field(
        default="file-renderer",
        description="应用名称",
    )
    app_version: str = Field(
        default="0.1.0",
        description="应用版本",
    )
    debug: bool = Field(
        default=False,
        description="调试模式",
    )


@lru_cache
def get_settings() -> Settings:
    """获取全局配置单例"""
    return Settings()


# 全局配置实例
settings: Settings = get_settings()
