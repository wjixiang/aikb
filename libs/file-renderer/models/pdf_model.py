from pydantic import BaseModel, Field


class PdfReadRequest(BaseModel):
    """PDF 读取请求"""

    s3_key: str = Field(..., description="S3存储路径")
    page: int = Field(default=1, description="页码")


class PdfMetadata(BaseModel):
    """PDF 元数据"""

    s3_key: str = Field(..., description="S3存储路径")
    file_name: str = Field(..., description="文件名")
    total_pages: int = Field(..., description="总页数")


class PdfReadResponse(BaseModel):
    """PDF 读取响应"""

    metadata: PdfMetadata = Field(..., description="元数据")
    page: int = Field(..., description="当前页码")
    content: str = Field(..., description="页面内容")
