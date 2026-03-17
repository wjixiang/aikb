"""
File API Models - 文件管理相关的 Pydantic 模型

提供文件上传、元数据管理、下载等功能的请求和响应模型
"""

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class FileStatus(str, Enum):
    """文件处理状态枚举"""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class PaginationMode(str, Enum):
    """分页模式枚举

    - FIXED: 固定字符数分页
    - SEMANTIC: 语义分页（按段落/标题）
    """

    FIXED = "fixed"
    SEMANTIC = "semantic"


class FileMetadata(BaseModel):
    """文件元数据模型

    存储文件的基本信息、处理状态和分页配置
    """

    file_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="文件唯一标识符 (UUID)",
        examples=["550e8400-e29b-41d4-a716-446655440000"]
    )
    original_name: str = Field(
        ...,
        description="原始文件名",
        examples=["document.pdf"]
    )
    s3_key: str = Field(
        ...,
        description="S3存储路径",
        examples=["uploads/2024/01/document.pdf"]
    )
    content_type: str = Field(
        ...,
        description="MIME类型",
        examples=["application/pdf", "text/markdown"]
    )
    page_count: int = Field(
        default=0,
        description="总页数（处理完成后）",
        ge=0,
        examples=[10]
    )
    page_size: int = Field(
        default=4000,
        description="每页字符数",
        ge=100,
        examples=[4000]
    )
    pagination_mode: PaginationMode = Field(
        default=PaginationMode.FIXED,
        description="分页模式"
    )
    status: FileStatus = Field(
        default=FileStatus.PENDING,
        description="文件处理状态"
    )
    error_message: str | None = Field(
        default=None,
        description="处理错误信息（如果有）",
        examples=["文件格式不支持"]
    )
    file_size: int = Field(
        default=0,
        description="文件大小（字节）",
        ge=0,
        examples=[1024567]
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="创建时间",
        examples=["2024-01-15T08:30:00Z"]
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="更新时间",
        examples=["2024-01-15T08:30:00Z"]
    )

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "examples": [
                {
                    "file_id": "550e8400-e29b-41d4-a716-446655440000",
                    "original_name": "research_paper.pdf",
                    "s3_key": "uploads/2024/01/research_paper.pdf",
                    "content_type": "application/pdf",
                    "page_count": 15,
                    "page_size": 4000,
                    "pagination_mode": "fixed",
                    "status": "completed",
                    "error_message": None,
                    "file_size": 2048000,
                    "created_at": "2024-01-15T08:30:00Z",
                    "updated_at": "2024-01-15T08:35:00Z"
                }
            ]
        }
    }


class FileUploadResponse(BaseModel):
    """文件上传响应模型

    文件成功上传后返回的元数据
    """

    file_id: str = Field(
        ...,
        description="文件唯一标识符",
        examples=["550e8400-e29b-41d4-a716-446655440000"]
    )
    original_name: str = Field(
        ...,
        description="原始文件名",
        examples=["document.pdf"]
    )
    s3_key: str = Field(
        ...,
        description="S3存储路径",
        examples=["uploads/2024/01/document.pdf"]
    )
    content_type: str = Field(
        ...,
        description="MIME类型",
        examples=["application/pdf"]
    )
    file_size: int = Field(
        ...,
        description="文件大小（字节）",
        ge=0,
        examples=[1024567]
    )
    status: FileStatus = Field(
        ...,
        description="文件处理状态"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "file_id": "550e8400-e29b-41d4-a716-446655440000",
                    "original_name": "document.pdf",
                    "s3_key": "uploads/2024/01/document.pdf",
                    "content_type": "application/pdf",
                    "file_size": 1024567,
                    "status": "pending"
                }
            ]
        }
    }


class FileDetailResponse(BaseModel):
    """文件详情响应模型

    包含完整的文件元数据信息
    """

    file_id: str = Field(
        ...,
        description="文件唯一标识符",
        examples=["550e8400-e29b-41d4-a716-446655440000"]
    )
    original_name: str = Field(
        ...,
        description="原始文件名",
        examples=["document.pdf"]
    )
    content_type: str = Field(
        ...,
        description="MIME类型",
        examples=["application/pdf"]
    )
    file_size: int = Field(
        ...,
        description="文件大小（字节）",
        ge=0,
        examples=[1024567]
    )
    page_count: int = Field(
        ...,
        description="总页数",
        ge=0,
        examples=[15]
    )
    page_size: int = Field(
        ...,
        description="每页字符数",
        ge=0,
        examples=[4000]
    )
    pagination_mode: PaginationMode = Field(
        ...,
        description="分页模式"
    )
    status: FileStatus = Field(
        ...,
        description="文件处理状态"
    )
    error_message: str | None = Field(
        default=None,
        description="处理错误信息",
        examples=[None]
    )
    created_at: datetime = Field(
        ...,
        description="创建时间",
        examples=["2024-01-15T08:30:00Z"]
    )
    updated_at: datetime = Field(
        ...,
        description="更新时间",
        examples=["2024-01-15T08:35:00Z"]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "file_id": "550e8400-e29b-41d4-a716-446655440000",
                    "original_name": "research_paper.pdf",
                    "content_type": "application/pdf",
                    "file_size": 2048000,
                    "page_count": 15,
                    "page_size": 4000,
                    "pagination_mode": "fixed",
                    "status": "completed",
                    "error_message": None,
                    "created_at": "2024-01-15T08:30:00Z",
                    "updated_at": "2024-01-15T08:35:00Z"
                }
            ]
        }
    }


class FileDownloadResponse(BaseModel):
    """文件下载响应模型

    包含预签名下载URL和过期时间
    """

    download_url: str = Field(
        ...,
        description="预签名下载URL",
        examples=["https://bucket.oss-cn-hangzhou.aliyuncs.com/file.pdf?Expires=..."]
    )
    expires_in: int = Field(
        default=3600,
        description="链接有效期（秒）",
        ge=60,
        le=86400,
        examples=[3600]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "download_url": "https://bucket.oss-cn-hangzhou.aliyuncs.com/file.pdf?Expires=1705312200&OSSAccessKeyId=...",
                    "expires_in": 3600
                }
            ]
        }
    }
