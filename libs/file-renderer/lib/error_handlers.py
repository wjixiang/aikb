"""
全局错误处理模块

提供统一的异常处理函数，处理各种类型的异常并返回标准化的错误响应。
"""

import traceback
from typing import Any, Callable, TypeVar

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from lib.exceptions import FileRendererException
from lib.logging_config import get_logger

logger = get_logger(__name__)

T = TypeVar("T")


def create_error_response(
    message: str,
    error_code: str,
    status_code: int,
    details: dict[str, Any] | None = None,
    errors: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    创建统一的错误响应格式

    Args:
        message: 错误消息
        error_code: 错误代码
        status_code: HTTP 状态码
        details: 额外错误详情
        errors: 详细错误列表（用于验证错误）

    Returns:
        标准化的错误响应字典
    """
    from datetime import datetime, timezone

    response: dict[str, Any] = {
        "success": False,
        "message": message,
        "error_code": error_code,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if details:
        response["details"] = details

    if errors:
        response["errors"] = errors

    return response


async def file_renderer_exception_handler(
    request: Request,
    exc: FileRendererException,
) -> JSONResponse:
    """
    处理 FileRendererException 及其子类异常

    这是主要的业务异常处理器，处理所有自定义的业务异常。
    """
    request_id = getattr(request.state, "request_id", None)

    logger.warning(
        f"Business exception: {exc.error_code} - {exc.message}",
        extra={
            "request_id": request_id,
            "error_code": exc.error_code,
            "status_code": exc.status_code,
            "path": request.url.path,
            "method": request.method,
            "error_details": exc.details,
        },
    )

    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict(),
    )


async def http_exception_handler(
    request: Request,
    exc: StarletteHTTPException,
) -> JSONResponse:
    """
    处理 FastAPI/Starlette HTTPException

    处理框架抛出的 HTTP 异常，如 404 Not Found 等。
    """
    request_id = getattr(request.state, "request_id", None)

    # 将 HTTPException 映射到标准错误代码
    error_code_map = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        406: "NOT_ACCEPTABLE",
        408: "REQUEST_TIMEOUT",
        409: "CONFLICT",
        410: "GONE",
        411: "LENGTH_REQUIRED",
        412: "PRECONDITION_FAILED",
        413: "PAYLOAD_TOO_LARGE",
        414: "URI_TOO_LONG",
        415: "UNSUPPORTED_MEDIA_TYPE",
        416: "RANGE_NOT_SATISFIABLE",
        417: "EXPECTATION_FAILED",
        418: "IM_A_TEAPOT",
        422: "UNPROCESSABLE_ENTITY",
        429: "TOO_MANY_REQUESTS",
        500: "INTERNAL_SERVER_ERROR",
        501: "NOT_IMPLEMENTED",
        502: "BAD_GATEWAY",
        503: "SERVICE_UNAVAILABLE",
        504: "GATEWAY_TIMEOUT",
    }

    error_code = error_code_map.get(exc.status_code, "HTTP_ERROR")

    logger.warning(
        f"HTTP exception: {exc.status_code} - {exc.detail}",
        extra={
            "request_id": request_id,
            "status_code": exc.status_code,
            "error_code": error_code,
            "path": request.url.path,
            "method": request.method,
        },
    )

    # 处理 headers（如 429 的 Retry-After）
    headers = {}
    if exc.status_code == 429:
        headers["Retry-After"] = "60"

    content = create_error_response(
        message=str(exc.detail),
        error_code=error_code,
        status_code=exc.status_code,
    )

    return JSONResponse(
        status_code=exc.status_code,
        content=content,
        headers=headers,
    )


async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """
    处理请求验证错误

    处理 Pydantic 模型验证失败、请求参数格式错误等。
    """
    request_id = getattr(request.state, "request_id", None)

    # 格式化验证错误
    errors: list[dict[str, Any]] = []
    for error in exc.errors():
        error_detail = {
            "field": ".".join(str(x) for x in error["loc"]),
            "message": error["msg"],
            "code": error.get("type", "VALIDATION_ERROR"),
        }

        # 添加上下文信息
        if "input" in error:
            input_value = error["input"]
            # 避免在日志中记录敏感信息
            if isinstance(input_value, str) and len(input_value) > 100:
                input_value = input_value[:100] + "..."
            error_detail["context"] = {"input": input_value}

        errors.append(error_detail)

    # 构建友好的错误消息
    field_names = [e["field"] for e in errors if e["field"]]
    if field_names:
        message = f"Validation failed for fields: {', '.join(field_names[:3])}"
        if len(field_names) > 3:
            message += f" and {len(field_names) - 3} more"
    else:
        message = "Request validation failed"

    logger.warning(
        f"Validation error: {message}",
        extra={
            "request_id": request_id,
            "error_code": "VALIDATION_ERROR",
            "path": request.url.path,
            "method": request.method,
            "validation_errors": errors,
        },
    )

    content = create_error_response(
        message=message,
        error_code="VALIDATION_ERROR",
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        errors=errors,
    )

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=content,
    )


async def unhandled_exception_handler(
    request: Request,
    exc: Exception,
    include_traceback: bool = False,
) -> JSONResponse:
    """
    处理未捕获的异常

    作为最后的防线，处理所有未被其他处理器捕获的异常。
    """
    request_id = getattr(request.state, "request_id", None)

    # 记录详细错误信息
    logger.error(
        f"Unhandled exception: {type(exc).__name__}: {exc}",
        extra={
            "request_id": request_id,
            "error_type": type(exc).__name__,
            "path": request.url.path,
            "method": request.method,
        },
        exc_info=True,
    )

    details: dict[str, Any] = {}

    # 调试模式下包含详细信息
    if include_traceback:
        details = {
            "exception_type": type(exc).__name__,
            "exception_message": str(exc),
            "traceback": traceback.format_exc(),
        }

    content = create_error_response(
        message="An unexpected error occurred. Please try again later.",
        error_code="INTERNAL_ERROR",
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        details=details if include_traceback else None,
    )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=content,
    )


async def not_found_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """
    处理 404 Not Found

    专门处理资源不存在的情况，提供更友好的错误消息。
    """
    request_id = getattr(request.state, "request_id", None)

    logger.warning(
        f"Resource not found: {request.url.path}",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "method": request.method,
        },
    )

    content = create_error_response(
        message=f"The requested resource '{request.url.path}' was not found",
        error_code="NOT_FOUND",
        status_code=status.HTTP_404_NOT_FOUND,
        details={
            "path": request.url.path,
            "method": request.method,
        },
    )

    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content=content,
    )


async def method_not_allowed_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """
    处理 405 Method Not Allowed

    处理 HTTP 方法不允许的情况。
    """
    request_id = getattr(request.state, "request_id", None)

    logger.warning(
        f"Method not allowed: {request.method} {request.url.path}",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "method": request.method,
        },
    )

    content = create_error_response(
        message=f"Method '{request.method}' is not allowed for this resource",
        error_code="METHOD_NOT_ALLOWED",
        status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
        details={
            "path": request.url.path,
            "method": request.method,
        },
    )

    return JSONResponse(
        status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
        content=content,
    )


def register_exception_handlers(app: Any, include_traceback: bool = False) -> None:
    """
    注册所有异常处理器到 FastAPI 应用

    Args:
        app: FastAPI 应用实例
        include_traceback: 是否在错误响应中包含堆栈跟踪（仅用于调试）
    """
    # 业务异常处理器（最高优先级）
    app.add_exception_handler(FileRendererException, file_renderer_exception_handler)

    # HTTP 异常处理器
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)

    # 验证错误处理器
    app.add_exception_handler(RequestValidationError, validation_exception_handler)

    # 创建带有配置选项的未处理异常处理器
    async def _unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
        return await unhandled_exception_handler(
            request, exc, include_traceback=include_traceback
        )

    # 通用异常处理器（最低优先级）
    app.add_exception_handler(Exception, _unhandled_handler)

    logger.info(
        "Exception handlers registered",
        extra={
            "include_traceback": include_traceback,
        },
    )


def handle_exception_safely(
    func: Callable[..., T],
    *args: Any,
    **kwargs: Any,
) -> tuple[bool, T | None, Exception | None]:
    """
    安全地执行函数，捕获所有异常

    Args:
        func: 要执行的函数
        *args: 位置参数
        **kwargs: 关键字参数

    Returns:
        (success, result, exception) 元组
    """
    try:
        result = func(*args, **kwargs)
        return True, result, None
    except Exception as e:
        logger.error(
            f"Exception in {func.__name__}: {type(e).__name__}: {e}",
            extra={
                "function": func.__name__,
                "error_type": type(e).__name__,
            },
            exc_info=True,
        )
        return False, None, e
