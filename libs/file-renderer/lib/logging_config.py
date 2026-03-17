"""
结构化日志配置模块

提供 JSON 格式的结构化日志，支持可配置的日志级别和区分 access/error 日志。
"""

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any, Optional

from config import settings


class JSONFormatter(logging.Formatter):
    """
    JSON 格式日志格式化器

    将日志记录转换为 JSON 格式，便于日志收集和分析。
    """

    def __init__(
        self,
        include_extra: bool = True,
        default_fields: Optional[list[str]] = None,
    ):
        super().__init__()
        self.include_extra = include_extra
        self.default_fields = default_fields or [
            "timestamp",
            "level",
            "logger",
            "message",
            "module",
            "function",
            "line",
        ]

    def format(self, record: logging.LogRecord) -> str:
        """将日志记录格式化为 JSON"""
        log_data: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(
                record.created, tz=timezone.utc
            ).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # 添加异常信息
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # 添加堆栈信息
        if record.stack_info:
            log_data["stack_info"] = self.formatStack(record.stack_info)

        # 添加额外字段
        if self.include_extra:
            # 获取所有非默认字段
            extra_fields = {
                key: value
                for key, value in record.__dict__.items()
                if key not in logging.LogRecord(None, None, "", 0, "", (), None).__dict__
                and key not in ["message", "asctime", "exc_info", "exc_text", "stack_info"]
            }
            if extra_fields:
                log_data["extra"] = extra_fields

        return json.dumps(log_data, ensure_ascii=False, default=str)


class ColoredFormatter(logging.Formatter):
    """
    带颜色的控制台日志格式化器

    在开发环境中提供更友好的可读性。
    """

    COLORS = {
        "DEBUG": "\033[36m",      # Cyan
        "INFO": "\033[32m",       # Green
        "WARNING": "\033[33m",    # Yellow
        "ERROR": "\033[31m",      # Red
        "CRITICAL": "\033[35m",   # Magenta
        "RESET": "\033[0m",       # Reset
    }

    def __init__(self, fmt: Optional[str] = None, use_colors: bool = True):
        super().__init__(fmt or self._get_default_format())
        self.use_colors = use_colors

    def _get_default_format(self) -> str:
        return "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"

    def format(self, record: logging.LogRecord) -> str:
        """格式化日志记录，添加颜色"""
        if self.use_colors and sys.stdout.isatty():
            levelname = record.levelname
            if levelname in self.COLORS:
                record.levelname = f"{self.COLORS[levelname]}{levelname}{self.COLORS['RESET']}"

        return super().format(record)


def setup_logging(
    log_level: Optional[str] = None,
    json_format: Optional[bool] = None,
    access_log_file: Optional[str] = None,
    error_log_file: Optional[str] = None,
) -> None:
    """
    配置应用程序日志

    Args:
        log_level: 日志级别，默认从配置读取
        json_format: 是否使用 JSON 格式，生产环境建议 True
        access_log_file: access 日志文件路径
        error_log_file: error 日志文件路径
    """
    # 确定日志级别
    level = (log_level or settings.server.log_level).upper()
    numeric_level = getattr(logging, level, logging.INFO)

    # 确定格式
    use_json = json_format if json_format is not None else not settings.debug

    # 根日志配置
    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)

    # 清除现有处理器
    root_logger.handlers.clear()

    # 控制台处理器
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(numeric_level)

    if use_json:
        console_handler.setFormatter(JSONFormatter())
    else:
        console_handler.setFormatter(ColoredFormatter())

    root_logger.addHandler(console_handler)

    # Access 日志文件处理器
    if access_log_file:
        access_handler = logging.FileHandler(access_log_file, encoding="utf-8")
        access_handler.setLevel(logging.INFO)
        access_handler.setFormatter(JSONFormatter())

        # 创建 access 日志记录器
        access_logger = logging.getLogger("access")
        access_logger.setLevel(logging.INFO)
        access_logger.addHandler(access_handler)
        access_logger.propagate = False

    # Error 日志文件处理器
    if error_log_file:
        error_handler = logging.FileHandler(error_log_file, encoding="utf-8")
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(JSONFormatter())
        root_logger.addHandler(error_handler)

    # 配置第三方库日志级别
    logging.getLogger("boto3").setLevel(logging.WARNING)
    logging.getLogger("botocore").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("docling").setLevel(logging.WARNING)

    # 记录启动日志
    logger = logging.getLogger(__name__)
    logger.info(
        "Logging configured",
        extra={
            "log_level": level,
            "json_format": use_json,
            "access_log_file": access_log_file,
            "error_log_file": error_log_file,
        },
    )


def get_logger(name: str) -> logging.Logger:
    """
    获取配置好的日志记录器

    Args:
        name: 日志记录器名称，通常使用 __name__

    Returns:
        配置好的 Logger 实例
    """
    return logging.getLogger(name)


def get_access_logger() -> logging.Logger:
    """获取 access 日志记录器"""
    return logging.getLogger("access")


class LogContext:
    """
    日志上下文管理器

    用于在代码块中添加统一的上下文信息到日志。

    Example:
        with LogContext(request_id="123", user_id="456"):
            logger.info("Processing request")
            # 日志将包含 request_id 和 user_id 字段
    """

    def __init__(self, **context):
        self.context = context
        self.adapter: Optional[logging.LoggerAdapter] = None

    def __enter__(self):
        logger = logging.getLogger()
        self.adapter = logging.LoggerAdapter(logger, self.context)
        return self.adapter

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass


def log_access(
    method: str,
    path: str,
    status_code: int,
    duration_ms: float,
    client_ip: Optional[str] = None,
    user_agent: Optional[str] = None,
    request_id: Optional[str] = None,
    extra: Optional[dict[str, Any]] = None,
) -> None:
    """
    记录访问日志

    Args:
        method: HTTP 方法
        path: 请求路径
        status_code: HTTP 状态码
        duration_ms: 请求处理时间（毫秒）
        client_ip: 客户端 IP
        user_agent: 用户代理
        request_id: 请求 ID
        extra: 额外信息
    """
    logger = get_access_logger()

    log_data = {
        "method": method,
        "path": path,
        "status_code": status_code,
        "duration_ms": round(duration_ms, 2),
    }

    if client_ip:
        log_data["client_ip"] = client_ip
    if user_agent:
        log_data["user_agent"] = user_agent
    if request_id:
        log_data["request_id"] = request_id
    if extra:
        log_data.update(extra)

    logger.info("Access log", extra=log_data)


def log_error(
    error: Exception,
    message: Optional[str] = None,
    context: Optional[dict[str, Any]] = None,
) -> None:
    """
    记录错误日志

    Args:
        error: 异常对象
        message: 错误消息
        context: 上下文信息
    """
    logger = get_logger(__name__)

    log_data = {
        "error_type": type(error).__name__,
        "error_message": str(error),
    }

    if context:
        log_data["context"] = context

    logger.error(
        message or f"Error occurred: {error}",
        extra=log_data,
        exc_info=True,
    )
