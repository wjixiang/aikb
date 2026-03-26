"""
Text chunking API router

Handles text chunking endpoints for embedding preparation.
"""

import logging

from fastapi import APIRouter, HTTPException

from models.document import ChunkingRequest, ChunkingResponse
from services import get_chunking_service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/chunking",
    tags=["text-chunking"],
)


@router.post(
    "/chunk",
    response_model=ChunkingResponse,
    summary="Chunk text for embeddings",
    description="Split text into chunks for embedding generation",
)
async def chunk_text(request: ChunkingRequest):
    """
    Chunk text into smaller pieces

    - **text**: Text to chunk
    - **chunk_size**: Target chunk size (default from config)
    - **chunk_overlap**: Overlap between chunks
    - **chunking_strategy**: 'fixed' or 'semantic'
    """
    try:
        chunking_service = get_chunking_service()

        chunks, metadata = await chunking_service.chunk_text(
            text=request.text,
            strategy=request.chunking_strategy,
            chunk_size=request.chunk_size,
            chunk_overlap=request.chunk_overlap,
        )

        return ChunkingResponse(
            success=True,
            chunks=chunks,
            chunk_count=len(chunks),
            metadata=metadata,
        )

    except Exception as e:
        logger.error(f"Error chunking text: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Chunking failed: {str(e)}",
        )


@router.post(
    "/chunk/fixed",
    response_model=ChunkingResponse,
    summary="Chunk text with fixed size",
    description="Split text into fixed-size chunks with overlap",
)
async def chunk_text_fixed(request: ChunkingRequest):
    """
    Chunk text using fixed-size strategy

    - **text**: Text to chunk
    - **chunk_size**: Target chunk size
    - **chunk_overlap**: Overlap between chunks
    """
    try:
        chunking_service = get_chunking_service()

        chunks = await chunking_service.chunk_text_fixed(
            text=request.text,
            chunk_size=request.chunk_size,
            chunk_overlap=request.chunk_overlap,
        )

        metadata = {
            "strategy": "fixed",
            "chunk_count": len(chunks),
            "total_chars": sum(len(c) for c in chunks),
        }

        return ChunkingResponse(
            success=True,
            chunks=chunks,
            chunk_count=len(chunks),
            metadata=metadata,
        )

    except Exception as e:
        logger.error(f"Error chunking text: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Chunking failed: {str(e)}",
        )


@router.post(
    "/chunk/semantic",
    response_model=ChunkingResponse,
    summary="Chunk text semantically",
    description="Split text based on paragraphs and semantic boundaries",
)
async def chunk_text_semantic(request: ChunkingRequest):
    """
    Chunk text using semantic strategy

    - **text**: Text to chunk
    - **chunk_size**: Target chunk size (soft limit)
    - **chunk_overlap**: Overlap between chunks
    """
    try:
        chunking_service = get_chunking_service()

        chunks = await chunking_service.chunk_text_semantic(
            text=request.text,
            chunk_size=request.chunk_size,
            chunk_overlap=request.chunk_overlap,
        )

        metadata = {
            "strategy": "semantic",
            "chunk_count": len(chunks),
            "total_chars": sum(len(c) for c in chunks),
        }

        return ChunkingResponse(
            success=True,
            chunks=chunks,
            chunk_count=len(chunks),
            metadata=metadata,
        )

    except Exception as e:
        logger.error(f"Error chunking text: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Chunking failed: {str(e)}",
        )
