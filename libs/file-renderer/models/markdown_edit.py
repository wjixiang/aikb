"""
Markdown Edit API Models - Markdown 文件编辑相关模型
"""

from pydantic import BaseModel, Field


class MarkdownEditRequest(BaseModel):
    """Markdown 编辑请求（通用）"""

    s3_key: str = Field(..., description="S3存储路径")
    operation: str | None = Field(
        default=None,
        description="操作类型: replace(替换), insert(插入), delete(删除)"
    )
    # 替换/删除用
    start_line: int | None = Field(default=None, description="起始行号（从0开始）")
    end_line: int | None = Field(default=None, description="结束行号")
    # 替换/插入用
    new_content: str | None = Field(default=None, description="新内容")
    # 插入用
    position: str | None = Field(
        default=None,
        description="插入位置: before(之前), after(之后)"
    )
    target_line: int | None = Field(default=None, description="目标行号（插入用）")
    # 模糊匹配用
    match_content: str | None = Field(default=None, description="匹配内容（模糊替换用）")


class MarkdownInsertRequest(BaseModel):
    """Markdown 插入请求"""

    s3_key: str = Field(..., description="S3存储路径")
    content: str = Field(..., description="插入的内容")
    position: str = Field(
        default="end",
        description="插入位置: start(开头), end(结尾), before_line(指定行之前), after_line(指定行之后)"
    )
    target_line: int | None = Field(default=None, description="目标行号（before_line/after_line用）")


class MarkdownDeleteRequest(BaseModel):
    """Markdown 删除请求"""

    s3_key: str = Field(..., description="S3存储路径")
    start_line: int = Field(..., description="起始行号")
    end_line: int = Field(..., description="结束行号")
