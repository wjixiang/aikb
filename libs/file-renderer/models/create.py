"""
File Create API Models - 文件创建相关的 Pydantic 模型

提供各种类型文件创建的请求和响应模型
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
    "tex": "application/x-tex",
}


class FileCreateRequest(BaseModel):
    """文件创建请求模型

    用于创建各种类型的空文件
    """

    fileName: str = Field(
        ...,
        description="文件名（包含扩展名）",
        examples=["document.md", "data.json", "report.pdf"],
        min_length=1,
        max_length=255
    )
    fileType: str = Field(
        default="text",
        description="文件类型",
        examples=["text", "json", "markdown", "html", "xml", "csv", "pdf", "binary", "tex"]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "fileName": "notes.md",
                    "fileType": "markdown"
                },
                {
                    "fileName": "config.json",
                    "fileType": "json"
                },
                {
                    "fileName": "document.pdf",
                    "fileType": "pdf"
                }
            ]
        }
    }


class FileCreateResponse(BaseModel):
    """文件创建响应模型

    文件创建操作的结果
    """

    success: bool = Field(
        ...,
        description="创建是否成功",
        examples=[True, False]
    )
    message: str = Field(
        ...,
        description="响应消息",
        examples=["File created successfully", "Failed to create file: permission denied"]
    )
    s3_key: str | None = Field(
        default=None,
        description="S3存储路径（成功时返回）",
        examples=["markdown/notes.md", "json/config.json"]
    )
    content_type: str | None = Field(
        default=None,
        description="内容类型（成功时返回）",
        examples=["text/markdown", "application/json"]
    )
    file_size: int | None = Field(
        default=None,
        description="文件大小（字节，成功时返回）",
        ge=0,
        examples=[0]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": True,
                    "message": "File created successfully",
                    "s3_key": "markdown/notes.md",
                    "content_type": "text/markdown",
                    "file_size": 0
                },
                {
                    "success": False,
                    "message": "Failed to create file: S3 connection error",
                    "s3_key": None,
                    "content_type": None,
                    "file_size": None
                }
            ]
        }
    }
