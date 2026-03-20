"""
MinerU Service - 使用 MinerU API 进行 PDF 渲染服务

支持:
- PDF 转 Markdown
- 图片提取
- 表格提取
- 两种 API 模式: Precision API (需要 token) 和 Agent API (无需认证)

使用方式:
    from services.mineru_service import mineru_service

    # 从 URL 渲染
    result = await mineru_service.render_from_url("https://example.com/doc.pdf")

    # 从 S3 渲染
    result = await mineru_service.render_from_s3("pdfs/document.pdf")

    # 获取任务状态
    status = await mineru_service.get_task_result(task_id)
"""

import asyncio
import base64
import io
import json
import os
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
from concurrent.futures import ThreadPoolExecutor

import httpx

from config import settings
from lib.exceptions import (
    FileNotFoundException,
    PdfConversionException,
    TimeoutException,
)
from lib.logging_config import get_logger
from services.storage_service import storage_service

logger = get_logger(__name__)


class RenderBackend(Enum):
    """渲染后端枚举"""
    DOCLING = "docling"  # 本地 Docling 渲染
    MINERU_PRECISION = "mineru_precision"  # MinerU Precision API (需要 token)
    MINERU_AGENT = "mineru_agent"  # MinerU Agent API (无需认证)


class RenderStatus(Enum):
    """渲染状态枚举"""
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    TIMEOUT = "timeout"


@dataclass
class RenderOptions:
    """渲染选项"""
    backend: RenderBackend = RenderBackend.DOCLING
    language: str = "ch"  # 语言: en, ch
    is_ocr: bool = False
    enable_formula: bool = True
    enable_table: bool = True
    page_ranges: Optional[str] = None  # 页码范围，如 "1-10" 或 "1,3,5-7"
    model_version: str = "vlm"  # vlm, pipeline, MinerU-HTML
    poll_interval: int = 5  # 轮询间隔（秒）
    timeout: int = 300  # 超时时间（秒）


@dataclass
class ImageInfo:
    """图片信息"""
    id: str
    page: int
    filename: str
    base64_data: Optional[str] = None
    s3_key: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None


@dataclass
class RenderResult:
    """渲染结果"""
    status: RenderStatus
    s3_key: str = ""
    task_id: str = ""
    markdown: str = ""
    html: str = ""
    total_pages: int = 0
    images: list[ImageInfo] = field(default_factory=list)
    tables: list[dict] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)
    error_message: str = ""
    processing_time_ms: float = 0.0
    backend: RenderBackend = RenderBackend.DOCLING


class MinerUService:
    """
    MinerU PDF 渲染服务

    提供统一的 PDF 渲染接口，支持多种后端:
    1. Docling - 本地渲染，无需网络
    2. MinerU Precision API - 云端渲染，需要 token，支持大文件
    3. MinerU Agent API - 云端渲染，无需 token，限制较小
    """

    def __init__(self):
        self._executor = ThreadPoolExecutor(max_workers=4)
        self._mineru_base_url = "https://mineru.net/api/v1/agent"
        self._precision_base_url = "https://mineru.net/api/v4"
        logger.info("MinerUService initialized")

    @property
    def mineru_token(self) -> Optional[str]:
        """获取 MinerU Token"""
        return os.environ.get("MINERU_TOKEN") or getattr(settings, "mineru_token", None)

    @property
    def is_precision_api_available(self) -> bool:
        """检查 Precision API 是否可用"""
        return bool(self.mineru_token)

    def _get_default_options(self) -> RenderOptions:
        """获取默认渲染选项"""
        backend = RenderBackend.MINERU_AGENT
        if self.is_precision_api_available:
            backend = RenderBackend.MINERU_PRECISION

        return RenderOptions(
            backend=backend,
            language="ch",
            enable_formula=True,
            enable_table=True,
        )

    async def render_from_url(
        self,
        url: str,
        options: Optional[RenderOptions] = None,
    ) -> RenderResult:
        """
        从 URL 渲染 PDF

        Args:
            url: PDF 文件 URL
            options: 渲染选项

        Returns:
            RenderResult: 渲染结果
        """
        options = options or self._get_default_options()
        start_time = time.time()

        logger.info(f"Rendering PDF from URL: {url}", extra={"url": url, "backend": options.backend.value})

        try:
            if options.backend == RenderBackend.MINERU_AGENT:
                return await self._render_agent_api(url, options, start_time)
            elif options.backend == RenderBackend.MINERU_PRECISION:
                return await self._render_precision_api(url, options, start_time)
            else:
                raise ValueError(f"Unsupported backend for URL rendering: {options.backend.value}")
        except Exception as e:
            logger.error(f"Failed to render from URL: {e}", extra={"url": url})
            return RenderResult(
                status=RenderStatus.FAILED,
                error_message=str(e),
                processing_time_ms=(time.time() - start_time) * 1000,
            )

    async def render_from_s3(
        self,
        s3_key: str,
        options: Optional[RenderOptions] = None,
    ) -> RenderResult:
        """
        从 S3 渲染 PDF

        Args:
            s3_key: S3 存储路径
            options: 渲染选项

        Returns:
            RenderResult: 渲染结果
        """
        options = options or self._get_default_options()
        start_time = time.time()

        logger.info(f"Rendering PDF from S3: {s3_key}", extra={"s3_key": s3_key, "backend": options.backend.value})

        try:
            # 下载文件
            file_data = storage_service.download(s3_key)
            file_size = len(file_data)

            # 检查文件大小
            if file_size > 200 * 1024 * 1024:  # 200MB
                raise ValueError(f"File too large: {file_size} bytes (max: 200MB)")

            # 上传到临时 URL
            if options.backend in (RenderBackend.MINERU_AGENT, RenderBackend.MINERU_PRECISION):
                upload_url, file_url = await self._upload_to_oss(file_data, s3_key)
                return await self.render_from_url(file_url, options)

            # Docling 本地渲染
            return await self._render_docling(file_data, s3_key, options, start_time)

        except FileNotFoundException:
            raise
        except Exception as e:
            logger.error(f"Failed to render from S3: {e}", extra={"s3_key": s3_key})
            return RenderResult(
                status=RenderStatus.FAILED,
                s3_key=s3_key,
                error_message=str(e),
                processing_time_ms=(time.time() - start_time) * 1000,
                backend=options.backend,
            )

    async def render_from_bytes(
        self,
        file_data: bytes,
        filename: str,
        options: Optional[RenderOptions] = None,
    ) -> RenderResult:
        """
        从字节数据渲染 PDF

        Args:
            file_data: PDF 文件字节数据
            filename: 文件名
            options: 渲染选项

        Returns:
            RenderResult: 渲染结果
        """
        options = options or self._get_default_options()
        start_time = time.time()

        logger.info(f"Rendering PDF from bytes: {filename}", extra={"filename": filename, "backend": options.backend.value})

        try:
            if options.backend in (RenderBackend.MINERU_AGENT, RenderBackend.MINERU_PRECISION):
                upload_url, file_url = await self._upload_to_oss(file_data, filename)
                return await self.render_from_url(file_url, options)

            return await self._render_docling(file_data, filename, options, start_time)

        except Exception as e:
            logger.error(f"Failed to render from bytes: {e}", extra={"filename": filename})
            return RenderResult(
                status=RenderStatus.FAILED,
                error_message=str(e),
                processing_time_ms=(time.time() - start_time) * 1000,
                backend=options.backend,
            )

    async def _render_agent_api(
        self,
        url: str,
        options: RenderOptions,
        start_time: float,
    ) -> RenderResult:
        """使用 MinerU Agent API 渲染"""
        async with httpx.AsyncClient(timeout=options.timeout) as client:
            # 1. 创建任务
            create_response = await client.post(
                f"{self._mineru_base_url}/parse/url",
                json={"url": url, "language": options.language},
            )
            create_response.raise_for_status()
            data = create_response.json()

            if data.get("code") != 0:
                raise Exception(f"MinerU API error: {data.get('msg')}")

            task_id = data["data"]["task_id"]
            logger.info(f"Agent API task created: {task_id}")

            # 2. 轮询任务状态
            result = await self._poll_agent_task(client, task_id, options)

            result.processing_time_ms = (time.time() - start_time) * 1000
            result.backend = RenderBackend.MINERU_AGENT
            return result

    async def _poll_agent_task(
        self,
        client: httpx.AsyncClient,
        task_id: str,
        options: RenderOptions,
    ) -> RenderResult:
        """轮询 Agent API 任务状态"""
        start_time = time.time()
        poll_interval = options.poll_interval or 5

        while (time.time() - start_time) < options.timeout:
            response = await client.get(f"{self._mineru_base_url}/parse/{task_id}")
            response.raise_for_status()
            data = response.json()

            if data.get("code") != 0:
                raise Exception(f"MinerU API error: {data.get('msg')}")

            result_data = data["data"]
            state = result_data.get("state")

            logger.debug(f"Task {task_id} state: {state}")

            if state == "done":
                return RenderResult(
                    status=RenderStatus.SUCCESS,
                    task_id=task_id,
                    markdown=result_data.get("markdown", ""),
                    total_pages=result_data.get("total_pages", 0),
                    metadata=result_data,
                )
            elif state in ("failed", "error"):
                return RenderResult(
                    status=RenderStatus.FAILED,
                    task_id=task_id,
                    error_message=result_data.get("err_msg", "Task failed"),
                )

            await asyncio.sleep(poll_interval)

        return RenderResult(
            status=RenderStatus.TIMEOUT,
            task_id=task_id,
            error_message=f"Task timed out after {options.timeout} seconds",
        )

    async def _render_precision_api(
        self,
        url: str,
        options: RenderOptions,
        start_time: float,
    ) -> RenderResult:
        """使用 MinerU Precision API 渲染"""
        if not self.mineru_token:
            raise ValueError("MINERU_TOKEN is required for Precision API")

        headers = {
            "Authorization": f"Bearer {self.mineru_token}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=options.timeout) as client:
            # 1. 创建任务
            request_body = {
                "url": url,
                "language": options.language,
                "is_ocr": options.is_ocr,
                "enable_formula": options.enable_formula,
                "enable_table": options.enable_table,
                "model_version": options.model_version,
            }
            if options.page_ranges:
                request_body["page_ranges"] = options.page_ranges

            create_response = await client.post(
                f"{self._precision_base_url}/extract/task",
                json=request_body,
                headers=headers,
            )
            create_response.raise_for_status()
            data = create_response.json()

            if data.get("code") != 0:
                raise Exception(f"MinerU API error: {data.get('msg')}")

            task_id = data["data"]["task_id"]
            logger.info(f"Precision API task created: {task_id}")

            # 2. 轮询任务状态
            result = await self._poll_precision_task(client, task_id, options, start_time)
            result.backend = RenderBackend.MINERU_PRECISION
            return result

    async def _poll_precision_task(
        self,
        client: httpx.AsyncClient,
        task_id: str,
        options: RenderOptions,
        start_time: float,
    ) -> RenderResult:
        """轮询 Precision API 任务状态"""
        headers = {"Authorization": f"Bearer {self.mineru_token}"}
        poll_interval = options.poll_interval or 5

        while (time.time() - start_time) < options.timeout:
            response = await client.get(
                f"{self._precision_base_url}/extract/task/{task_id}",
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()

            if data.get("code") != 0:
                raise Exception(f"MinerU API error: {data.get('msg')}")

            result_data = data["data"]
            state = result_data.get("state")

            logger.debug(f"Task {task_id} state: {state}")

            if state == "done":
                # 下载结果 ZIP
                zip_url = result_data.get("full_zip_url")
                if zip_url:
                    # 下载并提取 ZIP
                    zip_data = await self._download_bytes(zip_url)
                    markdown, images = await self._extract_from_zip(zip_data)

                    return RenderResult(
                        status=RenderStatus.SUCCESS,
                        task_id=task_id,
                        markdown=markdown,
                        images=images,
                        total_pages=result_data.get("extract_progress", {}).get("total_pages", 0),
                        metadata=result_data,
                    )
                else:
                    return RenderResult(
                        status=RenderStatus.SUCCESS,
                        task_id=task_id,
                        total_pages=result_data.get("extract_progress", {}).get("total_pages", 0),
                        metadata=result_data,
                    )
            elif state == "failed":
                return RenderResult(
                    status=RenderStatus.FAILED,
                    task_id=task_id,
                    error_message=result_data.get("err_msg", "Task failed"),
                )

            await asyncio.sleep(poll_interval)

        return RenderResult(
            status=RenderStatus.TIMEOUT,
            task_id=task_id,
            error_message=f"Task timed out after {options.timeout} seconds",
        )

    async def _render_docling(
        self,
        file_data: bytes,
        filename: str,
        options: RenderOptions,
        start_time: float,
    ) -> RenderResult:
        """使用 Docling 本地渲染"""
        try:
            from docling.document_converter import DocumentConverter
            from docling_core.types.io import DocumentStream

            converter = DocumentConverter()
            stream = DocumentStream(name=filename, stream=io.BytesIO(file_data))
            result = converter.convert(stream)
            doc = result.document

            if not doc:
                return RenderResult(
                    status=RenderStatus.FAILED,
                    error_message="Failed to parse PDF document",
                    backend=RenderBackend.DOCLING,
                )

            # 导出为 Markdown
            markdown = doc.export_to_markdown()

            # 提取图片信息
            images = []
            for i, picture in enumerate(doc.pictures or []):
                img_info = ImageInfo(
                    id=f"img_{i}",
                    page=getattr(picture, "page_no", 0),
                    filename=getattr(picture, "caption", f"image_{i}.png") or f"image_{i}.png",
                )
                images.append(img_info)

            # 提取表格
            tables = []
            for i, table in enumerate(doc.tables or []):
                tables.append({
                    "id": f"table_{i}",
                    "page": getattr(table, "page_no", 0),
                    "data": getattr(table, "data", None),
                })

            return RenderResult(
                status=RenderStatus.SUCCESS,
                markdown=markdown,
                total_pages=doc.num_pages() if hasattr(doc, "num_pages") else 0,
                images=images,
                tables=tables,
                processing_time_ms=(time.time() - start_time) * 1000,
                backend=RenderBackend.DOCLING,
            )

        except ImportError:
            return RenderResult(
                status=RenderStatus.FAILED,
                error_message="Docling is not installed. Install with: pip install docling",
                backend=RenderBackend.DOCLING,
            )
        except Exception as e:
            logger.error(f"Docling rendering failed: {e}")
            return RenderResult(
                status=RenderStatus.FAILED,
                error_message=str(e),
                backend=RenderBackend.DOCLING,
            )

    async def _upload_to_oss(
        self,
        file_data: bytes,
        filename: str,
    ) -> tuple[str, str]:
        """上传文件到 OSS 并返回上传 URL 和文件 URL"""
        async with httpx.AsyncClient() as client:
            # 1. 获取上传 URL
            file_name = filename.split("/")[-1] if "/" in filename else filename
            response = await client.post(
                f"{self._mineru_base_url}/parse/file",
                json={"file_name": file_name},
            )
            response.raise_for_status()
            data = response.json()

            if data.get("code") != 0:
                raise Exception(f"Failed to get upload URL: {data.get('msg')}")

            upload_url = data["data"]["file_url"]
            task_id = data["data"]["task_id"]

            # 2. 上传文件
            upload_response = await client.put(
                upload_url,
                content=file_data,
                headers={"Content-Type": "application/octet-stream"},
            )
            upload_response.raise_for_status()

            # 3. 返回文件 URL（用于后续处理）
            # 注意：实际上文件已经上传，我们用相同的 URL 来引用它
            return upload_url, upload_url

    async def _download_bytes(self, url: str) -> bytes:
        """下载文件"""
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            response.raise_for_status()
            return response.content

    async def _extract_from_zip(self, zip_data: bytes) -> tuple[str, list[ImageInfo]]:
        """从 ZIP 数据中提取 Markdown 和图片"""
        import zipfile

        markdown = ""
        images = []

        try:
            with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
                # 提取 full.md
                if "full.md" in zf.namelist():
                    markdown = zf.read("full.md").decode("utf-8")
                elif "full.txt" in zf.namelist():
                    markdown = zf.read("full.txt").decode("utf-8")

                # 提取图片
                for name in zf.namelist():
                    if name.startswith("images/") or name.endswith((".png", ".jpg", ".jpeg", ".gif")):
                        img_data = zf.read(name)
                        img_id = f"img_{len(images)}"
                        img_info = ImageInfo(
                            id=img_id,
                            page=0,
                            filename=name.split("/")[-1],
                            base64_data=base64.b64encode(img_data).decode("utf-8"),
                        )
                        images.append(img_info)

        except Exception as e:
            logger.warning(f"Failed to extract from ZIP: {e}")

        return markdown, images

    async def get_task_result(
        self,
        task_id: str,
        backend: RenderBackend = RenderBackend.MINERU_AGENT,
    ) -> dict:
        """获取任务结果"""
        if backend == RenderBackend.MINERU_AGENT:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self._mineru_base_url}/parse/{task_id}")
                response.raise_for_status()
                return response.json()
        else:
            if not self.mineru_token:
                raise ValueError("MINERU_TOKEN is required for Precision API")

            headers = {"Authorization": f"Bearer {self.mineru_token}"}
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self._precision_base_url}/extract/task/{task_id}",
                    headers=headers,
                )
                response.raise_for_status()
                return response.json()

    def get_available_backends(self) -> list[dict]:
        """获取可用的渲染后端"""
        backends = [
            {
                "backend": "docling",
                "name": "Docling (本地)",
                "description": "本地渲染，无需网络，限制较少",
                "available": True,
                "requires_token": False,
            },
            {
                "backend": "mineru_agent",
                "name": "MinerU Agent API",
                "description": "云端渲染，无需认证，限制较小 (≤10MB, ≤20页)",
                "available": True,
                "requires_token": False,
            },
            {
                "backend": "mineru_precision",
                "name": "MinerU Precision API",
                "description": "云端渲染，需要认证，支持大文件 (≤200MB, ≤600页)",
                "available": self.is_precision_api_available,
                "requires_token": True,
            },
        ]
        return backends


# 全局服务实例
mineru_service = MinerUService()
