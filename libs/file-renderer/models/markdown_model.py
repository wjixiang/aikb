"""
Markdown API Models - Markdown 文件读取和编辑相关模型
"""

from pydantic import BaseModel, Field


class MarkdownReadByPageRequest(BaseModel):
    """Markdown 分页读取请求"""

    s3_key: str = Field(..., description="S3存储路径")
    page: int = Field(default=1, description="页码，从1开始")
    page_size: int = Field(default=1000, description="每页行数")


class MarkdownMetadata(BaseModel):
    """Markdown 文件元数据"""

    s3_key: str = Field(..., description="S3存储路径")
    file_name: str = Field(..., description="文件名")
    total_lines: int = Field(..., description="总行数")
    total_pages: int = Field(..., description="总页数")


class MarkdownReadByPageResponse(BaseModel):
    """Markdown 分页读取响应"""

    metadata: MarkdownMetadata = Field(..., description="元数据")
    page: int = Field(..., description="当前页码")
    content: str = Field(..., description="页面内容")
    start_line: int = Field(..., description="起始行号")
    end_line: int = Field(..., description="结束行号")
    has_next: bool = Field(..., description="是否有下一页")
    has_previous: bool = Field(..., description="是否有上一页")
