"""
PDF Rendering Router - PDF 渲染 API

提供 PDF 转 Markdown 和图片提取功能，支持多种后端:
- Docling: 本地渲染
- MinerU Agent API: 云端渲染，无需认证
- MinerU Precision API: 云端渲染，需要认证
"""

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from lib.logging_config import get_logger
from lib.schemas import COMMON_RESPONSES
from models.pdf_render_model import (
    AvailableBackendsResponse,
    ImageInfoResponse,
    RenderBackendType,
    RenderFromS3Request,
    RenderFromUrlRequest,
    RenderOptionsRequest,
    RenderResultResponse,
    RenderStatusType,
    TaskStatusRequest,
    TaskStatusResponse,
)
from services.mineru_service import mineru_service, RenderBackend, RenderOptions

router = APIRouter(prefix="/render", tags=["pdf-render"])
logger = get_logger(__name__)


def _convert_backend(backend_type: RenderBackendType) -> RenderBackend:
    """将 API 类型转换为服务类型"""
    mapping = {
        RenderBackendType.DOCLING: RenderBackend.DOCLING,
        RenderBackendType.MINERU_PRECISION: RenderBackend.MINERU_PRECISION,
        RenderBackendType.MINERU_AGENT: RenderBackend.MINERU_AGENT,
    }
    return mapping.get(backend_type, RenderBackend.MINERU_AGENT)


def _convert_result(result) -> RenderResultResponse:
    """转换渲染结果"""
    status_map = {
        "pending": RenderStatusType.PENDING,
        "processing": RenderStatusType.PROCESSING,
        "success": RenderStatusType.SUCCESS,
        "failed": RenderStatusType.FAILED,
        "timeout": RenderStatusType.TIMEOUT,
    }

    images = [
        ImageInfoResponse(
            id=img.id,
            page=img.page,
            filename=img.filename,
            base64_data=img.base64_data,
            s3_key=img.s3_key,
            width=img.width,
            height=img.height,
        )
        for img in result.images
    ]

    backend_map = {
        RenderBackend.DOCLING: RenderBackendType.DOCLING,
        RenderBackend.MINERU_PRECISION: RenderBackendType.MINERU_PRECISION,
        RenderBackend.MINERU_AGENT: RenderBackendType.MINERU_AGENT,
    }

    return RenderResultResponse(
        success=result.status.value in ("success",),
        status=status_map.get(result.status.value, RenderStatusType.PROCESSING),
        task_id=result.task_id,
        s3_key=result.s3_key,
        markdown=result.markdown,
        html=result.html,
        total_pages=result.total_pages,
        images=images,
        tables=result.tables,
        metadata=result.metadata,
        error_message=result.error_message,
        processing_time_ms=result.processing_time_ms,
        backend=backend_map.get(result.backend, RenderBackendType.MINERU_AGENT),
    )


@router.post(
    "/from-url",
    response_model=RenderResultResponse,
    summary="从 URL 渲染 PDF",
    description="""
    从 URL 渲染 PDF 文件，支持多种后端:

    1. **Docling (docling)**: 本地渲染，无需网络
    2. **MinerU Agent API (mineru_agent)**: 云端渲染，无需认证，限制较小 (≤10MB, ≤20页)
    3. **MinerU Precision API (mineru_precision)**: 云端渲染，需要认证，支持大文件 (≤200MB, ≤600页)

    返回:
    - Markdown 格式的文档内容
    - 提取的图片列表（包含 Base64 数据）
    - 提取的表格列表
    """,
    operation_id="renderPdfFromUrl",
    responses={
        status.HTTP_200_OK: {"model": RenderResultResponse},
        **COMMON_RESPONSES,
    },
)
async def render_from_url(request: RenderFromUrlRequest) -> RenderResultResponse:
    """从 URL 渲染 PDF"""
    logger.info(f"Rendering PDF from URL: {request.url}", extra={"url": request.url})

    try:
        options = RenderOptions(
            backend=_convert_backend(request.options.backend),
            language=request.options.language,
            is_ocr=request.options.is_ocr,
            enable_formula=request.options.enable_formula,
            enable_table=request.options.enable_table,
            page_ranges=request.options.page_ranges,
            model_version=request.options.model_version,
        )

        result = await mineru_service.render_from_url(request.url, options)
        return _convert_result(result)

    except Exception as e:
        logger.error(f"Failed to render from URL: {e}", extra={"url": request.url})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to render PDF: {str(e)}",
        )


@router.post(
    "/from-s3",
    response_model=RenderResultResponse,
    summary="从 S3 渲染 PDF",
    description="""
    从 S3 存储渲染 PDF 文件。

    支持的后端同 /render/from-url。

    返回:
    - Markdown 格式的文档内容
    - 提取的图片列表
    - 提取的表格列表
    """,
    operation_id="renderPdfFromS3",
    responses={
        status.HTTP_200_OK: {"model": RenderResultResponse},
        **COMMON_RESPONSES,
    },
)
async def render_from_s3(request: RenderFromS3Request) -> RenderResultResponse:
    """从 S3 渲染 PDF"""
    logger.info(f"Rendering PDF from S3: {request.s3_key}", extra={"s3_key": request.s3_key})

    try:
        options = RenderOptions(
            backend=_convert_backend(request.options.backend),
            language=request.options.language,
            is_ocr=request.options.is_ocr,
            enable_formula=request.options.enable_formula,
            enable_table=request.options.enable_table,
            page_ranges=request.options.page_ranges,
            model_version=request.options.model_version,
        )

        result = await mineru_service.render_from_s3(request.s3_key, options)
        return _convert_result(result)

    except Exception as e:
        logger.error(f"Failed to render from S3: {e}", extra={"s3_key": request.s3_key})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to render PDF: {str(e)}",
        )


@router.get(
    "/task/{task_id}",
    response_model=TaskStatusResponse,
    summary="查询渲染任务状态",
    description="查询 MinerU 渲染任务的状态和结果",
    operation_id="getRenderTaskStatus",
    responses={
        status.HTTP_200_OK: {"model": TaskStatusResponse},
        **COMMON_RESPONSES,
    },
)
async def get_task_status(
    task_id: str,
    backend: RenderBackendType = RenderBackendType.MINERU_AGENT,
) -> TaskStatusResponse:
    """查询渲染任务状态"""
    logger.info(f"Getting task status: {task_id}", extra={"task_id": task_id, "backend": backend})

    try:
        data = await mineru_service.get_task_result(task_id, _convert_backend(backend))

        # 解析状态
        state = data.get("data", {}).get("state", "pending")
        status_map = {
            "pending": RenderStatusType.PENDING,
            "waiting-file": RenderStatusType.PROCESSING,
            "uploading": RenderStatusType.PROCESSING,
            "running": RenderStatusType.PROCESSING,
            "done": RenderStatusType.SUCCESS,
            "failed": RenderStatusType.FAILED,
        }

        return TaskStatusResponse(
            success=data.get("code") == 0,
            task_id=task_id,
            status=status_map.get(state, RenderStatusType.PROCESSING),
            data=data.get("data"),
            error_message=data.get("msg", ""),
        )

    except Exception as e:
        logger.error(f"Failed to get task status: {e}", extra={"task_id": task_id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get task status: {str(e)}",
        )


@router.get(
    "/backends",
    response_model=AvailableBackendsResponse,
    summary="获取可用渲染后端",
    description="获取所有可用的 PDF 渲染后端信息",
    operation_id="getAvailableBackends",
)
async def get_available_backends() -> AvailableBackendsResponse:
    """获取可用后端"""
    backends = mineru_service.get_available_backends()

    # 确定默认后端
    default_backend = RenderBackendType.MINERU_AGENT
    if mineru_service.is_precision_api_available:
        default_backend = RenderBackendType.MINERU_PRECISION

    return AvailableBackendsResponse(
        backends=backends,
        default_backend=default_backend,
        precision_api_available=mineru_service.is_precision_api_available,
    )
