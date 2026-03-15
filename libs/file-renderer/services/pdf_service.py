"""
PDF Service - PDF 文件解析服务
"""

from io import BytesIO
from typing import Optional

from docling.document_converter import DocumentConverter
from docling_core.types.io import DocumentStream

from models.pdf_model import PdfMetadata, PdfReadResponse
from services.storage_service import storage_service
from services.pdf_cache_service import pdf_cache_service


class PdfService:
    """PDF 解析服务"""

    def __init__(self):
        self._converter: Optional[DocumentConverter] = None

    @property
    def converter(self) -> DocumentConverter:
        """获取 DocumentConverter 实例"""
        if self._converter is None:
            self._converter = DocumentConverter()
        return self._converter

    def read_pdf(self, s3_key: str, page: int = 1) -> PdfReadResponse:
        """
        读取 PDF 文件指定页内容

        Args:
            s3_key: S3 存储路径
            page: 页码（从 1 开始）

        Returns:
            PdfReadResponse: 包含页面内容和元数据
        """
        # 1. 获取文件信息
        file_size = storage_service.get_file_size(s3_key)
        modified_time = storage_service.get_modified_time(s3_key)

        # 2. 尝试从缓存获取完整文档
        cached_doc = pdf_cache_service.get_doc(s3_key, file_size, modified_time)

        if cached_doc:
            # 使用缓存
            total_pages = cached_doc["total_page"]
            if page < 1 or page > total_pages:
                raise ValueError(f"Invalid page number: {page}. Total pages: {total_pages}")

            content = cached_doc["pages"][str(page)]

            # 提取文件名
            file_name = s3_key.split("/")[-1] if "/" in s3_key else s3_key

            metadata = PdfMetadata(
                s3_key=s3_key,
                file_name=file_name,
                total_pages=total_pages,
            )

            return PdfReadResponse(
                metadata=metadata,
                page=page,
                content=content,
            )

        # 3. 从 S3 下载 PDF
        pdf_data = storage_service.download(s3_key)
        pdf_file = BytesIO(pdf_data)

        # 提取文件名
        file_name = s3_key.split("/")[-1] if "/" in s3_key else s3_key

        # 4. 解析 PDF（完整解析所有页面）
        result = self.converter.convert(
            source=DocumentStream(
                name=file_name,
                stream=pdf_file,
            ),
        )
        doc = result.document

        # 获取总页数
        total_pages: int = doc.num_pages()

        # 5. 提取所有页面内容
        pages = {}
        for i in range(1, total_pages + 1):
            pages[str(i)] = doc.export_to_markdown(page_no=i)

        # 6. 存入缓存
        pdf_cache_service.set_doc(
            s3_key=s3_key,
            file_name=file_name,
            file_size=file_size,
            modified_time=modified_time,
            total_page=total_pages,
            pages=pages,
        )

        # 7. 返回指定页
        if page < 1 or page > total_pages:
            raise ValueError(f"Invalid page number: {page}. Total pages: {total_pages}")

        content = pages[str(page)]

        metadata = PdfMetadata(
            s3_key=s3_key,
            file_name=file_name,
            total_pages=total_pages,
        )

        return PdfReadResponse(
            metadata=metadata,
            page=page,
            content=content,
        )


# 全局服务实例
pdf_service = PdfService()
