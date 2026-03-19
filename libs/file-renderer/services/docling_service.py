"""
Docling Service - 统一的文件转换服务

使用 docling 将多种格式转换为 LLM 友好的纯文本，支持:
- PDF, DOCX, PPTX, XLSX, CSV, HTML, Markdown, 图片等格式
- 多种输出格式: Markdown, JSON, HTML, Text, Doctags
- OCR, 表格识别, 图片提取等高级功能
- 批量转换和进度追踪
- 缓存机制避免重复处理
"""

import asyncio
import hashlib
import io
import json
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Optional
from concurrent.futures import ThreadPoolExecutor

from docling.datamodel.base_models import ConversionStatus as DoclingConversionStatus, InputFormat
from docling_core.types.doc import ImageRefMode
from docling.datamodel.document import ConversionResult
from docling.datamodel.settings import settings as docling_settings
from docling.document_converter import DocumentConverter
from docling.datamodel.base_models import DocumentStream

from config import settings
from lib.exceptions import (
    ConversionException,
    FileNotFoundException,
    FileTooLargeException,
    TimeoutException,
    UnsupportedFileTypeException,
)
from lib.logging_config import get_logger
from models.database import ConversionCache, ConversionTask, SessionLocal
from services.storage_service import storage_service

logger = get_logger(__name__)


class ConversionStatus(Enum):
    """转换状态枚举"""
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    NOT_FOUND = "not_found"
    CANCELLED = "cancelled"


class OutputFormat(Enum):
    """输出格式枚举"""
    MARKDOWN = "markdown"
    JSON = "json"
    HTML = "html"
    TEXT = "text"
    DOCTAGS = "doctags"


class InputFormatType(Enum):
    """输入格式类型枚举"""
    PDF = "pdf"
    DOCX = "docx"
    PPTX = "pptx"
    XLSX = "xlsx"
    CSV = "csv"
    HTML = "html"
    MARKDOWN = "markdown"
    TEXT = "text"
    XML = "xml"
    IMAGE = "image"


# 文件扩展名到输入格式的映射
EXTENSION_TO_FORMAT: dict[str, InputFormatType] = {
    ".pdf": InputFormatType.PDF,
    ".docx": InputFormatType.DOCX,
    ".doc": InputFormatType.DOCX,
    ".pptx": InputFormatType.PPTX,
    ".ppt": InputFormatType.PPTX,
    ".xlsx": InputFormatType.XLSX,
    ".xls": InputFormatType.XLSX,
    ".csv": InputFormatType.CSV,
    ".html": InputFormatType.HTML,
    ".htm": InputFormatType.HTML,
    ".md": InputFormatType.MARKDOWN,
    ".markdown": InputFormatType.MARKDOWN,
    ".txt": InputFormatType.TEXT,
    ".text": InputFormatType.TEXT,
    ".xml": InputFormatType.XML,
    ".png": InputFormatType.IMAGE,
    ".jpg": InputFormatType.IMAGE,
    ".jpeg": InputFormatType.IMAGE,
    ".gif": InputFormatType.IMAGE,
    ".bmp": InputFormatType.IMAGE,
    ".tiff": InputFormatType.IMAGE,
    ".tif": InputFormatType.IMAGE,
}

# 输入格式到 docling InputFormat 的映射
# 注意: TEXT 和 XML 格式 docling 不直接支持,已在 InputFormatType 中移除
FORMAT_TO_DOCLING: dict[InputFormatType, InputFormat] = {
    InputFormatType.PDF: InputFormat.PDF,
    InputFormatType.DOCX: InputFormat.DOCX,
    InputFormatType.PPTX: InputFormat.PPTX,
    InputFormatType.XLSX: InputFormat.XLSX,
    InputFormatType.HTML: InputFormat.HTML,
    InputFormatType.MARKDOWN: InputFormat.MD,
    InputFormatType.IMAGE: InputFormat.IMAGE,
}


@dataclass
class ConversionOptions:
    """转换选项"""
    enable_ocr: bool = True
    ocr_language: list[str] = field(default_factory=lambda: ["eng", "chi_sim"])
    enable_table_extraction: bool = True
    table_export_format: str = "markdown"
    enable_image_extraction: bool = False
    image_export_mode: ImageRefMode = ImageRefMode.REFERENCED
    enable_structure_extraction: bool = True
    extract_headings: bool = True
    extract_lists: bool = True
    page_size: int = 4000
    preserve_page_breaks: bool = True
    force_refresh: bool = False
    timeout_seconds: int = 300
    do_picture_description: bool = False
    do_picture_classification: bool = False


@dataclass
class ConversionResultData:
    """转换结果数据"""
    s3_key: str
    file_name: str
    file_type: str
    output_format: OutputFormat
    status: ConversionStatus
    total_pages: int = 0
    markdown: str = ""
    json_content: dict = field(default_factory=dict)
    html: str = ""
    full_text: str = ""
    doctags: str = ""
    pages: dict[str, str] = field(default_factory=dict)
    metadata: dict = field(default_factory=dict)
    images: list[dict] = field(default_factory=list)
    tables: list[dict] = field(default_factory=list)
    processing_time_ms: float = 0.0
    error_message: str = ""


@dataclass
class BatchConversionResult:
    """批量转换结果"""
    batch_id: str
    total_files: int
    completed_files: int
    failed_files: int
    pending_files: int
    status: ConversionStatus
    results: list[ConversionResultData] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None


@dataclass
class ConversionProgress:
    """转换进度"""
    task_id: str
    s3_key: str
    status: ConversionStatus
    progress_percent: float = 0.0
    current_page: int = 0
    total_pages: int = 0
    message: str = ""
    started_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class DoclingService:
    """
    Docling 文件转换服务

    提供统一的文件转换接口，支持多种输入格式和输出格式。
    使用 docling 库进行文档解析和转换。
    """

    def __init__(self):
        self._converter: Optional[DocumentConverter] = None
        self._executor = ThreadPoolExecutor(max_workers=settings.conversion.max_workers)
        self._progress_cache: dict[str, ConversionProgress] = {}
        logger.info("DoclingService initialized")

    @property
    def converter(self) -> DocumentConverter:
        """获取或创建 DocumentConverter 实例"""
        if self._converter is None:
            self._converter = DocumentConverter()
            logger.debug("DocumentConverter instance created")
        return self._converter

    def _get_file_extension(self, file_name: str) -> str:
        """获取文件扩展名"""
        return "." + file_name.split(".")[-1].lower() if "." in file_name else ""

    def _detect_input_format(self, file_name: str) -> InputFormatType:
        """检测文件输入格式"""
        ext = self._get_file_extension(file_name)
        fmt = EXTENSION_TO_FORMAT.get(ext)
        if fmt is None:
            raise UnsupportedFileTypeException(
                content_type=ext or "unknown",
                supported_types=list(EXTENSION_TO_FORMAT.keys())
            )
        return fmt

    def _get_docling_format(self, fmt: InputFormatType) -> InputFormat:
        """获取 docling 对应的输入格式"""
        docling_fmt = FORMAT_TO_DOCLING.get(fmt)
        if docling_fmt is None:
            raise UnsupportedFileTypeException(
                content_type=fmt.value,
                supported_types=[f.value for f in FORMAT_TO_DOCLING.keys()]
            )
        return docling_fmt

    def _generate_cache_key(
        self,
        s3_key: str,
        output_format: OutputFormat,
        options: ConversionOptions
    ) -> str:
        """生成缓存键"""
        # 基于文件路径、输出格式和选项生成唯一键
        cache_data = f"{s3_key}:{output_format.value}:{options.enable_ocr}:{options.enable_table_extraction}"
        return hashlib.sha256(cache_data.encode()).hexdigest()

    def _get_file_metadata(self, s3_key: str) -> tuple[int, int]:
        """获取文件元数据（大小和修改时间）"""
        try:
            size = storage_service.get_file_size(s3_key)
            modified_time = storage_service.get_modified_time(s3_key)
            return size, modified_time
        except FileNotFoundException:
            raise
        except Exception as e:
            logger.error(f"Failed to get file metadata: {e}", extra={"s3_key": s3_key})
            raise FileNotFoundException(s3_key=s3_key)

    def _check_cache(
        self,
        cache_key: str,
        s3_key: str,
        options: ConversionOptions
    ) -> Optional[ConversionResultData]:
        """检查缓存是否存在且有效"""
        if not settings.conversion.enable_cache or options.force_refresh:
            return None

        db = SessionLocal()
        try:
            cache_entry = db.query(ConversionCache).filter(
                ConversionCache.cache_key == cache_key
            ).first()

            if cache_entry is None:
                return None

            # 检查缓存是否过期
            cache_ttl_seconds = settings.conversion.cache_ttl_hours * 3600
            cache_age = (datetime.now() - cache_entry.created_at).total_seconds()

            if cache_age > cache_ttl_seconds:
                logger.debug(f"Cache expired for {s3_key}", extra={"s3_key": s3_key})
                return None

            # 检查文件是否被修改
            try:
                _, modified_time = self._get_file_metadata(s3_key)
                if modified_time != cache_entry.modified_time:
                    logger.debug(f"File modified, cache invalid for {s3_key}", extra={"s3_key": s3_key})
                    return None
            except FileNotFoundException:
                return None

            # 缓存有效，构建结果
            content = cache_entry.content
            logger.info(f"Cache hit for {s3_key}", extra={"s3_key": s3_key})

            return ConversionResultData(
                s3_key=s3_key,
                file_name=cache_entry.file_name,
                file_type=self._get_file_extension(cache_entry.file_name).lstrip("."),
                output_format=OutputFormat(cache_entry.output_format),
                status=ConversionStatus.SUCCESS,
                total_pages=cache_entry.total_pages,
                markdown=content.get("markdown", ""),
                json_content=content.get("json", {}),
                html=content.get("html", ""),
                full_text=content.get("text", ""),
                doctags=content.get("doctags", ""),
                pages=content.get("pages", {}),
                metadata=cache_entry.doc_metadata,
                images=content.get("images", []),
                tables=content.get("tables", []),
                processing_time_ms=0.0,
            )
        finally:
            db.close()

    def _save_cache(
        self,
        cache_key: str,
        s3_key: str,
        result: ConversionResultData,
        options: ConversionOptions
    ) -> None:
        """保存转换结果到缓存"""
        if not settings.conversion.enable_cache:
            return

        db = SessionLocal()
        try:
            # 获取文件元数据
            file_size, modified_time = self._get_file_metadata(s3_key)

            # 构建内容字典
            content = {
                "markdown": result.markdown,
                "json": result.json_content,
                "html": result.html,
                "text": result.full_text,
                "doctags": result.doctags,
                "pages": result.pages,
                "images": result.images,
                "tables": result.tables,
            }

            # 检查是否已存在缓存条目
            existing = db.query(ConversionCache).filter(
                ConversionCache.cache_key == cache_key
            ).first()

            if existing:
                # 更新现有缓存
                existing.content = content
                existing.doc_metadata = result.metadata
                existing.total_pages = result.total_pages
                existing.file_size = file_size
                existing.modified_time = modified_time
                existing.updated_at = datetime.now()
            else:
                # 创建新缓存条目
                cache_entry = ConversionCache(
                    cache_key=cache_key,
                    s3_key=s3_key,
                    file_name=result.file_name,
                    file_size=file_size,
                    modified_time=modified_time,
                    total_pages=result.total_pages,
                    content=content,
                    doc_metadata=result.metadata,
                    output_format=result.output_format.value,
                )
                db.add(cache_entry)

            db.commit()
            logger.debug(f"Cache saved for {s3_key}", extra={"s3_key": s3_key})
        except Exception as e:
            logger.error(f"Failed to save cache: {e}", extra={"s3_key": s3_key})
            db.rollback()
        finally:
            db.close()

    def _update_progress(
        self,
        task_id: str,
        s3_key: str,
        status: ConversionStatus,
        progress_percent: float = 0.0,
        current_page: int = 0,
        total_pages: int = 0,
        message: str = ""
    ) -> None:
        """更新转换进度"""
        now = datetime.now()
        if task_id not in self._progress_cache:
            self._progress_cache[task_id] = ConversionProgress(
                task_id=task_id,
                s3_key=s3_key,
                status=status,
                started_at=now,
            )

        progress = self._progress_cache[task_id]
        progress.status = status
        progress.progress_percent = progress_percent
        progress.current_page = current_page
        progress.total_pages = total_pages
        progress.message = message
        progress.updated_at = now

        if status in (ConversionStatus.SUCCESS, ConversionStatus.FAILED):
            progress.completed_at = now

    def _convert_result_to_output(
        self,
        result: ConversionResult,
        output_format: OutputFormat,
        options: ConversionOptions
    ) -> dict[str, Any]:
        """将 docling 转换结果转换为指定输出格式"""
        output = {
            "markdown": "",
            "json": {},
            "html": "",
            "text": "",
            "doctags": "",
            "pages": {},
            "images": [],
            "tables": [],
        }

        if result.status != DoclingConversionStatus.SUCCESS:
            return output

        document = result.document

        # 导出为不同格式
        try:
            output["markdown"] = document.export_to_markdown(
                image_mode=options.image_export_mode
            )
        except Exception as e:
            logger.warning(f"Failed to export markdown: {e}")

        try:
            output["html"] = document.export_to_html()
        except Exception as e:
            logger.warning(f"Failed to export html: {e}")

        try:
            output["text"] = document.export_to_text()
        except Exception as e:
            logger.warning(f"Failed to export text: {e}")

        try:
            output["doctags"] = document.export_to_document_tokens()
        except Exception as e:
            logger.warning(f"Failed to export doctags: {e}")

        # 导出为 JSON
        try:
            output["json"] = document.export_to_dict()
        except Exception as e:
            logger.warning(f"Failed to export json: {e}")

        # 提取页面内容
        try:
            pages_dict = {}
            for page_no, page in document.pages.items():
                page_text = page.text if hasattr(page, 'text') else ""
                pages_dict[str(page_no)] = page_text
            output["pages"] = pages_dict
        except Exception as e:
            logger.warning(f"Failed to extract pages: {e}")

        # 提取图片信息
        if options.enable_image_extraction:
            try:
                images = []
                for picture in document.pictures:
                    img_info = {
                        "id": getattr(picture, "id", None),
                        "page": getattr(picture, "page_no", None),
                        "caption": getattr(picture, "caption", None),
                    }
                    images.append(img_info)
                output["images"] = images
            except Exception as e:
                logger.warning(f"Failed to extract images: {e}")

        # 提取表格信息
        if options.enable_table_extraction:
            try:
                tables = []
                for table in document.tables:
                    table_info = {
                        "id": getattr(table, "id", None),
                        "page": getattr(table, "page_no", None),
                        "data": getattr(table, "data", None),
                    }
                    tables.append(table_info)
                output["tables"] = tables
            except Exception as e:
                logger.warning(f"Failed to extract tables: {e}")

        return output

    def _build_conversion_result(
        self,
        s3_key: str,
        file_name: str,
        output_format: OutputFormat,
        docling_result: ConversionResult,
        converted_output: dict[str, Any],
        processing_time_ms: float
    ) -> ConversionResultData:
        """构建转换结果"""
        status = ConversionStatus.SUCCESS if docling_result.status == DoclingConversionStatus.SUCCESS else ConversionStatus.FAILED

        # 提取元数据
        metadata = {}
        if docling_result.document:
            doc = docling_result.document
            metadata = {
                "title": getattr(doc, "title", None),
                "author": getattr(doc, "author", None),
                "creation_date": getattr(doc, "creation_date", None),
                "modification_date": getattr(doc, "modification_date", None),
                "word_count": len(converted_output.get("text", "").split()),
                "char_count": len(converted_output.get("text", "")),
            }

        return ConversionResultData(
            s3_key=s3_key,
            file_name=file_name,
            file_type=self._get_file_extension(file_name).lstrip("."),
            output_format=output_format,
            status=status,
            total_pages=len(docling_result.document.pages) if docling_result.document else 0,
            markdown=converted_output.get("markdown", ""),
            json_content=converted_output.get("json", {}),
            html=converted_output.get("html", ""),
            full_text=converted_output.get("text", ""),
            doctags=converted_output.get("doctags", ""),
            pages=converted_output.get("pages", {}),
            metadata=metadata,
            images=converted_output.get("images", []),
            tables=converted_output.get("tables", []),
            processing_time_ms=processing_time_ms,
            error_message=docling_result.errors[0] if docling_result.errors else "",
        )

    def convert_file(
        self,
        s3_key: str,
        output_format: OutputFormat = OutputFormat.MARKDOWN,
        options: Optional[ConversionOptions] = None
    ) -> ConversionResultData:
        """
        转换 S3 文件

        Args:
            s3_key: S3 存储路径
            output_format: 输出格式
            options: 转换选项

        Returns:
            ConversionResultData: 转换结果

        Raises:
            FileNotFoundException: 文件不存在
            ConversionException: 转换失败
        """
        options = options or ConversionOptions()
        task_id = str(uuid.uuid4())

        logger.info(
            f"Starting conversion for {s3_key}",
            extra={
                "s3_key": s3_key,
                "output_format": output_format.value,
                "task_id": task_id,
            }
        )

        self._update_progress(
            task_id=task_id,
            s3_key=s3_key,
            status=ConversionStatus.PROCESSING,
            message="Starting conversion"
        )

        try:
            # 检查缓存
            cache_key = self._generate_cache_key(s3_key, output_format, options)
            cached_result = self._check_cache(cache_key, s3_key, options)
            if cached_result:
                self._update_progress(
                    task_id=task_id,
                    s3_key=s3_key,
                    status=ConversionStatus.SUCCESS,
                    progress_percent=100.0,
                    message="Cache hit"
                )
                return cached_result

            # 下载文件
            self._update_progress(
                task_id=task_id,
                s3_key=s3_key,
                status=ConversionStatus.PROCESSING,
                progress_percent=10.0,
                message="Downloading file"
            )

            file_data = storage_service.download(s3_key)
            file_name = s3_key.split("/")[-1]

            # 检查文件大小
            if len(file_data) > settings.conversion.max_file_size:
                raise FileTooLargeException(
                    max_size=settings.conversion.max_file_size,
                    actual_size=len(file_data)
                )

            # 执行转换
            result = self.convert_from_bytes(
                file_data=file_data,
                file_name=file_name,
                output_format=output_format,
                options=options,
                s3_key=s3_key,
                task_id=task_id
            )

            # 保存缓存
            if result.status == ConversionStatus.SUCCESS:
                self._save_cache(cache_key, s3_key, result, options)

            return result

        except FileNotFoundException:
            self._update_progress(
                task_id=task_id,
                s3_key=s3_key,
                status=ConversionStatus.FAILED,
                message="File not found"
            )
            raise
        except Exception as e:
            logger.error(f"Conversion failed: {e}", extra={"s3_key": s3_key, "task_id": task_id})
            self._update_progress(
                task_id=task_id,
                s3_key=s3_key,
                status=ConversionStatus.FAILED,
                message=str(e)
            )
            raise ConversionException(message=str(e), details={"s3_key": s3_key})

    async def convert_file_async(
        self,
        s3_key: str,
        output_format: OutputFormat = OutputFormat.MARKDOWN,
        options: Optional[ConversionOptions] = None
    ) -> ConversionResultData:
        """
        异步转换 S3 文件

        Args:
            s3_key: S3 存储路径
            output_format: 输出格式
            options: 转换选项

        Returns:
            ConversionResultData: 转换结果
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self._executor,
            self.convert_file,
            s3_key,
            output_format,
            options
        )

    def convert_from_bytes(
        self,
        file_data: bytes,
        file_name: str,
        output_format: OutputFormat = OutputFormat.MARKDOWN,
        options: Optional[ConversionOptions] = None,
        s3_key: str = "",
        task_id: str = ""
    ) -> ConversionResultData:
        """
        从字节数据转换文件

        Args:
            file_data: 文件字节数据
            file_name: 文件名
            output_format: 输出格式
            options: 转换选项
            s3_key: S3 路径（用于进度追踪）
            task_id: 任务ID（用于进度追踪）

        Returns:
            ConversionResultData: 转换结果
        """
        options = options or ConversionOptions()
        task_id = task_id or str(uuid.uuid4())
        s3_key = s3_key or file_name

        start_time = time.time()

        try:
            # 检测输入格式
            input_format = self._detect_input_format(file_name)
            docling_format = self._get_docling_format(input_format)

            self._update_progress(
                task_id=task_id,
                s3_key=s3_key,
                status=ConversionStatus.PROCESSING,
                progress_percent=30.0,
                message="Converting document"
            )

            # 创建文档流
            stream = DocumentStream(name=file_name, stream=io.BytesIO(file_data))

            # 执行转换
            docling_result = self.converter.convert(stream)

            self._update_progress(
                task_id=task_id,
                s3_key=s3_key,
                status=ConversionStatus.PROCESSING,
                progress_percent=70.0,
                total_pages=len(docling_result.document.pages) if docling_result.document else 0,
                message="Exporting to output format"
            )

            # 转换为输出格式
            converted_output = self._convert_result_to_output(
                docling_result, output_format, options
            )

            processing_time_ms = (time.time() - start_time) * 1000

            # 构建结果
            result = self._build_conversion_result(
                s3_key=s3_key,
                file_name=file_name,
                output_format=output_format,
                docling_result=docling_result,
                converted_output=converted_output,
                processing_time_ms=processing_time_ms
            )

            self._update_progress(
                task_id=task_id,
                s3_key=s3_key,
                status=result.status,
                progress_percent=100.0,
                total_pages=result.total_pages,
                message="Conversion completed"
            )

            logger.info(
                f"Conversion completed for {file_name}",
                extra={
                    "s3_key": s3_key,
                    "file_name": file_name,
                    "status": result.status.value,
                    "processing_time_ms": processing_time_ms,
                    "total_pages": result.total_pages,
                }
            )

            return result

        except UnsupportedFileTypeException:
            raise
        except Exception as e:
            logger.error(f"Conversion failed: {e}", extra={"file_name": file_name})
            processing_time_ms = (time.time() - start_time) * 1000
            return ConversionResultData(
                s3_key=s3_key,
                file_name=file_name,
                file_type=self._get_file_extension(file_name).lstrip("."),
                output_format=output_format,
                status=ConversionStatus.FAILED,
                processing_time_ms=processing_time_ms,
                error_message=str(e)
            )

    async def convert_from_bytes_async(
        self,
        file_data: bytes,
        file_name: str,
        output_format: OutputFormat = OutputFormat.MARKDOWN,
        options: Optional[ConversionOptions] = None
    ) -> ConversionResultData:
        """
        异步从字节数据转换文件

        Args:
            file_data: 文件字节数据
            file_name: 文件名
            output_format: 输出格式
            options: 转换选项

        Returns:
            ConversionResultData: 转换结果
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self._executor,
            self.convert_from_bytes,
            file_data,
            file_name,
            output_format,
            options
        )

    def convert_batch(
        self,
        s3_keys: list[str],
        output_format: OutputFormat = OutputFormat.MARKDOWN,
        options: Optional[ConversionOptions] = None
    ) -> BatchConversionResult:
        """
        批量转换文件

        Args:
            s3_keys: S3 路径列表
            output_format: 输出格式
            options: 转换选项

        Returns:
            BatchConversionResult: 批量转换结果
        """
        options = options or ConversionOptions()
        batch_id = str(uuid.uuid4())
        total_files = len(s3_keys)

        logger.info(
            f"Starting batch conversion",
            extra={"batch_id": batch_id, "total_files": total_files}
        )

        # 创建任务记录
        db = SessionLocal()
        try:
            task = ConversionTask(
                task_id=batch_id,
                task_type="batch",
                status=ConversionStatus.PROCESSING.value,
                s3_keys=s3_keys,
                total_files=total_files,
            )
            db.add(task)
            db.commit()
        finally:
            db.close()

        results: list[ConversionResultData] = []
        completed = 0
        failed = 0

        for i, s3_key in enumerate(s3_keys):
            try:
                result = self.convert_file(s3_key, output_format, options)
                results.append(result)
                if result.status == ConversionStatus.SUCCESS:
                    completed += 1
                else:
                    failed += 1
            except Exception as e:
                logger.error(f"Batch conversion failed for {s3_key}: {e}")
                failed += 1
                results.append(ConversionResultData(
                    s3_key=s3_key,
                    file_name=s3_key.split("/")[-1],
                    file_type="",
                    output_format=output_format,
                    status=ConversionStatus.FAILED,
                    error_message=str(e)
                ))

            # 更新任务进度
            db = SessionLocal()
            try:
                task = db.query(ConversionTask).filter(
                    ConversionTask.task_id == batch_id
                ).first()
                if task:
                    task.completed_files = completed
                    task.failed_files = failed
                    db.commit()
            finally:
                db.close()

        # 更新任务完成状态
        db = SessionLocal()
        try:
            task = db.query(ConversionTask).filter(
                ConversionTask.task_id == batch_id
            ).first()
            if task:
                task.status = ConversionStatus.SUCCESS.value if failed == 0 else ConversionStatus.FAILED.value
                task.completed_at = datetime.now()
                db.commit()
        finally:
            db.close()

        return BatchConversionResult(
            batch_id=batch_id,
            total_files=total_files,
            completed_files=completed,
            failed_files=failed,
            pending_files=0,
            status=ConversionStatus.SUCCESS if failed == 0 else ConversionStatus.FAILED,
            results=results,
            created_at=datetime.now(),
            completed_at=datetime.now()
        )

    async def convert_batch_async(
        self,
        s3_keys: list[str],
        output_format: OutputFormat = OutputFormat.MARKDOWN,
        options: Optional[ConversionOptions] = None
    ) -> BatchConversionResult:
        """
        异步批量转换文件

        Args:
            s3_keys: S3 路径列表
            output_format: 输出格式
            options: 转换选项

        Returns:
            BatchConversionResult: 批量转换结果
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self._executor,
            self.convert_batch,
            s3_keys,
            output_format,
            options
        )

    def get_conversion_status(self, s3_key: str) -> ConversionStatus:
        """
        获取文件转换状态

        Args:
            s3_key: S3 路径

        Returns:
            ConversionStatus: 转换状态
        """
        cache_key = self._generate_cache_key(s3_key, OutputFormat.MARKDOWN, ConversionOptions())

        db = SessionLocal()
        try:
            cache_entry = db.query(ConversionCache).filter(
                ConversionCache.cache_key == cache_key
            ).first()

            if cache_entry is None:
                return ConversionStatus.NOT_FOUND

            # 检查缓存是否过期
            cache_ttl_seconds = settings.conversion.cache_ttl_hours * 3600
            cache_age = (datetime.now() - cache_entry.created_at).total_seconds()

            if cache_age > cache_ttl_seconds:
                return ConversionStatus.NOT_FOUND

            return ConversionStatus.SUCCESS
        finally:
            db.close()

    def get_progress(self, task_id: str) -> Optional[ConversionProgress]:
        """
        获取转换进度

        Args:
            task_id: 任务ID

        Returns:
            ConversionProgress: 转换进度
        """
        return self._progress_cache.get(task_id)

    def invalidate_cache(self, s3_key: str) -> bool:
        """
        使文件缓存失效

        Args:
            s3_key: S3 路径

        Returns:
            bool: 是否成功删除缓存
        """
        db = SessionLocal()
        try:
            # 删除所有与该文件相关的缓存
            deleted = db.query(ConversionCache).filter(
                ConversionCache.s3_key == s3_key
            ).delete()
            db.commit()

            logger.info(f"Cache invalidated for {s3_key}", extra={"s3_key": s3_key, "deleted": deleted})
            return deleted > 0
        except Exception as e:
            logger.error(f"Failed to invalidate cache: {e}", extra={"s3_key": s3_key})
            db.rollback()
            return False
        finally:
            db.close()

    def get_supported_formats(self) -> dict[str, list[str]]:
        """
        获取支持的输入格式

        Returns:
            dict: 按类别分组的格式列表
        """
        return {
            "documents": [".pdf", ".docx", ".doc", ".pptx", ".ppt", ".xlsx", ".xls"],
            "web": [".html", ".htm"],
            "text": [".txt", ".text", ".md", ".markdown", ".xml"],
            "data": [".csv", ".json"],
            "images": [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".tif"],
        }

    def get_supported_output_formats(self) -> list[dict[str, str]]:
        """
        获取支持的输出格式

        Returns:
            list: 输出格式信息列表
        """
        return [
            {"format": "markdown", "description": "Markdown format with structure", "mime_type": "text/markdown"},
            {"format": "json", "description": "JSON representation of document", "mime_type": "application/json"},
            {"format": "html", "description": "HTML format", "mime_type": "text/html"},
            {"format": "text", "description": "Plain text", "mime_type": "text/plain"},
            {"format": "doctags", "description": "Docling document tokens", "mime_type": "text/plain"},
        ]

    def get_cache_stats(self) -> dict[str, Any]:
        """
        获取缓存统计信息

        Returns:
            dict: 缓存统计信息
        """
        db = SessionLocal()
        try:
            total_entries = db.query(ConversionCache).count()

            oldest = db.query(ConversionCache).order_by(ConversionCache.created_at).first()
            newest = db.query(ConversionCache).order_by(ConversionCache.created_at.desc()).first()

            return {
                "total_entries": total_entries,
                "oldest_entry": oldest.created_at if oldest else None,
                "newest_entry": newest.created_at if newest else None,
            }
        finally:
            db.close()


# 全局服务实例
docling_service = DoclingService()
