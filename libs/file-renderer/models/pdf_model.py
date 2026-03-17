"""
PDF API Models - PDF 文件相关的 Pydantic 模型

提供 PDF 文件读取、解析的请求和响应模型
"""

from pydantic import BaseModel, Field


class PdfReadRequest(BaseModel):
    """PDF 读取请求模型

    用于读取 PDF 文件的指定页面
    """

    s3_key: str = Field(
        ...,
        description="S3存储路径",
        examples=["pdf/document.pdf", "uploads/2024/01/paper.pdf"],
        min_length=1
    )
    page: int = Field(
        default=1,
        description="页码（从1开始）",
        ge=1,
        examples=[1, 5, 10]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "s3_key": "pdf/research_paper.pdf",
                    "page": 1
                },
                {
                    "s3_key": "uploads/2024/01/document.pdf",
                    "page": 5
                }
            ]
        }
    }


class PdfMetadata(BaseModel):
    """PDF 元数据模型

    PDF 文件的基本信息
    """

    s3_key: str = Field(
        ...,
        description="S3存储路径",
        examples=["pdf/document.pdf"]
    )
    file_name: str = Field(
        ...,
        description="文件名",
        examples=["document.pdf", "research_paper.pdf"]
    )
    total_pages: int = Field(
        ...,
        description="总页数",
        ge=0,
        examples=[15, 100]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "s3_key": "pdf/research_paper.pdf",
                    "file_name": "research_paper.pdf",
                    "total_pages": 15
                }
            ]
        }
    }


class PdfReadResponse(BaseModel):
    """PDF 读取响应模型

    包含指定页面的文本内容
    """

    metadata: PdfMetadata = Field(
        ...,
        description="PDF 元数据"
    )
    page: int = Field(
        ...,
        description="当前页码",
        ge=1,
        examples=[1, 5]
    )
    content: str = Field(
        ...,
        description="页面文本内容",
        examples=["第一章 引言\n\n本文研究了..."]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "metadata": {
                        "s3_key": "pdf/research_paper.pdf",
                        "file_name": "research_paper.pdf",
                        "total_pages": 15
                    },
                    "page": 1,
                    "content": "第一章 引言\n\n本文研究了人工智能在医疗领域的应用..."
                }
            ]
        }
    }
