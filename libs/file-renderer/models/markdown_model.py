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

class MarkdownEditResponse(BaseModel):
    """Markdown 编辑响应"""

    success: bool = Field(..., description="是否编辑成功")
    message: str = Field(..., description="响应消息")
    s3_key: str = Field(..., description="S3存储路径")
    old_line_count: int = Field(..., description="原文件行数")
    new_line_count: int = Field(..., description="新文件行数")
    lines_changed: int = Field(..., description="变更行数")


class ContentDiff(BaseModel):
    """内容差异模型"""

    diff_type: str = Field(..., description="差异类型: added/changed/deleted")
    old_content: str | None = Field(default=None, description="原内容")
    new_content: str | None = Field(default=None, description="新内容")
    old_line_start: int | None = Field(default=None, description="原内容起始行号")
    old_line_end: int | None = Field(default=None, description="原内容结束行号")
    new_line_start: int | None = Field(default=None, description="新内容起始行号")
    new_line_end: int | None = Field(default=None, description="新内容结束行号")
    line_count: int | None = Field(default=None, description="变更行数")


class MarkdownPreviewResponse(BaseModel):
    """Markdown 编辑预览响应"""

    success: bool = Field(..., description="预览是否成功")
    message: str = Field(..., description="响应消息")
    s3_key: str = Field(..., description="S3存储路径")
    diffs: list[ContentDiff] = Field(..., description="差异列表")
    old_line_count: int = Field(..., description="原文件行数")
    new_line_count: int = Field(..., description="新文件行数（预览）")

