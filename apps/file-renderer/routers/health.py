"""
Health check API router

Provides health status and service readiness endpoints.
"""

import logging
from datetime import datetime

from fastapi import APIRouter

from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get(
    "/",
    summary="Service root",
    description="Get service information",
)
async def root():
    """Service root endpoint"""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "timestamp": datetime.utcnow().isoformat(),
        "docs_url": "/docs",
        "redoc_url": "/redoc",
    }


@router.get(
    "/health",
    summary="Health check",
    description="Check service health",
)
async def health_check():
    """Basic health check"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": settings.app_name,
        "version": settings.app_version,
    }


@router.get(
    "/health/ready",
    summary="Readiness check",
    description="Check if service is ready to handle requests",
)
async def readiness_check():
    """Readiness check including database and S3 connectivity"""
    checks = {"status": "ready"}

    # Check database
    try:
        from models import check_db

        if await check_db():
            checks["database"] = "connected"
        else:
            checks["database"] = "unreachable"
            checks["status"] = "degraded"
    except Exception as e:
        checks["database"] = f"error: {str(e)}"
        checks["status"] = "degraded"

    # Check S3
    try:
        from services import get_s3_storage_service

        s3 = get_s3_storage_service()
        if s3.bucket_exists():
            checks["s3"] = "connected"
        else:
            checks["s3"] = "bucket_not_found"
            checks["status"] = "degraded"
    except Exception as e:
        checks["s3"] = f"error: {str(e)}"
        checks["status"] = "degraded"

    checks["timestamp"] = datetime.utcnow().isoformat()
    return checks


@router.get(
    "/health/live",
    summary="Liveness check",
    description="Check if service is alive",
)
async def liveness_check():
    """Liveness check"""
    return {
        "status": "alive",
        "timestamp": datetime.utcnow().isoformat(),
    }
