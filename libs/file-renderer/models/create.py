"""
File Create API Models
"""

from pydantic import BaseModel, Field


# 文件类型到 content_type 的映射
FILE_TYPE_MAPPING: dict[str, str] = {
    "text": "text/plain",
    "json": "application/json",
    "markdown": "text/markdown",
    "html": "text/html",
    "xml": "application/xml",
    "csv": "text/csv",
    "pdf": "application/pdf",
    "binary": "application/octet-stream",
}


class FileCreateRequest(BaseModel):
    """文件创建请求"""

    fileName: str = Field(..., description="文件名")
    fileType: str = Field(..., description="文件类型")


class FileCreateResponse(BaseModel):
    """文件创建响应"""

    success: bool = Field(..., description="是否成功")
    message: str = Field(..., description="响应消息")
    s3_key: str | None = Field(default=None, description="S3存储路径")
    content_type: str | None = Field(default=None, description="内容类型")
    file_size: int | None = Field(default=None, description="文件大小")
