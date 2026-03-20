"""
PDF Rendering Models - PDF 渲染相关的 Pydantic 模型

提供 PDF 渲染的请求和响应模型
"""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class RenderBackendType(str, Enum):
    """渲染后端类型"""
    DOCLING = "docling"
    MINERU_PRECISION = "mineru_precision"
    MINERU_AGENT = "mineru_agent"


class RenderStatusType(str, Enum):
    """渲染状态类型"""
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    TIMEOUT = "timeout"


class RenderOptionsRequest(BaseModel):
    """渲染选项请求"""
    backend: RenderBackendType = Field(
        default=RenderBackendType.MINERU_AGENT,
        description="渲染后端: docling, mineru_precision, mineru_agent",
    )
    language: str = Field(
        default="ch",
        description="语言: en, ch",
    )
    is_ocr: bool = Field(
        default=False,
        description="是否启用 OCR",
    )
    enable_formula: bool = Field(
        default=True,
        description="是否提取公式",
    )
    enable_table: bool = Field(
        default=True,
        description="是否提取表格",
    )
    page_ranges: Optional[str] = Field(
        default=None,
        description="页码范围，如 '1-10' 或 '1,3,5-7'",
    )
    model_version: str = Field(
        default="vlm",
        description="模型版本: vlm, pipeline, MinerU-HTML",
    )


class ImageInfoResponse(BaseModel):
    """图片信息响应"""
    id: str = Field(..., description="图片 ID")
    page: int = Field(..., description="所属页码")
    filename: str = Field(..., description="文件名")
    base64_data: Optional[str] = Field(None, description="Base64 编码的图片数据")
    s3_key: Optional[str] = Field(None, description="S3 存储路径")
    width: Optional[int] = Field(None, description="图片宽度")
    height: Optional[int] = Field(None, description="图片高度")


class RenderResultResponse(BaseModel):
    """渲染结果响应"""
    success: bool = Field(..., description="是否成功")
    status: RenderStatusType = Field(..., description="渲染状态")
    task_id: str = Field(default="", description="任务 ID")
    s3_key: str = Field(default="", description="S3 存储路径")
    markdown: str = Field(default="", description="Markdown 内容")
    html: str = Field(default="", description="HTML 内容")
    total_pages: int = Field(default=0, description="总页数")
    images: list[ImageInfoResponse] = Field(default_factory=list, description="提取的图片列表")
    tables: list[dict] = Field(default_factory=list, description="提取的表格列表")
    metadata: dict = Field(default_factory=dict, description="元数据")
    error_message: str = Field(default="", description="错误信息")
    processing_time_ms: float = Field(default=0.0, description="处理时间（毫秒）")
    backend: RenderBackendType = Field(..., description="使用的渲染后端")


class RenderFromUrlRequest(BaseModel):
    """从 URL 渲染请求"""
    url: str = Field(..., description="PDF 文件 URL", min_length=1)
    options: RenderOptionsRequest = Field(default_factory=RenderOptionsRequest)

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "url": "https://example.com/document.pdf",
                    "options": {
                        "backend": "mineru_agent",
                        "language": "en",
                        "enable_formula": True,
                        "enable_table": True,
                    },
                }
            ]
        }
    }


class RenderFromS3Request(BaseModel):
    """从 S3 渲染请求"""
    s3_key: str = Field(..., description="S3 存储路径", min_length=1)
    options: RenderOptionsRequest = Field(default_factory=RenderOptionsRequest)

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "s3_key": "pdfs/research-paper.pdf",
                    "options": {
                        "backend": "mineru_precision",
                        "language": "ch",
                        "is_ocr": False,
                    },
                }
            ]
        }
    }


class TaskStatusRequest(BaseModel):
    """任务状态查询请求"""
    task_id: str = Field(..., description="任务 ID", min_length=1)
    backend: RenderBackendType = Field(
        default=RenderBackendType.MINERU_AGENT,
        description="渲染后端",
    )


class TaskStatusResponse(BaseModel):
    """任务状态响应"""
    success: bool = Field(..., description="是否成功")
    task_id: str = Field(..., description="任务 ID")
    status: RenderStatusType = Field(..., description="任务状态")
    data: Optional[dict] = Field(None, description="任务数据")
    error_message: str = Field(default="", description="错误信息")


class AvailableBackendsResponse(BaseModel):
    """可用后端响应"""
    backends: list[dict] = Field(..., description="可用后端列表")
    default_backend: RenderBackendType = Field(
        default=RenderBackendType.MINERU_AGENT,
        description="默认后端",
    )
    precision_api_available: bool = Field(..., description="Precision API 是否可用（需要 token）")
