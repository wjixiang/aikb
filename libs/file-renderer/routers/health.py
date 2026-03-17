"""
健康检查路由模块

提供多种健康检查端点，支持 Kubernetes 探针和监控需求。
"""

import asyncio
from datetime import datetime, timezone
from typing import Any

import boto3
from botocore.exceptions import ClientError
from fastapi import APIRouter, status
from pydantic import BaseModel, Field

from config import settings
from lib.logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["health"])


class HealthStatus(BaseModel):
    """基础健康检查状态"""

    status: str = Field(..., description="服务状态: healthy/degraded/unhealthy")
    version: str = Field(..., description="服务版本")
    timestamp: str = Field(..., description="检查时间戳")


class DetailedHealthStatus(HealthStatus):
    """详细健康检查状态"""

    s3_connected: bool = Field(..., description="S3 存储连接状态")
    database_connected: bool = Field(..., description="数据库连接状态")
    checks: dict[str, Any] = Field(default_factory=dict, description="各组件检查详情")
    uptime_seconds: float = Field(..., description="服务运行时间(秒)")


class ComponentStatus(BaseModel):
    """组件状态详情"""

    name: str = Field(..., description="组件名称")
    status: str = Field(..., description="组件状态: up/down/degraded")
    response_time_ms: float = Field(..., description="响应时间(毫秒)")
    message: str = Field(default="", description="状态消息")
    details: dict[str, Any] = Field(default_factory=dict, description="额外详情")


class ReadinessStatus(BaseModel):
    """就绪探针状态"""

    ready: bool = Field(..., description="是否就绪")
    timestamp: str = Field(..., description="检查时间戳")
    checks: list[ComponentStatus] = Field(default_factory=list, description="组件检查列表")


class LivenessStatus(BaseModel):
    """存活探针状态"""

    alive: bool = Field(..., description="是否存活")
    timestamp: str = Field(..., description="检查时间戳")


# 服务启动时间
_startup_time = datetime.now(timezone.utc)


async def check_s3_health() -> ComponentStatus:
    """检查 S3 存储健康状态"""
    start_time = datetime.now(timezone.utc)

    try:
        s3_client = boto3.client(
            "s3",
            endpoint_url=f"https://{settings.s3.endpoint}",
            aws_access_key_id=settings.s3.access_key_id,
            aws_secret_access_key=settings.s3.access_key_secret,
            region_name=settings.s3.region,
        )

        # 尝试列出存储桶或检查指定存储桶
        s3_client.head_bucket(Bucket=settings.s3.bucket)

        response_time = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000

        return ComponentStatus(
            name="s3_storage",
            status="up",
            response_time_ms=round(response_time, 2),
            message=f"S3 bucket '{settings.s3.bucket}' is accessible",
        )

    except ClientError as e:
        response_time = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
        error_code = e.response.get("Error", {}).get("Code", "Unknown")

        return ComponentStatus(
            name="s3_storage",
            status="down" if error_code in ["NoSuchBucket", "404"] else "degraded",
            response_time_ms=round(response_time, 2),
            message=f"S3 check failed: {error_code}",
            details={"error_code": error_code},
        )

    except Exception as e:
        response_time = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000

        return ComponentStatus(
            name="s3_storage",
            status="down",
            response_time_ms=round(response_time, 2),
            message=f"S3 check failed: {str(e)}",
            details={"error": str(e)},
        )


async def check_database_health() -> ComponentStatus:
    """检查数据库健康状态"""
    start_time = datetime.now(timezone.utc)

    try:
        # 使用 models.database 中的检查函数
        from models.database import check_database_connection_async

        is_healthy = await check_database_connection_async()

        response_time = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000

        if is_healthy:
            return ComponentStatus(
                name="database",
                status="up",
                response_time_ms=round(response_time, 2),
                message="Database connection is healthy",
            )
        else:
            return ComponentStatus(
                name="database",
                status="down",
                response_time_ms=round(response_time, 2),
                message="Database connection check returned False",
            )

    except Exception as e:
        response_time = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000

        return ComponentStatus(
            name="database",
            status="down",
            response_time_ms=round(response_time, 2),
            message=f"Database check failed: {str(e)}",
            details={"error": str(e)},
        )


@router.get(
    "/health",
    response_model=HealthStatus,
    summary="基础健康检查",
    description="""
    基础健康检查端点，返回服务基本运行状态。

    适用于:
    - 负载均衡器健康检查
    - 简单监控
    - 快速状态确认

    返回 200 表示服务正在运行。
    """,
    responses={
        200: {"description": "服务正常运行"},
        503: {"description": "服务不可用"},
    },
)
async def health_check() -> HealthStatus:
    """基础健康检查"""
    return HealthStatus(
        status="healthy",
        version=settings.app_version,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@router.get(
    "/health/detailed",
    response_model=DetailedHealthStatus,
    summary="详细健康检查",
    description="""
    详细健康检查端点，返回服务及各依赖组件的详细状态。

    检查项:
    - 服务运行状态
    - S3 存储连接
    - 数据库连接
    - 各组件响应时间
    - 服务运行时间

    适用于:
    - 详细监控
    - 故障排查
    - 性能分析
    """,
    responses={
        200: {"description": "服务正常运行"},
        503: {"description": "服务或依赖组件异常"},
    },
)
async def detailed_health_check() -> DetailedHealthStatus:
    """详细健康检查"""
    # 并行检查各组件
    s3_check, db_check = await asyncio.gather(
        check_s3_health(),
        check_database_health(),
    )

    # 确定整体状态
    component_statuses = [s3_check.status, db_check.status]

    if all(s == "up" for s in component_statuses):
        overall_status = "healthy"
    elif any(s == "up" for s in component_statuses):
        overall_status = "degraded"
    else:
        overall_status = "unhealthy"

    # 计算运行时间
    uptime = (datetime.now(timezone.utc) - _startup_time).total_seconds()

    return DetailedHealthStatus(
        status=overall_status,
        version=settings.app_version,
        timestamp=datetime.now(timezone.utc).isoformat(),
        s3_connected=s3_check.status == "up",
        database_connected=db_check.status == "up",
        checks={
            "s3": s3_check.model_dump(),
            "database": db_check.model_dump(),
        },
        uptime_seconds=round(uptime, 2),
    )


@router.get(
    "/health/ready",
    response_model=ReadinessStatus,
    summary="就绪探针",
    description="""
    Kubernetes 就绪探针端点。

    检查服务是否准备好接收流量。
    当服务正在启动或依赖组件不可用时返回 503。

    检查项:
    - 数据库连接
    - S3 存储连接
    - 必要的初始化是否完成

    适用于:
    - Kubernetes readinessProbe
    - 流量切换决策
    """,
    responses={
        200: {"description": "服务已就绪"},
        503: {"description": "服务未就绪"},
    },
)
async def readiness_check() -> ReadinessStatus:
    """就绪探针 - 检查服务是否准备好接收流量"""
    # 检查关键依赖
    s3_check, db_check = await asyncio.gather(
        check_s3_health(),
        check_database_health(),
    )

    checks = [s3_check, db_check]

    # 服务就绪条件：所有关键组件都正常
    is_ready = all(c.status == "up" for c in checks)

    status_code = status.HTTP_200_OK if is_ready else status.HTTP_503_SERVICE_UNAVAILABLE

    response = ReadinessStatus(
        ready=is_ready,
        timestamp=datetime.now(timezone.utc).isoformat(),
        checks=checks,
    )

    # 记录未就绪情况
    if not is_ready:
        failed_checks = [c.name for c in checks if c.status != "up"]
        logger.warning(
            f"Readiness check failed: {', '.join(failed_checks)} not ready",
            extra={"failed_checks": failed_checks},
        )

    return response


@router.get(
    "/health/live",
    response_model=LivenessStatus,
    summary="存活探针",
    description="""
    Kubernetes 存活探针端点。

    检查服务是否还在运行，是否需要重启。
    只要服务进程还在就返回 200。

    适用于:
    - Kubernetes livenessProbe
    - 自动故障恢复

    注意: 此端点不应检查依赖组件，
    只检查服务本身是否存活。
    """,
    responses={
        200: {"description": "服务存活"},
        503: {"description": "服务无响应"},
    },
)
async def liveness_check() -> LivenessStatus:
    """存活探针 - 检查服务是否还在运行"""
    return LivenessStatus(
        alive=True,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@router.get(
    "/health/metrics",
    summary="服务指标",
    description="""
    返回服务运行指标（简化版）。

    指标包括:
    - 服务运行时间
    - 版本信息
    - 配置摘要

    注意: 生产环境建议使用专门的指标端点如 /metrics (Prometheus 格式)
    """,
)
async def health_metrics() -> dict[str, Any]:
    """服务运行指标"""
    uptime = (datetime.now(timezone.utc) - _startup_time).total_seconds()

    return {
        "uptime_seconds": round(uptime, 2),
        "uptime_formatted": _format_duration(uptime),
        "version": settings.app_version,
        "app_name": settings.app_name,
        "debug_mode": settings.debug,
        "config": {
            "s3_bucket": settings.s3.bucket,
            "s3_region": settings.s3.region,
            "max_file_size_mb": settings.conversion.max_file_size // (1024 * 1024),
            "default_page_size": settings.pagination.default_page_size,
        },
    }


def _format_duration(seconds: float) -> str:
    """格式化持续时间"""
    days = int(seconds // 86400)
    hours = int((seconds % 86400) // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)

    parts = []
    if days > 0:
        parts.append(f"{days}d")
    if hours > 0:
        parts.append(f"{hours}h")
    if minutes > 0:
        parts.append(f"{minutes}m")
    parts.append(f"{secs}s")

    return " ".join(parts)
