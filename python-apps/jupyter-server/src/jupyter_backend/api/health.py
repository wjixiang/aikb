from __future__ import annotations

from fastapi import APIRouter

from jupyter_backend import __version__
from jupyter_backend.kernel.manager import kernel_pool
from jupyter_backend.models.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/api/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(
        status="ok",
        kernel_count=kernel_pool.count,
        version=__version__,
    )
