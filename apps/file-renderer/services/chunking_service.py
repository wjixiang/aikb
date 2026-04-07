"""
Text chunking service for preparing documents for embedding

Handles both fixed-size and semantic chunking strategies.
"""

import logging
import re
from typing import Optional

from config import settings

logger = logging.getLogger(__name__)


class ChunkingService:
    """Service for chunking text for embedding generation"""

    def __init__(self):
        """Initialize the chunking service"""
        self.default_chunk_size = settings.chunking.default_chunk_size
        self.max_chunk_size = settings.chunking.max_chunk_size
        self.chunk_overlap = settings.chunking.chunk_overlap

    def chunk_text_fixed(
        self,
        text: str,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
    ) -> list[str]:
        """Chunk text into fixed-size pieces with overlap"""
        chunk_size = chunk_size or self.default_chunk_size
        chunk_overlap = chunk_overlap or self.chunk_overlap

        if not text:
            return []

        chunks = []
        start = 0
        text_len = len(text)

        while start < text_len:
            end = start + chunk_size
            chunk = text[start:end]

            if end < text_len and not text[end].isspace():
                last_space = chunk.rfind(" ")
                if last_space > 0:
                    chunk = chunk[:last_space]
                    end = start + last_space + 1

            chunks.append(chunk)
            start = end - chunk_overlap

            if start <= 0:
                start = end

        logger.info(f"Chunked text into {len(chunks)} chunks (fixed)")
        return chunks

    def chunk_text_semantic(
        self,
        text: str,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
    ) -> list[str]:
        """Chunk text semantically based on paragraphs and sections"""
        chunk_size = chunk_size or settings.chunking.semantic_chunk_size
        chunk_overlap = chunk_overlap or settings.chunking.semantic_overlap

        if not text:
            return []

        paragraphs = re.split(r"\n\s*\n", text)
        paragraphs = [p.strip() for p in paragraphs if p.strip()]

        chunks = []
        current_chunk = ""
        current_size = 0

        for paragraph in paragraphs:
            para_size = len(paragraph)

            if current_size + para_size > chunk_size and current_chunk:
                chunks.append(current_chunk.strip())

                if chunks and chunk_overlap > 0:
                    last_para_start = current_chunk.rfind("\n\n")
                    if last_para_start == -1:
                        last_para_start = 0
                    overlap_text = current_chunk[last_para_start:]
                    current_chunk = overlap_text + "\n\n" + paragraph
                    current_size = len(current_chunk)
                else:
                    current_chunk = paragraph
                    current_size = para_size
            else:
                if current_chunk:
                    current_chunk += "\n\n" + paragraph
                else:
                    current_chunk = paragraph
                current_size += para_size + 2

        if current_chunk:
            chunks.append(current_chunk.strip())

        logger.info(f"Chunked text into {len(chunks)} chunks (semantic)")
        return chunks

    def chunk_text(
        self,
        text: str,
        strategy: str = "fixed",
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
    ) -> tuple[list[str], dict]:
        """Chunk text using specified strategy"""
        if strategy == "fixed":
            chunks = self.chunk_text_fixed(text, chunk_size, chunk_overlap)
        elif strategy == "semantic":
            chunks = self.chunk_text_semantic(text, chunk_size, chunk_overlap)
        else:
            raise ValueError(f"Unknown chunking strategy: {strategy}")

        metadata = {
            "strategy": strategy,
            "chunk_count": len(chunks),
            "total_chars": sum(len(c) for c in chunks),
            "avg_chunk_size": sum(len(c) for c in chunks) // len(chunks) if chunks else 0,
        }

        return chunks, metadata


# Singleton instance
_chunking_service: Optional[ChunkingService] = None


def get_chunking_service() -> ChunkingService:
    """Get or create chunking service singleton"""
    global _chunking_service
    if _chunking_service is None:
        _chunking_service = ChunkingService()
    return _chunking_service
