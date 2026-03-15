"""
File Edit API Models
"""

from pydantic import BaseModel, Field


class FileReadRequest(BaseModel):
    """文件读取请求"""

    s3_key: str = Field(..., description="S3存储路径")
    encoding: str = Field(default="utf-8", description="编码格式")


class FileUpdateRequest(BaseModel):
    """文件更新请求"""

    s3_key: str = Field(..., description="S3存储路径")
    content: str = Field(..., description="新内容")
    mode: str = Field(
        default="overwrite", description="更新模式: overwrite/append/prepend"
    )


class FileMoveRequest(BaseModel):
    """文件移动/重命名请求"""

    s3_key: str = Field(..., description="当前S3路径")
    new_s3_key: str = Field(..., description="新S3路径")


class FileCopyRequest(BaseModel):
    """文件复制请求"""

    s3_key: str = Field(..., description="源S3路径")
    new_s3_key: str = Field(..., description="目标S3路径")


class FileEditResponse(BaseModel):
    """文件编辑响应"""

    success: bool
    message: str
    action: str
    s3_key: str | None = None
    content: str | None = None
    content_type: str | None = None
    file_size: int | None = None
    new_s3_key: str | None = None
    exists: bool | None = None
