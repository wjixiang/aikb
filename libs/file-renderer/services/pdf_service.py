"""
PDF Service - PDF 文件解析服务
"""

from io import BytesIO
from typing import Optional

from docling.document_converter import DocumentConverter
from docling_core.types.io import DocumentStream

from lib.exceptions import FileNotFoundException, InvalidPageNumberException, PdfConversionException
from lib.logging_config import get_logger
from models.pdf_model import PdfMetadata, PdfReadResponse
from services.pdf_cache_service import pdf_cache_service
from services.storage_service import storage_service

logger = get_logger(__name__)


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

        Raises:
            FileNotFoundException: 文件不存在
            InvalidPageNumberException: 页码无效
            PdfConversionException: PDF 解析失败
        """
        # 1. 获取文件信息
        try:
            file_size = storage_service.get_file_size(s3_key)
            modified_time = storage_service.get_modified_time(s3_key)
        except FileNotFoundException:
            logger.warning(f"PDF file not found: {s3_key}", extra={"s3_key": s3_key})
            raise

        # 2. 尝试从缓存获取完整文档
        cached_doc = pdf_cache_service.get_doc(s3_key, file_size, modified_time)

        if cached_doc:
            # 使用缓存
            total_pages = cached_doc["total_page"]
            if page < 1 or page > total_pages:
                logger.warning(
                    f"Invalid page number: {page}, total: {total_pages}",
                    extra={"s3_key": s3_key, "page": page, "total_pages": total_pages},
                )
                raise InvalidPageNumberException(page=page, total_pages=total_pages)

            content = cached_doc["pages"][str(page)]

            # 提取文件名
            file_name = s3_key.split("/")[-1] if "/" in s3_key else s3_key

            metadata = PdfMetadata(
                s3_key=s3_key,
                file_name=file_name,
                total_pages=total_pages,
            )

            logger.debug(
                f"PDF served from cache: {s3_key}, page {page}",
                extra={"s3_key": s3_key, "page": page},
            )

            return PdfReadResponse(
                metadata=metadata,
                page=page,
                content=content,
            )

        # 3. 从 S3 下载 PDF
        logger.info(f"Downloading PDF for parsing: {s3_key}", extra={"s3_key": s3_key})
        pdf_data = storage_service.download(s3_key)
        pdf_file = BytesIO(pdf_data)

        # 提取文件名
        file_name = s3_key.split("/")[-1] if "/" in s3_key else s3_key

        # 4. 解析 PDF（完整解析所有页面）
        try:
            result = self.converter.convert(
                source=DocumentStream(
                    name=file_name,
                    stream=pdf_file,
                ),
            )
            doc = result.document
        except Exception as e:
            logger.error(
                f"Failed to parse PDF: {e}",
                extra={"s3_key": s3_key, "file_name": file_name},
                exc_info=True,
            )
            raise PdfConversionException(
                message=f"Failed to parse PDF file: {str(e)}",
                details={"s3_key": s3_key, "file_name": file_name},
            )

        # 获取总页数
        total_pages: int = doc.num_pages()

        # 5. 提取所有页面内容
        pages = {}
        for i in range(1, total_pages + 1):
            try:
                pages[str(i)] = doc.export_to_markdown(page_no=i)
            except Exception as e:
                logger.warning(
                    f"Failed to export page {i}: {e}",
                    extra={"s3_key": s3_key, "page": i},
                )
                pages[str(i)] = f"[Error exporting page {i}]"

        # 6. 存入缓存
        pdf_cache_service.set_doc(
            s3_key=s3_key,
            file_name=file_name,
            file_size=file_size,
            modified_time=modified_time,
            total_page=total_pages,
            pages=pages,
        )

        logger.info(
            f"PDF parsed and cached: {s3_key}, {total_pages} pages",
            extra={"s3_key": s3_key, "total_pages": total_pages, "file_size": file_size},
        )

        # 7. 返回指定页
        if page < 1 or page > total_pages:
            raise InvalidPageNumberException(page=page, total_pages=total_pages)

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
