"""
Text chunking API router

All endpoints create async tasks and return 202 with task_id.
"""

import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_async_db
from models.document import ChunkingRequest, TaskAcceptedResponse
from services import get_task_service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/chunking",
    tags=["text-chunking"],
)


@router.post(
    "/chunk",
    status_code=202,
    response_model=TaskAcceptedResponse,
    summary="Chunk text for embeddings",
)
async def chunk_text(
    request: ChunkingRequest,
    db: AsyncSession = Depends(get_async_db),
):
    """Split text into chunks using the specified strategy."""
    task_service = get_task_service()
    task = await task_service.create_task(
        db,
        task_type="chunking",
        input_params={
            "text": request.text,
            "strategy": request.chunking_strategy,
            "chunk_size": request.chunk_size,
            "chunk_overlap": request.chunk_overlap,
        },
    )
    task_service.submit_task(task.id)

    return TaskAcceptedResponse(
        task_id=task.id,
        task_type="chunking",
        message="Chunking task queued",
    )


@router.post(
    "/chunk/fixed",
    status_code=202,
    response_model=TaskAcceptedResponse,
    summary="Chunk text with fixed size",
)
async def chunk_text_fixed(
    request: ChunkingRequest,
    db: AsyncSession = Depends(get_async_db),
):
    """Split text into fixed-size chunks with overlap."""
    task_service = get_task_service()
    task = await task_service.create_task(
        db,
        task_type="chunking",
        input_params={
            "text": request.text,
            "strategy": "fixed",
            "chunk_size": request.chunk_size,
            "chunk_overlap": request.chunk_overlap,
        },
    )
    task_service.submit_task(task.id)

    return TaskAcceptedResponse(
        task_id=task.id,
        task_type="chunking",
        message="Fixed-size chunking task queued",
    )


@router.post(
    "/chunk/semantic",
    status_code=202,
    response_model=TaskAcceptedResponse,
    summary="Chunk text semantically",
)
async def chunk_text_semantic(
    request: ChunkingRequest,
    db: AsyncSession = Depends(get_async_db),
):
    """Split text based on paragraphs and semantic boundaries."""
    task_service = get_task_service()
    task = await task_service.create_task(
        db,
        task_type="chunking",
        input_params={
            "text": request.text,
            "strategy": "semantic",
            "chunk_size": request.chunk_size,
            "chunk_overlap": request.chunk_overlap,
        },
    )
    task_service.submit_task(task.id)

    return TaskAcceptedResponse(
        task_id=task.id,
        task_type="chunking",
        message="Semantic chunking task queued",
    )
