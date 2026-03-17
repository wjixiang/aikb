"""
Markdown Edit API Models - Markdown 文件编辑相关模型

提供 Markdown 文件的行级编辑操作的请求模型
"""

from pydantic import BaseModel, Field


class MarkdownEditRequest(BaseModel):
    """Markdown 编辑请求模型（通用）

    支持替换、插入、删除等多种编辑操作
    """

    s3_key: str = Field(
        ...,
        description="S3存储路径",
        examples=["markdown/document.md"],
        min_length=1
    )
    operation: str | None = Field(
        default=None,
        description="操作类型: replace(替换), insert(插入), delete(删除)",
        examples=["replace", "insert", "delete"]
    )
    # 替换/删除用
    start_line: int | None = Field(
        default=None,
        description="起始行号（从0开始）",
        ge=0,
        examples=[10, 100]
    )
    end_line: int | None = Field(
        default=None,
        description="结束行号（包含）",
        ge=0,
        examples=[20, 150]
    )
    # 替换/插入用
    new_content: str | None = Field(
        default=None,
        description="新内容",
        examples=["新的文本内容"]
    )
    # 插入用
    position: str | None = Field(
        default=None,
        description="插入位置: before(之前), after(之后)",
        examples=["before", "after"]
    )
    target_line: int | None = Field(
        default=None,
        description="目标行号（插入用）",
        ge=0,
        examples=[50]
    )
    # 模糊匹配用
    match_content: str | None = Field(
        default=None,
        description="匹配内容（模糊替换用）",
        examples=["要查找的文本"]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "s3_key": "markdown/document.md",
                    "operation": "replace",
                    "start_line": 10,
                    "end_line": 20,
                    "new_content": "替换后的新内容"
                }
            ]
        }
    }


class MarkdownInsertRequest(BaseModel):
    """Markdown 插入请求模型

    在指定位置插入内容
    """

    s3_key: str = Field(
        ...,
        description="S3存储路径",
        examples=["markdown/document.md"],
        min_length=1
    )
    content: str = Field(
        ...,
        description="插入的内容",
        examples=["# 新章节\n\n这是新插入的内容"]
    )
    position: str = Field(
        default="end",
        description="插入位置: start(开头), end(结尾), before_line(指定行之前), after_line(指定行之后)",
        examples=["start", "end", "before_line", "after_line"]
    )
    target_line: int | None = Field(
        default=None,
        description="目标行号（before_line/after_line用，从0开始）",
        ge=0,
        examples=[50, 100]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "s3_key": "markdown/document.md",
                    "content": "# 新章节\n\n这是新插入的内容",
                    "position": "after_line",
                    "target_line": 50
                },
                {
                    "s3_key": "markdown/document.md",
                    "content": "---\n",
                    "position": "end"
                }
            ]
        }
    }


class MarkdownDeleteRequest(BaseModel):
    """Markdown 删除请求模型

    删除指定行范围的内容
    """

    s3_key: str = Field(
        ...,
        description="S3存储路径",
        examples=["markdown/document.md"],
        min_length=1
    )
    start_line: int = Field(
        ...,
        description="起始行号（从0开始，包含）",
        ge=0,
        examples=[10, 100]
    )
    end_line: int = Field(
        ...,
        description="结束行号（包含）",
        ge=0,
        examples=[20, 150]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "s3_key": "markdown/document.md",
                    "start_line": 10,
                    "end_line": 20
                }
            ]
        }
    }
