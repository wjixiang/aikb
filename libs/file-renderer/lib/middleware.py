"""
FastAPI 中间件模块

提供日志记录、错误处理、性能监控、安全、压缩等中间件。
"""

import gzip
import io
import time
import uuid
from typing import Awaitable, Callable, Optional

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from lib.exceptions import FileRendererException, RateLimitException
from lib.logging_config import get_logger, log_access

logger = get_logger(__name__)


class RequestContext:
    """请求上下文，存储请求级别的信息"""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._request_id: Optional[str] = None
            cls._instance._start_time: Optional[float] = None
        return cls._instance

    @property
    def request_id(self) -> Optional[str]:
        return self._request_id

    @request_id.setter
    def request_id(self, value: str):
        self._request_id = value

    @property
    def start_time(self) -> Optional[float]:
        return self._start_time

    @start_time.setter
    def start_time(self, value: float):
        self._start_time = value

    def reset(self):
        self._request_id = None
        self._start_time = None


class LoggingMiddleware(BaseHTTPMiddleware):
    """
    请求/响应日志中间件

    记录每个请求的详细信息，包括：
    - 请求方法、路径、查询参数
    - 响应状态码
    - 处理时间
    - 客户端 IP
    - 请求 ID（用于链路追踪）
    """

    def __init__(
        self,
        app: FastAPI,
        exclude_paths: Optional[list[str]] = None,
        log_request_body: bool = False,
        log_response_body: bool = False,
    ):
        super().__init__(app)
        self.exclude_paths = exclude_paths or ["/health", "/", "/docs", "/openapi.json"]
        self.log_request_body = log_request_body
        self.log_response_body = log_response_body

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        # 生成请求 ID
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id

        # 记录开始时间
        start_time = time.time()

        # 获取客户端信息
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get("User-Agent", "")

        # 构建请求日志
        path = request.url.path
        query_params = str(request.query_params) if request.query_params else ""

        # 跳过健康检查等端点的详细日志
        should_log = path not in self.exclude_paths

        if should_log:
            logger.info(
                f"Request started: {request.method} {path}",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": path,
                    "query_params": query_params,
                    "client_ip": client_ip,
                    "user_agent": user_agent,
                },
            )

        try:
            # 处理请求
            response = await call_next(request)

            # 计算处理时间
            duration_ms = (time.time() - start_time) * 1000

            # 添加自定义响应头
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"

            # 记录访问日志
            log_access(
                method=request.method,
                path=path + (f"?{query_params}" if query_params else ""),
                status_code=response.status_code,
                duration_ms=duration_ms,
                client_ip=client_ip,
                user_agent=user_agent,
                request_id=request_id,
            )

            if should_log:
                logger.info(
                    f"Request completed: {request.method} {path} - {response.status_code}",
                    extra={
                        "request_id": request_id,
                        "method": request.method,
                        "path": path,
                        "status_code": response.status_code,
                        "duration_ms": round(duration_ms, 2),
                    },
                )

            return response

        except Exception as e:
            # 计算处理时间（即使出错）
            duration_ms = (time.time() - start_time) * 1000

            # 记录错误日志
            logger.error(
                f"Request failed: {request.method} {path} - {type(e).__name__}: {e}",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": path,
                    "error_type": type(e).__name__,
                    "error_message": str(e),
                    "duration_ms": round(duration_ms, 2),
                },
                exc_info=True,
            )

            # 重新抛出异常，让错误处理器处理
            raise

    def _get_client_ip(self, request: Request) -> str:
        """获取客户端真实 IP"""
        # 优先从代理头获取
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()

        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        # 直接连接
        if request.client:
            return request.client.host

        return "unknown"


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """
    错误处理中间件

    捕获所有未处理的异常，统一返回标准错误响应格式。
    """

    def __init__(
        self,
        app: FastAPI,
        include_traceback: bool = False,
    ):
        super().__init__(app)
        self.include_traceback = include_traceback

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        try:
            return await call_next(request)
        except FileRendererException as e:
            # 自定义异常，使用预定义的错误响应
            logger.warning(
                f"Business exception: {e.error_code} - {e.message}",
                extra={
                    "request_id": getattr(request.state, "request_id", None),
                    "error_code": e.error_code,
                    "error_details": e.details,
                },
            )
            return JSONResponse(
                status_code=e.status_code,
                content=e.to_dict(),
            )
        except Exception as e:
            # 未预期的异常
            request_id = getattr(request.state, "request_id", None)

            logger.error(
                f"Unhandled exception: {type(e).__name__}: {e}",
                extra={
                    "request_id": request_id,
                    "error_type": type(e).__name__,
                },
                exc_info=True,
            )

            error_response = {
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An unexpected error occurred",
                    "details": {},
                },
            }

            # 调试模式下包含详细信息
            if self.include_traceback:
                import traceback

                error_response["error"]["details"] = {
                    "exception_type": type(e).__name__,
                    "exception_message": str(e),
                    "traceback": traceback.format_exc(),
                }

            return JSONResponse(
                status_code=500,
                content=error_response,
            )


class PerformanceMonitoringMiddleware(BaseHTTPMiddleware):
    """
    性能监控中间件

    监控请求处理时间，对慢请求发出警告。
    """

    def __init__(
        self,
        app: FastAPI,
        slow_request_threshold_ms: float = 1000.0,
        exclude_paths: Optional[list[str]] = None,
    ):
        super().__init__(app)
        self.slow_request_threshold_ms = slow_request_threshold_ms
        self.exclude_paths = exclude_paths or ["/health", "/"]

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        start_time = time.time()

        response = await call_next(request)

        duration_ms = (time.time() - start_time) * 1000
        path = request.url.path

        # 跳过排除的路径
        if path in self.exclude_paths:
            return response

        # 记录性能指标
        extra = {
            "request_id": getattr(request.state, "request_id", None),
            "method": request.method,
            "path": path,
            "duration_ms": round(duration_ms, 2),
            "status_code": response.status_code,
        }

        # 慢请求警告
        if duration_ms > self.slow_request_threshold_ms:
            logger.warning(
                f"Slow request detected: {request.method} {path} took {duration_ms:.2f}ms",
                extra=extra,
            )
        else:
            logger.debug(
                f"Request timing: {request.method} {path} took {duration_ms:.2f}ms",
                extra=extra,
            )

        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    安全响应头中间件

    添加常见的安全响应头。
    """

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)

        # 安全响应头
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        return response


class CORSMiddlewareConfig:
    """
    CORS 中间件配置

    提供 CORS 配置的便捷方法。
    """

    @staticmethod
    def get_config() -> dict:
        """获取 CORS 配置"""
        return {
            "allow_origins": ["*"],  # 生产环境应配置具体域名
            "allow_credentials": True,
            "allow_methods": ["*"],
            "allow_headers": ["*"],
            "expose_headers": ["X-Request-ID", "X-Response-Time"],
        }


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    请求ID中间件

    为每个请求生成或复用唯一的请求ID，用于链路追踪。
    支持从请求头获取 X-Request-ID，如果没有则生成新的 UUID。
    """

    def __init__(
        self,
        app: FastAPI,
        header_name: str = "X-Request-ID",
        generator: Optional[Callable[[], str]] = None,
    ):
        super().__init__(app)
        self.header_name = header_name
        self.generator = generator or (lambda: str(uuid.uuid4()))

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        # 从请求头获取或生成请求ID
        request_id = request.headers.get(self.header_name)
        if not request_id:
            request_id = self.generator()

        # 存储到请求状态
        request.state.request_id = request_id

        # 处理请求
        response = await call_next(request)

        # 添加请求ID到响应头
        response.headers[self.header_name] = request_id

        return response


class TimingMiddleware(BaseHTTPMiddleware):
    """
    计时中间件

    精确记录请求处理时间，添加 X-Response-Time 响应头。
    支持微秒级精度计时。
    """

    def __init__(
        self,
        app: FastAPI,
        header_name: str = "X-Response-Time",
        precision: int = 3,
    ):
        super().__init__(app)
        self.header_name = header_name
        self.precision = precision

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        start_time = time.perf_counter()

        response = await call_next(request)

        # 计算处理时间
        duration_ms = (time.perf_counter() - start_time) * 1000

        # 添加到响应头
        response.headers[self.header_name] = f"{duration_ms:.{self.precision}f}ms"

        # 存储到请求状态供其他中间件使用
        request.state.response_time_ms = duration_ms

        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    速率限制中间件

    基于客户端IP的简单速率限制实现。
    生产环境建议使用 Redis 等分布式存储。
    """

    def __init__(
        self,
        app: FastAPI,
        requests_per_minute: int = 60,
        burst_size: int = 10,
        exclude_paths: Optional[list[str]] = None,
        key_prefix: str = "ratelimit",
    ):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.burst_size = burst_size
        self.exclude_paths = exclude_paths or ["/health", "/docs", "/openapi.json"]
        self.key_prefix = key_prefix

        # 内存存储请求计数（生产环境应使用 Redis）
        self._requests: dict[str, list[float]] = {}

    def _get_client_key(self, request: Request) -> str:
        """获取客户端标识"""
        # 优先从代理头获取真实IP
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        else:
            real_ip = request.headers.get("X-Real-IP")
            if real_ip:
                client_ip = real_ip
            elif request.client:
                client_ip = request.client.host
            else:
                client_ip = "unknown"

        return f"{self.key_prefix}:{client_ip}"

    def _is_rate_limited(self, key: str) -> tuple[bool, int]:
        """
        检查是否超过速率限制

        Returns:
            (是否受限, 重试等待秒数)
        """
        now = time.time()
        window_start = now - 60  # 1分钟窗口

        # 获取该客户端的请求历史
        requests = self._requests.get(key, [])

        # 清理过期请求
        requests = [t for t in requests if t > window_start]

        # 检查是否超过限制
        if len(requests) >= self.requests_per_minute:
            # 计算需要等待的时间
            oldest_request = min(requests)
            retry_after = int(60 - (now - oldest_request)) + 1
            return True, max(retry_after, 1)

        # 更新请求记录
        requests.append(now)
        self._requests[key] = requests

        return False, 0

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        path = request.url.path

        # 跳过排除的路径
        if path in self.exclude_paths:
            return await call_next(request)

        # 获取客户端标识
        client_key = self._get_client_key(request)

        # 检查速率限制
        is_limited, retry_after = self._is_rate_limited(client_key)

        if is_limited:
            logger.warning(
                f"Rate limit exceeded for {client_key}",
                extra={
                    "client_key": client_key,
                    "path": path,
                    "retry_after": retry_after,
                },
            )

            raise RateLimitException(
                message=f"Rate limit exceeded. Try again in {retry_after} seconds.",
                retry_after=retry_after,
            )

        # 添加速率限制信息到响应头
        response = await call_next(request)

        remaining = max(0, self.requests_per_minute - len(self._requests.get(client_key, [])))
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(remaining)

        return response


class GzipMiddleware(BaseHTTPMiddleware):
    """
    Gzip 压缩中间件

    对响应内容进行 Gzip 压缩，减少传输大小。
    仅压缩文本内容类型，且大小超过阈值时启用。
    """

    def __init__(
        self,
        app: FastAPI,
        minimum_size: int = 1024,
        compress_level: int = 6,
        exclude_paths: Optional[list[str]] = None,
    ):
        super().__init__(app)
        self.minimum_size = minimum_size
        self.compress_level = compress_level
        self.exclude_paths = exclude_paths or []

    def _should_compress(self, response: Response) -> bool:
        """判断是否应该压缩响应"""
        # 检查是否已编码
        if response.headers.get("Content-Encoding"):
            return False

        # 检查内容类型
        content_type = response.headers.get("Content-Type", "")
        compressible_types = [
            "text/",
            "application/json",
            "application/xml",
            "application/javascript",
            "application/rss+xml",
            "application/atom+xml",
            "image/svg+xml",
        ]

        if not any(content_type.startswith(t) for t in compressible_types):
            return False

        return True

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        # 检查客户端是否支持 gzip
        accept_encoding = request.headers.get("Accept-Encoding", "")
        supports_gzip = "gzip" in accept_encoding

        response = await call_next(request)

        # 跳过排除的路径
        if request.url.path in self.exclude_paths:
            return response

        # 检查是否应该压缩
        if not supports_gzip or not self._should_compress(response):
            return response

        # 获取响应体
        body = b""
        async for chunk in response.body_iterator:
            if isinstance(chunk, str):
                body += chunk.encode("utf-8")
            else:
                body += chunk

        # 检查大小是否超过阈值
        if len(body) < self.minimum_size:
            # 重新构建响应
            return Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )

        # 压缩内容
        compressed = gzip.compress(body, compresslevel=self.compress_level)

        # 更新响应头
        headers = dict(response.headers)
        headers["Content-Encoding"] = "gzip"
        headers["Content-Length"] = str(len(compressed))
        headers["Vary"] = "Accept-Encoding"

        # 移除 Content-Range（如果存在）
        headers.pop("Content-Range", None)

        return Response(
            content=compressed,
            status_code=response.status_code,
            headers=headers,
            media_type=response.media_type,
        )


class CORSMiddlewareOptimized(BaseHTTPMiddleware):
    """
    优化的 CORS 中间件

    提供更灵活的 CORS 配置，支持动态 origin 检查。
    """

    def __init__(
        self,
        app: FastAPI,
        allow_origins: list[str] | str = "*",
        allow_credentials: bool = True,
        allow_methods: list[str] | str = "*",
        allow_headers: list[str] | str = "*",
        expose_headers: Optional[list[str]] = None,
        max_age: int = 600,
        allow_origin_regex: Optional[str] = None,
    ):
        super().__init__(app)
        self.allow_origins = allow_origins if isinstance(allow_origins, list) else [allow_origins]
        self.allow_all_origins = "*" in self.allow_origins
        self.allow_credentials = allow_credentials
        self.allow_methods = allow_methods if isinstance(allow_methods, list) else ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
        self.allow_all_methods = allow_methods == "*"
        self.allow_headers = allow_headers if isinstance(allow_headers, list) else []
        self.allow_all_headers = allow_headers == "*"
        self.expose_headers = expose_headers or []
        self.max_age = max_age
        self.allow_origin_regex = allow_origin_regex

        if self.allow_origin_regex:
            import re
            self._origin_regex = re.compile(self.allow_origin_regex)
        else:
            self._origin_regex = None

    def _is_origin_allowed(self, origin: str) -> bool:
        """检查 origin 是否被允许"""
        if self.allow_all_origins:
            return True

        if origin in self.allow_origins:
            return True

        if self._origin_regex and self._origin_regex.match(origin):
            return True

        return False

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        origin = request.headers.get("Origin")

        # 处理预检请求
        if request.method == "OPTIONS":
            response = Response(status_code=204)

            if origin and self._is_origin_allowed(origin):
                if self.allow_all_origins and not self.allow_credentials:
                    response.headers["Access-Control-Allow-Origin"] = "*"
                else:
                    response.headers["Access-Control-Allow-Origin"] = origin

                if self.allow_credentials:
                    response.headers["Access-Control-Allow-Credentials"] = "true"

                if self.allow_all_methods:
                    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS"
                else:
                    response.headers["Access-Control-Allow-Methods"] = ", ".join(self.allow_methods)

                requested_headers = request.headers.get("Access-Control-Request-Headers")
                if requested_headers:
                    if self.allow_all_headers:
                        response.headers["Access-Control-Allow-Headers"] = requested_headers
                    else:
                        response.headers["Access-Control-Allow-Headers"] = ", ".join(self.allow_headers)

                if self.expose_headers:
                    response.headers["Access-Control-Expose-Headers"] = ", ".join(self.expose_headers)

                response.headers["Access-Control-Max-Age"] = str(self.max_age)

            return response

        # 处理实际请求
        response = await call_next(request)

        if origin and self._is_origin_allowed(origin):
            if self.allow_all_origins and not self.allow_credentials:
                response.headers["Access-Control-Allow-Origin"] = "*"
            else:
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Vary"] = "Origin"

            if self.allow_credentials:
                response.headers["Access-Control-Allow-Credentials"] = "true"

            if self.expose_headers:
                response.headers["Access-Control-Expose-Headers"] = ", ".join(self.expose_headers)

        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    安全响应头中间件

    添加常见的安全响应头，增强应用安全性。
    """

    def __init__(
        self,
        app: FastAPI,
        content_security_policy: Optional[str] = None,
        strict_transport_security: str = "max-age=31536000; includeSubDomains",
        x_frame_options: str = "DENY",
        x_content_type_options: str = "nosniff",
        referrer_policy: str = "strict-origin-when-cross-origin",
        permissions_policy: Optional[str] = None,
    ):
        super().__init__(app)
        self.content_security_policy = content_security_policy or "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'"
        self.strict_transport_security = strict_transport_security
        self.x_frame_options = x_frame_options
        self.x_content_type_options = x_content_type_options
        self.referrer_policy = referrer_policy
        self.permissions_policy = permissions_policy or "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)

        # 安全响应头
        response.headers["X-Content-Type-Options"] = self.x_content_type_options
        response.headers["X-Frame-Options"] = self.x_frame_options
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = self.strict_transport_security
        response.headers["Referrer-Policy"] = self.referrer_policy
        response.headers["Content-Security-Policy"] = self.content_security_policy
        response.headers["Permissions-Policy"] = self.permissions_policy

        # 可选：移除服务器标识
        if "Server" in response.headers:
            del response.headers["Server"]

        return response


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """
    请求大小限制中间件

    限制请求体大小，防止大请求导致内存问题。
    """

    def __init__(
        self,
        app: FastAPI,
        max_body_size: int = 100 * 1024 * 1024,  # 100MB
    ):
        super().__init__(app)
        self.max_body_size = max_body_size

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        # 检查 Content-Length 头
        content_length = request.headers.get("Content-Length")
        if content_length:
            size = int(content_length)
            if size > self.max_body_size:
                from lib.exceptions import PayloadTooLargeException
                raise PayloadTooLargeException(
                    max_size=self.max_body_size,
                    actual_size=size,
                )

        return await call_next(request)
