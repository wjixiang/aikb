from __future__ import annotations

from fastapi import APIRouter, HTTPException

from jupyter_backend.kernel.manager import kernel_pool
from jupyter_backend.models.schemas import (
    KernelInfo,
    KernelListResponse,
    KernelResponse,
    StartKernelRequest,
)

router = APIRouter(prefix="/api/kernels", tags=["kernels"])


@router.get("", response_model=KernelListResponse)
async def list_kernels() -> KernelListResponse:
    kernels = await kernel_pool.list_kernels()
    return KernelListResponse(
        kernels=[
            KernelInfo(
                id=mk.kernel_id,
                name=mk.name,
                status="alive" if mk.is_alive else "dead",
                created_at=mk.created_at,
            )
            for mk in kernels
        ]
    )


@router.post("", response_model=KernelResponse, status_code=201)
async def start_kernel(req: StartKernelRequest) -> KernelResponse:
    try:
        mk = await kernel_pool.start_kernel(name=req.name)
    except RuntimeError as e:
        raise HTTPException(status_code=429, detail=str(e)) from e
    return KernelResponse(
        id=mk.kernel_id,
        name=mk.name,
        status="alive",
    )


@router.delete("/{kernel_id}", status_code=204)
async def shutdown_kernel(kernel_id: str) -> None:
    removed = await kernel_pool.shutdown_kernel(kernel_id)
    if not removed:
        raise HTTPException(status_code=404, detail=f"Kernel {kernel_id} not found")


@router.post("/{kernel_id}/restart", response_model=KernelResponse)
async def restart_kernel(kernel_id: str) -> KernelResponse:
    mk = await kernel_pool.restart_kernel(kernel_id)
    if mk is None:
        raise HTTPException(status_code=404, detail=f"Kernel {kernel_id} not found")
    return KernelResponse(
        id=mk.kernel_id,
        name=mk.name,
        status="alive",
    )


@router.post("/{kernel_id}/interrupt", status_code=204)
async def interrupt_kernel(kernel_id: str) -> None:
    interrupted = await kernel_pool.interrupt_kernel(kernel_id)
    if not interrupted:
        raise HTTPException(status_code=404, detail=f"Kernel {kernel_id} not found")
