"""
File API Models
"""

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class FileStatus(str, Enum):
    """文件状态"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class PaginationMode(str, Enum):
    """分页模式"""
    FIXED = "fixed"
    SEMANTIC = "semantic"


class FileMetadata(BaseModel):
    """文件元数据"""
    file_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    original_name: str
    s3_key: str
    content_type: str
    page_count: int = 0
    page_size: int = Field(default=4000)
    pagination_mode: PaginationMode = PaginationMode.FIXED
    status: FileStatus = FileStatus.PENDING
    error_message: str | None = None
    file_size: int = 0
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    model_config = {"from_attributes": True}


class FileUploadResponse(BaseModel):
    """文件上传响应"""
    file_id: str
    original_name: str
    s3_key: str
    content_type: str
    file_size: int
    status: FileStatus


class FileDetailResponse(BaseModel):
    """文件详情响应"""
    file_id: str
    original_name: str
    content_type: str
    file_size: int
    page_count: int
    page_size: int
    pagination_mode: PaginationMode
    status: FileStatus
    error_message: str | None
    created_at: datetime
    updated_at: datetime


class FileDownloadResponse(BaseModel):
    """文件下载响应"""
    download_url: str
    expires_in: int = 3600
