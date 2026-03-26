"""
Document processing models

Defines request/response schemas for document conversion and chunking operations.
"""

from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field


class ConversionFormat(str, Enum):
    """Supported document conversion formats"""

    TEXT = "text"
    MARKDOWN = "markdown"
    JSON = "json"


class ConversionTaskStatus(str, Enum):
    """Conversion task status"""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ConversionRequest(BaseModel):
    """Document conversion request"""

    file_id: Optional[str] = Field(
        default=None,
        description="File identifier (if already uploaded)",
    )
    output_format: ConversionFormat = Field(
        default=ConversionFormat.MARKDOWN,
        description="Output format",
    )
    enable_ocr: Optional[bool] = Field(
        default=None,
        description="Override OCR setting",
    )
    extract_tables: Optional[bool] = Field(
        default=None,
        description="Override table extraction setting",
    )
    preserve_layout: bool = Field(
        default=False,
        description="Preserve original document layout",
    )


class ConversionResponse(BaseModel):
    """Document conversion response"""

    success: bool
    task_id: str
    status: ConversionTaskStatus
    message: str
    file_id: Optional[str] = None
    output_format: ConversionFormat = None
    content: Optional[str] = None
    metadata: Optional[dict] = None
    pages_count: Optional[int] = None
    error: Optional[str] = None


class ChunkingRequest(BaseModel):
    """Text chunking request for embeddings"""

    text: str = Field(
        ...,
        description="Text to chunk",
    )
    chunk_size: Optional[int] = Field(
        default=None,
        description="Override default chunk size",
    )
    chunk_overlap: Optional[int] = Field(
        default=None,
        description="Override default chunk overlap",
    )
    chunking_strategy: Literal["fixed", "semantic"] = Field(
        default="fixed",
        description="Chunking strategy",
    )


class ChunkingResponse(BaseModel):
    """Text chunking response"""

    success: bool
    chunks: list[str] = Field(
        default_factory=list,
        description="Text chunks",
    )
    chunk_count: int = Field(
        default=0,
        description="Number of chunks",
    )
    metadata: dict = Field(
        default_factory=dict,
        description="Chunking metadata",
    )


class DocumentMetadata(BaseModel):
    """Document metadata"""

    file_id: str
    filename: str
    file_size: int
    content_type: str
    page_count: Optional[int] = None
    title: Optional[str] = None
    author: Optional[str] = None
    subject: Optional[str] = None
    keywords: list[str] = Field(default_factory=list)
    created_date: Optional[str] = None
    modified_date: Optional[str] = None
    metadata: dict = Field(
        default_factory=dict,
        description="Additional metadata",
    )


class ConversionTask(BaseModel):
    """Conversion task model"""

    task_id: str
    file_id: str
    status: ConversionTaskStatus
    output_format: ConversionFormat
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    progress: float = Field(
        default=0.0,
        ge=0.0,
        le=100.0,
    )
    error_message: Optional[str] = None
    result: Optional[ConversionResponse] = None
