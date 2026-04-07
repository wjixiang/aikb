"""
Document processing models

Defines request/response schemas for document conversion and chunking operations.
"""

from datetime import datetime
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field


class ConversionFormat(str, Enum):
    """Supported document conversion formats"""

    TEXT = "text"
    MARKDOWN = "markdown"
    JSON = "json"


class TaskType(str, Enum):
    """Task type"""

    CONVERSION = "conversion"
    CHUNKING = "chunking"


class TaskStatus(str, Enum):
    """Task status"""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


# --- Request models ---


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


class S3ConversionRequest(BaseModel):
    """Convert a file already stored in S3"""

    s3_key: str = Field(
        ...,
        description="S3 key of the source file to convert",
        min_length=1,
    )
    output_format: ConversionFormat = Field(
        default=ConversionFormat.MARKDOWN,
        description="Output format",
    )
    enable_ocr: Optional[bool] = Field(
        default=None,
        description="Override OCR setting",
    )
    output_s3_key: Optional[str] = Field(
        default=None,
        description="Override output S3 key (auto-derived from input if not provided)",
    )


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


# --- Response models ---


class TaskAcceptedResponse(BaseModel):
    """Returned immediately when a task is created (HTTP 202)"""

    task_id: str
    task_type: str
    status: str = "pending"
    message: str = "Task accepted and queued for processing"


class TaskDetailResponse(BaseModel):
    """Full task detail for status queries"""

    task_id: str
    task_type: str
    status: str
    progress: float = 0.0
    input_params: dict = Field(default_factory=dict)
    result: Optional[dict] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class TaskListResponse(BaseModel):
    """Paginated task list"""

    tasks: list[TaskDetailResponse] = Field(default_factory=list)
    total: int = 0
    limit: int = 50
    offset: int = 0


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
