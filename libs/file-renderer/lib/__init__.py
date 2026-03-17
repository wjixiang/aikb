"""
Lib package - 核心工具库

包含：
- dependency_injection: 依赖注入容器
- exceptions: 自定义异常类
- logging_config: 结构化日志配置
- middleware: FastAPI 中间件
- s3_key_generator: S3 Key 生成器
- schemas: 通用响应模型
- docling: Docling 集成工具
- utils: 通用工具函数
"""

from lib.dependency_injection import ServiceProvider, get_service_provider, resolve_service
from lib.exceptions import (
    AuthenticationException,
    AuthorizationException,
    BadRequestException,
    CacheException,
    ConflictException,
    ConcurrentModificationException,
    ConversionException,
    DatabaseException,
    DependencyServiceException,
    FileAlreadyExistsException,
    FileNotFoundException,
    FileRendererException,
    FileTooLargeException,
    InvalidPageNumberException,
    MaintenanceModeException,
    MarkdownConversionException,
    MethodNotAllowedException,
    NotFoundException,
    PayloadTooLargeException,
    PdfConversionException,
    QuotaExceededException,
    RateLimitException,
    ResourceExhaustedException,
    ServiceUnavailableException,
    StorageDeleteException,
    StorageDownloadException,
    StorageException,
    StorageUploadException,
    TimeoutException,
    UnsupportedFileTypeException,
    ValidationException,
    VersionConflictException,
)
from lib.logging_config import (
    get_access_logger,
    get_logger,
    log_access,
    log_error,
    setup_logging,
)
from lib.s3_key_generator import (
    FileType,
    generate_binary_key,
    generate_csv_key,
    generate_file_key,
    generate_html_key,
    generate_json_key,
    generate_markdown_key,
    generate_pdf_key,
    generate_s3_key,
    generate_tex_key,
    generate_text_key,
    generate_xml_key,
    sanitize_filename,
)

__all__ = [
    # Dependency Injection
    "ServiceProvider",
    "get_service_provider",
    "resolve_service",
    # Exceptions
    "FileRendererException",
    "StorageException",
    "StorageUploadException",
    "StorageDownloadException",
    "StorageDeleteException",
    "ConversionException",
    "PdfConversionException",
    "MarkdownConversionException",
    "ValidationException",
    "FileTooLargeException",
    "UnsupportedFileTypeException",
    "InvalidPageNumberException",
    "NotFoundException",
    "FileNotFoundException",
    "CacheException",
    "DatabaseException",
    "RateLimitException",
    "TimeoutException",
    "ConflictException",
    "FileAlreadyExistsException",
    "VersionConflictException",
    "ConcurrentModificationException",
    "ServiceUnavailableException",
    "DependencyServiceException",
    "MaintenanceModeException",
    "ResourceExhaustedException",
    "QuotaExceededException",
    "AuthenticationException",
    "AuthorizationException",
    "BadRequestException",
    "PayloadTooLargeException",
    "MethodNotAllowedException",
    # Logging
    "setup_logging",
    "get_logger",
    "get_access_logger",
    "log_access",
    "log_error",
    # S3 Key Generator
    "FileType",
    "generate_s3_key",
    "generate_pdf_key",
    "generate_markdown_key",
    "generate_text_key",
    "generate_html_key",
    "generate_csv_key",
    "generate_xml_key",
    "generate_json_key",
    "generate_binary_key",
    "generate_tex_key",
    "generate_file_key",
    "sanitize_filename",
]
