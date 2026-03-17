"""
File Renderer 自定义异常类层次结构

提供结构化的异常处理，支持错误代码、HTTP状态码和详细错误信息。
"""

from typing import Any, Optional
from fastapi import status


class FileRendererException(Exception):
    """
    所有 file-renderer 异常的基类

    Attributes:
        message: 错误消息
        error_code: 错误代码，用于程序识别
        status_code: HTTP 状态码
        details: 额外的错误详情
    """

    def __init__(
        self,
        message: str = "An error occurred",
        error_code: str = "INTERNAL_ERROR",
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}

    def to_dict(self) -> dict[str, Any]:
        """转换为字典格式，用于 API 响应"""
        return {
            "success": False,
            "error": {
                "code": self.error_code,
                "message": self.message,
                "details": self.details,
            },
        }

    def __str__(self) -> str:
        return f"[{self.error_code}] {self.message}"

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}("
            f"message='{self.message}', "
            f"error_code='{self.error_code}', "
            f"status_code={self.status_code})"
        )


class StorageException(FileRendererException):
    """
    存储相关异常 (S3/OSS 操作失败)

    包括：上传失败、下载失败、删除失败、存储桶不存在等
    """

    def __init__(
        self,
        message: str = "Storage operation failed",
        error_code: str = "STORAGE_ERROR",
        status_code: int = status.HTTP_503_SERVICE_UNAVAILABLE,
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            error_code=error_code,
            status_code=status_code,
            details=details,
        )


class StorageUploadException(StorageException):
    """文件上传失败"""

    def __init__(
        self,
        message: str = "Failed to upload file to storage",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            error_code="STORAGE_UPLOAD_ERROR",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            details=details,
        )


class StorageDownloadException(StorageException):
    """文件下载失败"""

    def __init__(
        self,
        message: str = "Failed to download file from storage",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            error_code="STORAGE_DOWNLOAD_ERROR",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            details=details,
        )


class StorageDeleteException(StorageException):
    """文件删除失败"""

    def __init__(
        self,
        message: str = "Failed to delete file from storage",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            error_code="STORAGE_DELETE_ERROR",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            details=details,
        )


class ConversionException(FileRendererException):
    """
    文件转换相关异常

    包括：PDF解析失败、格式转换失败、OCR失败等
    """

    def __init__(
        self,
        message: str = "File conversion failed",
        error_code: str = "CONVERSION_ERROR",
        status_code: int = status.HTTP_422_UNPROCESSABLE_ENTITY,
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            error_code=error_code,
            status_code=status_code,
            details=details,
        )


class PdfConversionException(ConversionException):
    """PDF 转换/解析失败"""

    def __init__(
        self,
        message: str = "Failed to convert or parse PDF file",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            error_code="PDF_CONVERSION_ERROR",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details=details,
        )


class MarkdownConversionException(ConversionException):
    """Markdown 转换失败"""

    def __init__(
        self,
        message: str = "Failed to process Markdown file",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            error_code="MARKDOWN_CONVERSION_ERROR",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details=details,
        )


class ValidationException(FileRendererException):
    """
    数据验证异常

    包括：请求参数无效、文件格式不支持、文件过大等
    """

    def __init__(
        self,
        message: str = "Validation failed",
        error_code: str = "VALIDATION_ERROR",
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            error_code=error_code,
            status_code=status_code,
            details=details,
        )


class FileTooLargeException(ValidationException):
    """文件大小超过限制"""

    def __init__(
        self,
        max_size: int,
        actual_size: int,
        details: Optional[dict[str, Any]] = None,
    ):
        extra_details = details or {}
        extra_details.update({
            "max_size": max_size,
            "actual_size": actual_size,
            "max_size_mb": round(max_size / (1024 * 1024), 2),
            "actual_size_mb": round(actual_size / (1024 * 1024), 2),
        })
        super().__init__(
            message=f"File too large. Maximum size: {max_size} bytes, actual: {actual_size} bytes",
            error_code="FILE_TOO_LARGE",
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            details=extra_details,
        )


class UnsupportedFileTypeException(ValidationException):
    """不支持的文件类型"""

    def __init__(
        self,
        content_type: str,
        supported_types: Optional[list[str]] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        extra_details = details or {}
        extra_details["content_type"] = content_type
        if supported_types:
            extra_details["supported_types"] = supported_types

        super().__init__(
            message=f"Unsupported file type: {content_type}",
            error_code="UNSUPPORTED_FILE_TYPE",
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            details=extra_details,
        )


class InvalidPageNumberException(ValidationException):
    """无效的页码"""

    def __init__(
        self,
        page: int,
        total_pages: int,
        details: Optional[dict[str, Any]] = None,
    ):
        extra_details = details or {}
        extra_details.update({
            "requested_page": page,
            "total_pages": total_pages,
        })
        super().__init__(
            message=f"Invalid page number: {page}. Total pages: {total_pages}",
            error_code="INVALID_PAGE_NUMBER",
            status_code=status.HTTP_400_BAD_REQUEST,
            details=extra_details,
        )


class NotFoundException(FileRendererException):
    """
    资源不存在异常

    包括：文件不存在、记录不存在等
    """

    def __init__(
        self,
        message: str = "Resource not found",
        error_code: str = "NOT_FOUND",
        status_code: int = status.HTTP_404_NOT_FOUND,
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            error_code=error_code,
            status_code=status_code,
            details=details,
        )


class FileNotFoundException(NotFoundException):
    """文件不存在"""

    def __init__(
        self,
        file_id: Optional[str] = None,
        s3_key: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        extra_details = details or {}
        if file_id:
            extra_details["file_id"] = file_id
        if s3_key:
            extra_details["s3_key"] = s3_key

        message = "File not found"
        if file_id:
            message = f"File not found: {file_id}"
        elif s3_key:
            message = f"File not found in storage: {s3_key}"

        super().__init__(
            message=message,
            error_code="FILE_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
            details=extra_details,
        )


class CacheException(FileRendererException):
    """
    缓存相关异常

    包括：缓存读取失败、缓存写入失败等
    """

    def __init__(
        self,
        message: str = "Cache operation failed",
        error_code: str = "CACHE_ERROR",
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            error_code=error_code,
            status_code=status_code,
            details=details,
        )


class DatabaseException(FileRendererException):
    """
    数据库操作异常

    包括：连接失败、查询失败、事务失败等
    """

    def __init__(
        self,
        message: str = "Database operation failed",
        error_code: str = "DATABASE_ERROR",
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            error_code=error_code,
            status_code=status_code,
            details=details,
        )


class RateLimitException(FileRendererException):
    """
    速率限制异常

    请求过于频繁时抛出
    """

    def __init__(
        self,
        message: str = "Rate limit exceeded",
        retry_after: Optional[int] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        extra_details = details or {}
        if retry_after:
            extra_details["retry_after"] = retry_after

        super().__init__(
            message=message,
            error_code="RATE_LIMIT_EXCEEDED",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            details=extra_details,
        )


class TimeoutException(FileRendererException):
    """
    操作超时异常

    包括：转换超时、下载超时等
    """

    def __init__(
        self,
        message: str = "Operation timed out",
        timeout_seconds: Optional[int] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        extra_details = details or {}
        if timeout_seconds:
            extra_details["timeout_seconds"] = timeout_seconds

        super().__init__(
            message=message,
            error_code="TIMEOUT",
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            details=extra_details,
        )


class ConflictException(FileRendererException):
    """
    资源冲突异常

    包括：文件已存在、版本冲突、并发修改等
    """

    def __init__(
        self,
        message: str = "Resource conflict",
        error_code: str = "CONFLICT",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            error_code=error_code,
            status_code=status.HTTP_409_CONFLICT,
            details=details,
        )


class FileAlreadyExistsException(ConflictException):
    """文件已存在异常"""

    def __init__(
        self,
        file_id: Optional[str] = None,
        s3_key: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        extra_details = details or {}
        if file_id:
            extra_details["file_id"] = file_id
        if s3_key:
            extra_details["s3_key"] = s3_key

        message = "File already exists"
        if file_id:
            message = f"File already exists: {file_id}"
        elif s3_key:
            message = f"File already exists in storage: {s3_key}"

        super().__init__(
            message=message,
            error_code="FILE_ALREADY_EXISTS",
            details=extra_details,
        )


class VersionConflictException(ConflictException):
    """版本冲突异常（乐观锁冲突）"""

    def __init__(
        self,
        resource_id: str,
        expected_version: int,
        actual_version: int,
        details: Optional[dict[str, Any]] = None,
    ):
        extra_details = details or {}
        extra_details.update({
            "resource_id": resource_id,
            "expected_version": expected_version,
            "actual_version": actual_version,
        })

        super().__init__(
            message=f"Version conflict for resource {resource_id}: expected version {expected_version}, but found {actual_version}",
            error_code="VERSION_CONFLICT",
            details=extra_details,
        )


class ConcurrentModificationException(ConflictException):
    """并发修改异常"""

    def __init__(
        self,
        resource_id: str,
        message: str = "Resource is being modified by another process",
        details: Optional[dict[str, Any]] = None,
    ):
        extra_details = details or {}
        extra_details["resource_id"] = resource_id

        super().__init__(
            message=message,
            error_code="CONCURRENT_MODIFICATION",
            details=extra_details,
        )


class ServiceUnavailableException(FileRendererException):
    """
    服务不可用异常

    包括：依赖服务故障、维护模式、资源耗尽等
    """

    def __init__(
        self,
        message: str = "Service temporarily unavailable",
        error_code: str = "SERVICE_UNAVAILABLE",
        retry_after: Optional[int] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        extra_details = details or {}
        if retry_after:
            extra_details["retry_after"] = retry_after

        super().__init__(
            message=message,
            error_code=error_code,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            details=extra_details,
        )


class DependencyServiceException(ServiceUnavailableException):
    """依赖服务异常"""

    def __init__(
        self,
        service_name: str,
        message: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        extra_details = details or {}
        extra_details["service_name"] = service_name

        super().__init__(
            message=message or f"Dependency service '{service_name}' is unavailable",
            error_code="DEPENDENCY_SERVICE_ERROR",
            details=extra_details,
        )


class MaintenanceModeException(ServiceUnavailableException):
    """维护模式异常"""

    def __init__(
        self,
        message: str = "Service is under maintenance",
        retry_after: Optional[int] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            error_code="MAINTENANCE_MODE",
            retry_after=retry_after,
            details=details,
        )


class ResourceExhaustedException(ServiceUnavailableException):
    """资源耗尽异常"""

    def __init__(
        self,
        resource_type: str,
        message: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        extra_details = details or {}
        extra_details["resource_type"] = resource_type

        super().__init__(
            message=message or f"Resource exhausted: {resource_type}",
            error_code="RESOURCE_EXHAUSTED",
            details=extra_details,
        )


class QuotaExceededException(FileRendererException):
    """配额超限异常"""

    def __init__(
        self,
        quota_type: str,
        limit: int,
        current: int,
        details: Optional[dict[str, Any]] = None,
    ):
        extra_details = details or {}
        extra_details.update({
            "quota_type": quota_type,
            "limit": limit,
            "current": current,
        })

        super().__init__(
            message=f"Quota exceeded for {quota_type}: {current}/{limit}",
            error_code="QUOTA_EXCEEDED",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            details=extra_details,
        )


class AuthenticationException(FileRendererException):
    """
    认证异常

    用户未认证或认证失败
    """

    def __init__(
        self,
        message: str = "Authentication required",
        error_code: str = "AUTHENTICATION_ERROR",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            error_code=error_code,
            status_code=status.HTTP_401_UNAUTHORIZED,
            details=details,
        )


class AuthorizationException(FileRendererException):
    """
    授权异常

    用户无权限访问资源
    """

    def __init__(
        self,
        message: str = "Access denied",
        resource: Optional[str] = None,
        action: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        extra_details = details or {}
        if resource:
            extra_details["resource"] = resource
        if action:
            extra_details["action"] = action

        super().__init__(
            message=message,
            error_code="AUTHORIZATION_ERROR",
            status_code=status.HTTP_403_FORBIDDEN,
            details=extra_details,
        )


class BadRequestException(FileRendererException):
    """
    错误请求异常

    请求格式错误或缺少必要参数
    """

    def __init__(
        self,
        message: str = "Bad request",
        error_code: str = "BAD_REQUEST",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            error_code=error_code,
            status_code=status.HTTP_400_BAD_REQUEST,
            details=details,
        )


class PayloadTooLargeException(FileRendererException):
    """请求体过大异常"""

    def __init__(
        self,
        max_size: int,
        actual_size: int,
        details: Optional[dict[str, Any]] = None,
    ):
        extra_details = details or {}
        extra_details.update({
            "max_size": max_size,
            "actual_size": actual_size,
            "max_size_mb": round(max_size / (1024 * 1024), 2),
            "actual_size_mb": round(actual_size / (1024 * 1024), 2),
        })

        super().__init__(
            message=f"Payload too large. Maximum size: {max_size} bytes, actual: {actual_size} bytes",
            error_code="PAYLOAD_TOO_LARGE",
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            details=extra_details,
        )


class MethodNotAllowedException(FileRendererException):
    """HTTP方法不允许异常"""

    def __init__(
        self,
        method: str,
        allowed_methods: list[str],
        details: Optional[dict[str, Any]] = None,
    ):
        extra_details = details or {}
        extra_details.update({
            "method": method,
            "allowed_methods": allowed_methods,
        })

        super().__init__(
            message=f"Method '{method}' not allowed. Allowed methods: {', '.join(allowed_methods)}",
            error_code="METHOD_NOT_ALLOWED",
            status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
            details=extra_details,
        )


class RequestEntityTooLargeException(FileRendererException):
    """请求实体过大异常（RFC 7231）"""

    def __init__(
        self,
        message: str = "Request entity too large",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            error_code="REQUEST_ENTITY_TOO_LARGE",
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            details=details,
        )
