"""
Markdown API Models - Markdown 文件读取和编辑相关模型

提供 Markdown 文件的分页读取、编辑和预览功能的请求和响应模型
"""

from pydantic import BaseModel, Field


class MarkdownReadByPageRequest(BaseModel):
    """Markdown 分页读取请求模型

    按页码分页读取 Markdown 文件内容
    """

    s3_key: str = Field(
        ...,
        description="S3存储路径",
        examples=["markdown/document.md", "notes/readme.md"],
        min_length=1
    )
    page: int = Field(
        default=1,
        description="页码，从1开始",
        ge=1,
        examples=[1, 2, 5]
    )
    page_size: int = Field(
        default=1000,
        description="每页行数",
        ge=10,
        le=5000,
        examples=[100, 500, 1000]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "s3_key": "markdown/document.md",
                    "page": 1,
                    "page_size": 1000
                }
            ]
        }
    }


class MarkdownMetadata(BaseModel):
    """Markdown 文件元数据模型"""

    s3_key: str = Field(
        ...,
        description="S3存储路径",
        examples=["markdown/document.md"]
    )
    file_name: str = Field(
        ...,
        description="文件名",
        examples=["document.md", "readme.md"]
    )
    total_lines: int = Field(
        ...,
        description="总行数",
        ge=0,
        examples=[1500, 5000]
    )
    total_pages: int = Field(
        ...,
        description="总页数",
        ge=1,
        examples=[2, 5, 10]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "s3_key": "markdown/document.md",
                    "file_name": "document.md",
                    "total_lines": 1500,
                    "total_pages": 2
                }
            ]
        }
    }


class MarkdownReadByPageResponse(BaseModel):
    """Markdown 分页读取响应模型

    包含指定页面的内容和分页信息
    """

    metadata: MarkdownMetadata = Field(
        ...,
        description="文件元数据"
    )
    page: int = Field(
        ...,
        description="当前页码",
        ge=1,
        examples=[1, 2]
    )
    content: str = Field(
        ...,
        description="页面内容",
        examples=["# 第一章\n\n这是第一章的内容..."]
    )
    start_line: int = Field(
        ...,
        description="起始行号（从0开始）",
        ge=0,
        examples=[0, 1000]
    )
    end_line: int = Field(
        ...,
        description="结束行号",
        ge=0,
        examples=[999, 1500]
    )
    has_next: bool = Field(
        ...,
        description="是否有下一页",
        examples=[True, False]
    )
    has_previous: bool = Field(
        ...,
        description="是否有上一页",
        examples=[False, True]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "metadata": {
                        "s3_key": "markdown/document.md",
                        "file_name": "document.md",
                        "total_lines": 1500,
                        "total_pages": 2
                    },
                    "page": 1,
                    "content": "# 第一章\n\n这是第一章的内容...",
                    "start_line": 0,
                    "end_line": 999,
                    "has_next": True,
                    "has_previous": False
                }
            ]
        }
    }


class MarkdownEditResponse(BaseModel):
    """Markdown 编辑响应模型

    编辑操作的结果信息
    """

    success: bool = Field(
        ...,
        description="是否编辑成功",
        examples=[True, False]
    )
    message: str = Field(
        ...,
        description="响应消息",
        examples=["编辑成功", "文件不存在"]
    )
    s3_key: str = Field(
        ...,
        description="S3存储路径",
        examples=["markdown/document.md"]
    )
    old_line_count: int = Field(
        ...,
        description="原文件行数",
        ge=0,
        examples=[1500]
    )
    new_line_count: int = Field(
        ...,
        description="新文件行数",
        ge=0,
        examples=[1600]
    )
    lines_changed: int = Field(
        ...,
        description="变更行数",
        examples=[100]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": True,
                    "message": "编辑成功",
                    "s3_key": "markdown/document.md",
                    "old_line_count": 1500,
                    "new_line_count": 1600,
                    "lines_changed": 100
                }
            ]
        }
    }


class ContentDiff(BaseModel):
    """内容差异模型

    表示编辑操作产生的差异
    """

    diff_type: str = Field(
        ...,
        description="差异类型: added/changed/deleted",
        examples=["added", "changed", "deleted"]
    )
    old_content: str | None = Field(
        default=None,
        description="原内容（changed/deleted 时有值）",
        examples=["旧文本内容"]
    )
    new_content: str | None = Field(
        default=None,
        description="新内容（added/changed 时有值）",
        examples=["新文本内容"]
    )
    old_line_start: int | None = Field(
        default=None,
        description="原内容起始行号",
        ge=0,
        examples=[10]
    )
    old_line_end: int | None = Field(
        default=None,
        description="原内容结束行号",
        ge=0,
        examples=[20]
    )
    new_line_start: int | None = Field(
        default=None,
        description="新内容起始行号",
        ge=0,
        examples=[10]
    )
    new_line_end: int | None = Field(
        default=None,
        description="新内容结束行号",
        ge=0,
        examples=[25]
    )
    line_count: int | None = Field(
        default=None,
        description="变更行数",
        ge=0,
        examples=[10]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "diff_type": "changed",
                    "old_content": "旧文本内容",
                    "new_content": "新文本内容",
                    "old_line_start": 10,
                    "old_line_end": 20,
                    "new_line_start": 10,
                    "new_line_end": 25,
                    "line_count": 10
                }
            ]
        }
    }


class MarkdownPreviewResponse(BaseModel):
    """Markdown 编辑预览响应模型

    预览编辑操作的差异，不实际修改文件
    """

    success: bool = Field(
        ...,
        description="预览是否成功",
        examples=[True, False]
    )
    message: str = Field(
        ...,
        description="响应消息",
        examples=["预览成功"]
    )
    s3_key: str = Field(
        ...,
        description="S3存储路径",
        examples=["markdown/document.md"]
    )
    diffs: list[ContentDiff] = Field(
        default_factory=list,
        description="差异列表"
    )
    old_line_count: int = Field(
        ...,
        description="原文件行数",
        ge=0,
        examples=[1500]
    )
    new_line_count: int = Field(
        ...,
        description="新文件行数（预览）",
        ge=0,
        examples=[1600]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": True,
                    "message": "预览成功",
                    "s3_key": "markdown/document.md",
                    "diffs": [
                        {
                            "diff_type": "changed",
                            "old_content": "旧内容",
                            "new_content": "新内容",
                            "old_line_start": 10,
                            "old_line_end": 20,
                            "new_line_start": 10,
                            "new_line_end": 25,
                            "line_count": 10
                        }
                    ],
                    "old_line_count": 1500,
                    "new_line_count": 1600
                }
            ]
        }
    }
