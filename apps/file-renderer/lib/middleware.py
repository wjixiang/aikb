"""
FastAPI middleware

Custom middleware for logging, error handling, and timing.
"""

import logging
import time
from typing import Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from lib.logging_config import get_logger

logger = get_logger(__name__)


class LoggingMiddleware(BaseHTTPMiddleware):
    """Request/response logging middleware"""

    def __init__(self, app: ASGIApp, exclude_paths: list[str] | None = None):
        super().__init__(app)
        self.exclude_paths = exclude_paths or ["/health", "/", "/docs", "/redoc"]

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request and log"""
        # Skip logging for excluded paths
        if any(request.url.path.startswith(path) for path in self.exclude_paths):
            return await call_next(request)

        start_time = time.time()

        # Log request
        logger.info(
            f"Request: {request.method} {request.url.path}",
            extra={
                "method": request.method,
                "path": request.url.path,
                "query_params": str(request.query_params),
            },
        )

        # Process request
        response = await call_next(request)

        # Calculate duration
        duration = time.time() - start_time

        # Log response
        logger.info(
            f"Response: {response.status_code} ({duration:.3f}s)",
            extra={
                "status_code": response.status_code,
                "duration_ms": duration * 1000,
            },
        )

        # Add timing header
        response.headers["X-Response-Time"] = f"{duration:.3f}s"

        return response


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Global error handling middleware"""

    def __init__(self, app: ASGIApp, include_traceback: bool = False):
        super().__init__(app)
        self.include_traceback = include_traceback

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request and handle errors"""
        try:
            return await call_next(request)
        except Exception as e:
            logger.error(
                f"Unhandled error: {e}",
                exc_info=self.include_traceback,
                extra={
                    "path": request.url.path,
                    "method": request.method,
                },
            )

            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "message": "Internal server error",
                    "error": str(e) if self.include_traceback else "An error occurred",
                },
            )


class TimingMiddleware(BaseHTTPMiddleware):
    """Request timing middleware"""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Add timing information to response"""
        start_time = time.time()
        response = await call_next(request)
        duration = time.time() - start_time

        response.headers["X-Process-Time"] = str(duration)

        return response
