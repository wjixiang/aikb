from __future__ import annotations

from fastapi import APIRouter

from jupyter_backend.kernel.executor import execute_code
from jupyter_backend.models.schemas import ExecuteRequest, ExecuteResponse

router = APIRouter(tags=["execute"])


@router.post("/api/execute", response_model=ExecuteResponse)
async def execute(req: ExecuteRequest) -> ExecuteResponse:
    return await execute_code(
        kernel_id=req.kernel_id,
        code=req.code,
        timeout=req.timeout,
        kernel_name=req.kernel_name,
    )
