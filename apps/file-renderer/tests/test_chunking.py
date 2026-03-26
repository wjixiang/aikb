"""
Tests for chunking service
"""

import pytest
from services.chunking_service import ChunkingService, get_chunking_service


@pytest.mark.unit
def test_chunking_service_singleton():
    """Test that chunking service returns singleton"""
    service1 = get_chunking_service()
    service2 = get_chunking_service()
    assert service1 is service2


@pytest.mark.unit
@pytest.mark.asyncio
async def test_fixed_chunking():
    """Test fixed-size chunking"""
    service = ChunkingService()
    text = "This is a test document. " * 100

    chunks = await service.chunk_text_fixed(text, chunk_size=500, chunk_overlap=50)

    assert len(chunks) > 1
    assert all(len(chunk) <= 600 for chunk in chunks)  # Allow some flexibility
    assert chunks[0] in text


@pytest.mark.unit
@pytest.mark.asyncio
async def test_semantic_chunking():
    """Test semantic chunking"""
    service = ChunkingService()
    text = """
    # Introduction

    This is the first paragraph with some content.

    # Methods

    This is the second paragraph describing methods.

    # Results

    This is the third paragraph with results.

    # Discussion

    This is the fourth paragraph discussing the results.
    """ * 10

    chunks = await service.chunk_text_semantic(text, chunk_size=500)

    assert len(chunks) > 0
    assert all(chunk.strip() for chunk in chunks)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_chunk_empty_text():
    """Test chunking empty text"""
    service = ChunkingService()

    chunks = await service.chunk_text_fixed("", chunk_size=500)
    assert len(chunks) == 0

    chunks = await service.chunk_text_semantic("")
    assert len(chunks) == 0
