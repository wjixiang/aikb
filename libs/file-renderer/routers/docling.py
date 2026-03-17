"""
Docling Router - 统一文件转换 API

提供文件格式转换、文本提取、分页查询等功能，支持:
- 文件上传转换
- URL转换
- S3文件转换
- 批量转换
- 转换状态查询
- 转换结果获取
"""

import io
import uuid
from typing import Optional

import httpx
from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import JSONResponse

from config import settings
from lib.exceptions import (
    ConversionException,
    FileNotFoundException,
    FileTooLargeException,
    TimeoutException,
    UnsupportedFileTypeException,
)
from lib.logging_config import get_logger
from models.docling_model import (
    AllPagesRequest,
    AllPagesResponse,
    BatchConvertItem,
    BatchConvertRequest,
    BatchConvertResponse,
    BatchStatusRequest,
    BatchStatusResponse,
    CacheStatsResponse,
    ConversionErrorResponse,
    ConversionOptions,
    ConversionProgressRequest,
    ConversionProgressResponse,
    ConversionResultRequest,
    ConversionResultResponse,
    ConversionStatus,
    ConversionStatusRequest,
    ConversionStatusResponse,
    ConvertFromS3Request,
    ConvertFromUploadRequest,
    ConvertFromUrlRequest,
    ConvertRequest,
    ConvertResponse,
    DoclingBatchRequest,
    DoclingConfig,
    DoclingConvertRequest,
    DoclingConvertResponse,
    DoclingResultResponse,
    DoclingS3Request,
    DoclingStatusResponse,
    DoclingTaskStatus,
    DoclingUrlRequest,
    ImageExportMode,
    InvalidateCacheRequest,
    InvalidateCacheResponse,
    OutputFormat,
    OutputFormatInfo,
    PageContentRequest,
    PageContentResponse,
    SupportedFormatsResponse,
    TextContentRequest,
    TextContentResponse,
)
from services.docling_service import (
    ConversionOptions as ServiceConversionOptions,
    ConversionResultData,
    DoclingService,
    OutputFormat as ServiceOutputFormat,
)
from services.storage_service import storage_service

logger = get_logger(__name__)
router = APIRouter(tags=["docling"], prefix="/docling")

# 服务实例
docling_service = DoclingService()


def _map_service_options(options: ConversionOptions) -> ServiceConversionOptions:
    """将API选项映射到服务选项"""
    from docling.datamodel.base_models import ImageRefMode

    image_mode = ImageRefMode.REFERENCED
    if options.image_extraction.export_mode == ImageExportMode.OMITTED:
        image_mode = ImageRefMode.OMITTED
    elif options.image_extraction.export_mode == ImageExportMode.EMBEDDED:
        image_mode = ImageRefMode.EMBEDDED

    return ServiceConversionOptions(
        enable_ocr=options.ocr.enabled,
        ocr_language=options.ocr.languages,
        enable_table_extraction=options.table_extraction.enabled,
        table_export_format=options.table_extraction.export_format,
        enable_image_extraction=options.image_extraction.enabled,
        image_export_mode=image_mode,
        enable_structure_extraction=options.structure.enabled,
        extract_headings=options.structure.extract_headings,
        extract_lists=options.structure.extract_lists,
        page_size=options.pagination.page_size,
        preserve_page_breaks=options.pagination.preserve_page_breaks,
        force_refresh=options.force_refresh,
        timeout_seconds=options.timeout_seconds,
    )


def _map_docling_request_to_options(request: DoclingConvertRequest) -> ServiceConversionOptions:
    """将Docling请求映射到服务选项"""
    return ServiceConversionOptions(
        enable_ocr=request.do_ocr,
        enable_table_extraction=request.do_table_structure,
        do_picture_description=request.do_picture_description,
        do_picture_classification=request.do_picture_classification,
        timeout_seconds=request.timeout_seconds,
    )


def _map_service_output_format(fmt: OutputFormat) -> ServiceOutputFormat:
    """将API输出格式映射到服务输出格式"""
    mapping = {
        OutputFormat.MARKDOWN: ServiceOutputFormat.MARKDOWN,
        OutputFormat.JSON: ServiceOutputFormat.JSON,
        OutputFormat.HTML: ServiceOutputFormat.HTML,
        OutputFormat.TEXT: ServiceOutputFormat.TEXT,
        OutputFormat.DOCTAGS: ServiceOutputFormat.DOCTAGS,
    }
    return mapping.get(fmt, ServiceOutputFormat.MARKDOWN)


def _map_service_result(result: ConversionResultData) -> ConversionResultResponse:
    """将服务结果映射到API响应"""
    return ConversionResultResponse(
        success=result.status == ConversionStatus.SUCCESS,
        s3_key=result.s3_key,
        file_name=result.file_name,
        file_type=result.file_type,
        output_format=OutputFormat(result.output_format.value),
        status=ConversionStatus(result.status.value),
        total_pages=result.total_pages,
        markdown=result.markdown,
        json_content=result.json_content,
        html=result.html,
        text=result.full_text,
        doctags=result.doctags,
        metadata=result.metadata,
        images=result.images,
        tables=result.tables,
        processing_time_ms=result.processing_time_ms,
        error_message=result.error_message,
    )


def _map_service_result_to_docling(result: ConversionResultData, task_id: str) -> DoclingConvertResponse:
    """将服务结果映射到Docling响应"""
    # 根据输出格式选择对应的内容
    content = result.markdown
    if result.output_format == ServiceOutputFormat.JSON:
        content = str(result.json_content)
    elif result.output_format == ServiceOutputFormat.HTML:
        content = result.html
    elif result.output_format == ServiceOutputFormat.TEXT:
        content = result.full_text
    elif result.output_format == ServiceOutputFormat.DOCTAGS:
        content = result.doctags

    return DoclingConvertResponse(
        success=result.status == ConversionStatus.SUCCESS,
        task_id=task_id,
        s3_key=result.s3_key,
        file_name=result.file_name,
        output_format=OutputFormat(result.output_format.value),
        status=ConversionStatus(result.status.value),
        content=content,
        metadata=result.metadata,
        processing_time_ms=result.processing_time_ms,
        error_message=result.error_message,
    )


# ============================================================================
# Docling 专用接口
# ============================================================================

@router.post(
    "/convert",
    response_model=DoclingConvertResponse,
    summary="上传文件并转换",
    description="上传文件并使用Docling进行转换，支持PDF、DOCX、PPTX、XLSX、HTML、Markdown、TXT等多种格式",
    responses={
        200: {"description": "转换成功"},
        413: {"description": "文件过大", "model": ConversionErrorResponse},
        415: {"description": "不支持的文件类型", "model": ConversionErrorResponse},
        422: {"description": "转换失败", "model": ConversionErrorResponse},
    },
)
async def docling_convert_upload(
    file: UploadFile = File(..., description="要转换的文件"),
    output_format: OutputFormat = Form(OutputFormat.MARKDOWN, description="输出格式"),
    do_ocr: bool = Form(True, description="是否启用OCR"),
    do_table_structure: bool = Form(True, description="是否启用表格结构识别"),
    do_picture_description: bool = Form(False, description="是否启用图片描述"),
    do_picture_classification: bool = Form(False, description="是否启用图片分类"),
):
    """
    上传文件并转换

    直接上传文件进行转换，无需预先上传到S3。
    支持PDF、DOCX、PPTX、XLSX、HTML、Markdown、TXT等格式。

    - **file**: 要转换的文件
    - **output_format**: 输出格式 (markdown, json, html, text, doctags)
    - **do_ocr**: 是否启用OCR识别
    - **do_table_structure**: 是否启用表格结构识别
    - **do_picture_description**: 是否启用图片描述
    - **do_picture_classification**: 是否启用图片分类
    """
    task_id = str(uuid.uuid4())

    try:
        # 读取文件内容
        file_data = await file.read()

        # 检查文件大小
        if len(file_data) > settings.conversion.max_file_size:
            raise FileTooLargeException(
                max_size=settings.conversion.max_file_size,
                actual_size=len(file_data),
            )

        # 构建转换选项
        options = ServiceConversionOptions(
            enable_ocr=do_ocr,
            enable_table_extraction=do_table_structure,
            do_picture_description=do_picture_description,
            do_picture_classification=do_picture_classification,
        )
        service_format = _map_service_output_format(output_format)

        # 执行转换
        result = await docling_service.convert_from_bytes_async(
            file_data=file_data,
            file_name=file.filename or "unknown",
            output_format=service_format,
            options=options,
        )

        return _map_service_result_to_docling(result, task_id)

    except FileTooLargeException as e:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(e))
    except UnsupportedFileTypeException as e:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error during file upload conversion: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.post(
    "/convert-from-url",
    response_model=DoclingConvertResponse,
    summary="从URL转换文件",
    description="从指定URL下载文件并使用Docling进行转换",
    responses={
        200: {"description": "转换成功"},
        400: {"description": "URL无效或下载失败", "model": ConversionErrorResponse},
        413: {"description": "文件过大", "model": ConversionErrorResponse},
        415: {"description": "不支持的文件类型", "model": ConversionErrorResponse},
    },
)
async def docling_convert_from_url(request: DoclingUrlRequest):
    """
    从URL转换文件

    从指定URL下载文件并使用Docling进行转换。
    URL必须返回可下载的文件内容。

    - **url**: 文件URL
    - **output_format**: 输出格式
    - **do_ocr**: 是否启用OCR
    - **do_table_structure**: 是否启用表格结构识别
    - **do_picture_description**: 是否启用图片描述
    - **do_picture_classification**: 是否启用图片分类
    """
    task_id = str(uuid.uuid4())

    try:
        # 下载文件
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(request.url)
            response.raise_for_status()
            file_data = response.content

        # 检查文件大小
        if len(file_data) > settings.conversion.max_file_size:
            raise FileTooLargeException(
                max_size=settings.conversion.max_file_size,
                actual_size=len(file_data),
            )

        # 从URL提取文件名
        file_name = request.url.split("/")[-1].split("?")[0] or "downloaded_file"

        # 构建转换选项
        options = ServiceConversionOptions(
            enable_ocr=request.do_ocr,
            enable_table_extraction=request.do_table_structure,
            do_picture_description=request.do_picture_description,
            do_picture_classification=request.do_picture_classification,
        )
        service_format = _map_service_output_format(request.output_format)

        # 执行转换
        result = await docling_service.convert_from_bytes_async(
            file_data=file_data,
            file_name=file_name,
            output_format=service_format,
            options=options,
        )

        return _map_service_result_to_docling(result, task_id)

    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to download file from URL: {str(e)}"
        )
    except FileTooLargeException as e:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(e))
    except UnsupportedFileTypeException as e:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error during URL conversion: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.post(
    "/convert-from-s3",
    response_model=DoclingConvertResponse,
    summary="从S3转换文件",
    description="从S3存储桶下载文件并使用Docling进行转换",
    responses={
        200: {"description": "转换成功"},
        404: {"description": "文件不存在", "model": ConversionErrorResponse},
        413: {"description": "文件过大", "model": ConversionErrorResponse},
        415: {"description": "不支持的文件类型", "model": ConversionErrorResponse},
        422: {"description": "转换失败", "model": ConversionErrorResponse},
    },
)
async def docling_convert_from_s3(request: DoclingS3Request):
    """
    从S3转换文件

    从S3存储桶下载文件并使用Docling进行转换。

    - **s3_key**: S3存储路径
    - **output_format**: 输出格式
    - **do_ocr**: 是否启用OCR
    - **do_table_structure**: 是否启用表格结构识别
    - **do_picture_description**: 是否启用图片描述
    - **do_picture_classification**: 是否启用图片分类
    """
    task_id = str(uuid.uuid4())

    try:
        # 构建转换选项
        options = ServiceConversionOptions(
            enable_ocr=request.do_ocr,
            enable_table_extraction=request.do_table_structure,
            do_picture_description=request.do_picture_description,
            do_picture_classification=request.do_picture_classification,
        )
        service_format = _map_service_output_format(request.output_format)

        result = await docling_service.convert_file_async(
            s3_key=request.s3_key,
            output_format=service_format,
            options=options,
        )

        return _map_service_result_to_docling(result, task_id)

    except FileNotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except FileTooLargeException as e:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(e))
    except UnsupportedFileTypeException as e:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=str(e))
    except ConversionException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error during S3 conversion: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.post(
    "/batch-convert",
    response_model=BatchConvertResponse,
    summary="批量转换文件",
    description="批量转换多个S3文件，支持并发处理",
    responses={
        200: {"description": "批量转换任务已启动"},
        400: {"description": "请求参数错误", "model": ConversionErrorResponse},
    },
)
async def docling_batch_convert(request: DoclingBatchRequest):
    """
    批量转换文件

    同时转换多个S3文件，支持并发处理以提高效率。
    最多支持100个文件同时转换。

    - **s3_keys**: S3存储路径列表
    - **output_format**: 输出格式
    - **do_ocr**: 是否启用OCR
    - **do_table_structure**: 是否启用表格结构识别
    - **do_picture_description**: 是否启用图片描述
    - **do_picture_classification**: 是否启用图片分类
    """
    try:
        options = ServiceConversionOptions(
            enable_ocr=request.do_ocr,
            enable_table_extraction=request.do_table_structure,
            do_picture_description=request.do_picture_description,
            do_picture_classification=request.do_picture_classification,
        )
        service_format = _map_service_output_format(request.output_format)

        # 执行批量转换
        batch_result = await docling_service.convert_batch_async(
            s3_keys=request.s3_keys,
            output_format=service_format,
            options=options,
        )

        # 构建响应
        results = [
            BatchConvertItem(
                s3_key=r.s3_key,
                file_name=r.file_name,
                status=ConversionStatus(r.status.value),
                error_message=r.error_message,
                processing_time_ms=r.processing_time_ms,
            )
            for r in batch_result.results
        ]

        return BatchConvertResponse(
            success=batch_result.status == ConversionStatus.SUCCESS,
            batch_id=batch_result.batch_id,
            total_files=batch_result.total_files,
            completed_files=batch_result.completed_files,
            failed_files=batch_result.failed_files,
            pending_files=batch_result.pending_files,
            status=ConversionStatus(batch_result.status.value),
            results=results,
            created_at=batch_result.created_at,
            completed_at=batch_result.completed_at,
        )

    except Exception as e:
        logger.error(f"Unexpected error during batch conversion: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get(
    "/status/{task_id}",
    response_model=DoclingStatusResponse,
    summary="获取转换状态",
    description="查询指定任务的转换状态和进度",
    responses={
        200: {"description": "查询成功"},
        404: {"description": "任务不存在", "model": ConversionErrorResponse},
    },
)
async def docling_get_status(task_id: str):
    """
    获取转换状态

    查询指定任务ID的转换状态和进度信息。
    """
    try:
        progress = docling_service.get_progress(task_id)

        if progress is None:
            # 尝试从数据库查询
            from models.database import ConversionTask, SessionLocal

            db = SessionLocal()
            try:
                task = db.query(ConversionTask).filter(ConversionTask.task_id == task_id).first()
                if not task:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Task not found: {task_id}"
                    )

                progress = DoclingTaskStatus(
                    task_id=task_id,
                    status=ConversionStatus(task.status),
                    created_at=task.created_at,
                    completed_at=task.completed_at,
                )
            finally:
                db.close()
        else:
            progress = DoclingTaskStatus(
                task_id=progress.task_id,
                status=progress.status,
                progress_percent=progress.progress_percent,
                current_page=progress.current_page,
                total_pages=progress.total_pages,
                message=progress.message,
                created_at=progress.started_at,
                updated_at=progress.updated_at,
                completed_at=progress.completed_at,
            )

        return DoclingStatusResponse(success=True, task=progress)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error getting task status: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get(
    "/result/{task_id}",
    response_model=DoclingResultResponse,
    summary="获取转换结果",
    description="获取指定任务的转换结果",
    responses={
        200: {"description": "获取成功"},
        404: {"description": "任务不存在", "model": ConversionErrorResponse},
    },
)
async def docling_get_result(task_id: str):
    """
    获取转换结果

    获取指定任务ID的转换结果。
    注意：当前实现基于内存缓存，服务重启后结果会丢失。
    """
    try:
        progress = docling_service.get_progress(task_id)

        if progress is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task not found: {task_id}"
            )

        # 注意：这里简化处理，实际应该存储和返回完整结果
        return DoclingResultResponse(
            success=progress.status == ConversionStatus.SUCCESS,
            task_id=task_id,
            status=progress.status,
            content="",
            metadata={},
            images=[],
            tables=[],
            processing_time_ms=0.0,
            error_message=progress.message if progress.status == ConversionStatus.FAILED else "",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error getting task result: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


# ============================================================================
# 通用文件转换接口
# ============================================================================

@router.post(
    "/convert/s3",
    response_model=ConversionResultResponse,
    summary="转换S3文件",
    description="将S3上的文件转换为指定格式，支持PDF、DOCX、PPTX、XLSX、HTML、Markdown等多种格式",
    responses={
        200: {"description": "转换成功"},
        404: {"description": "文件不存在", "model": ConversionErrorResponse},
        413: {"description": "文件过大", "model": ConversionErrorResponse},
        415: {"description": "不支持的文件类型", "model": ConversionErrorResponse},
        422: {"description": "转换失败", "model": ConversionErrorResponse},
        504: {"description": "转换超时", "model": ConversionErrorResponse},
    },
)
async def convert_s3_file(request: ConvertFromS3Request):
    """
    转换S3上的文件

    - **s3_key**: S3存储路径
    - **output_format**: 输出格式 (markdown, json, html, text, doctags)
    - **options**: 转换选项，包括OCR、表格识别、图片提取等
    """
    try:
        service_options = _map_service_options(request.options)
        service_format = _map_service_output_format(request.output_format)

        result = await docling_service.convert_file_async(
            s3_key=request.s3_key,
            output_format=service_format,
            options=service_options,
        )

        return _map_service_result(result)

    except FileNotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except FileTooLargeException as e:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(e))
    except UnsupportedFileTypeException as e:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=str(e))
    except TimeoutException as e:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail=str(e))
    except ConversionException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error during conversion: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.post(
    "/convert/upload",
    response_model=ConversionResultResponse,
    summary="上传并转换文件",
    description="上传文件并立即转换，支持多种输入格式",
    responses={
        200: {"description": "转换成功"},
        413: {"description": "文件过大", "model": ConversionErrorResponse},
        415: {"description": "不支持的文件类型", "model": ConversionErrorResponse},
    },
)
async def convert_uploaded_file(
    file: UploadFile = File(..., description="要转换的文件"),
    output_format: OutputFormat = Form(OutputFormat.MARKDOWN, description="输出格式"),
    enable_ocr: bool = Form(True, description="启用OCR"),
    enable_table_extraction: bool = Form(True, description="启用表格识别"),
    enable_image_extraction: bool = Form(False, description="启用图片提取"),
):
    """
    上传文件并转换

    直接上传文件进行转换，无需预先上传到S3。
    支持PDF、DOCX、PPTX、XLSX、HTML、Markdown、TXT等格式。
    """
    try:
        # 读取文件内容
        file_data = await file.read()

        # 检查文件大小
        if len(file_data) > settings.conversion.max_file_size:
            raise FileTooLargeException(
                max_size=settings.conversion.max_file_size,
                actual_size=len(file_data),
            )

        # 构建转换选项
        options = ServiceConversionOptions(
            enable_ocr=enable_ocr,
            enable_table_extraction=enable_table_extraction,
            enable_image_extraction=enable_image_extraction,
        )
        service_format = _map_service_output_format(output_format)

        # 执行转换
        result = await docling_service.convert_from_bytes_async(
            file_data=file_data,
            file_name=file.filename or "unknown",
            output_format=service_format,
            options=options,
        )

        return _map_service_result(result)

    except FileTooLargeException as e:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(e))
    except UnsupportedFileTypeException as e:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error during file upload conversion: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.post(
    "/convert/url",
    response_model=ConversionResultResponse,
    summary="从URL转换文件",
    description="从指定URL下载文件并转换",
    responses={
        200: {"description": "转换成功"},
        400: {"description": "URL无效或下载失败", "model": ConversionErrorResponse},
        413: {"description": "文件过大", "model": ConversionErrorResponse},
        415: {"description": "不支持的文件类型", "model": ConversionErrorResponse},
    },
)
async def convert_from_url(request: ConvertFromUrlRequest):
    """
    从URL转换文件

    从指定URL下载文件并进行转换。
    URL必须返回可下载的文件内容。
    """
    try:
        # 下载文件
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(request.url)
            response.raise_for_status()
            file_data = response.content

        # 检查文件大小
        if len(file_data) > settings.conversion.max_file_size:
            raise FileTooLargeException(
                max_size=settings.conversion.max_file_size,
                actual_size=len(file_data),
            )

        # 从URL提取文件名
        file_name = request.url.split("/")[-1].split("?")[0] or "downloaded_file"

        # 构建转换选项
        service_options = _map_service_options(request.options)
        service_format = _map_service_output_format(request.output_format)

        # 执行转换
        result = await docling_service.convert_from_bytes_async(
            file_data=file_data,
            file_name=file_name,
            output_format=service_format,
            options=service_options,
        )

        return _map_service_result(result)

    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to download file from URL: {str(e)}"
        )
    except FileTooLargeException as e:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(e))
    except UnsupportedFileTypeException as e:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error during URL conversion: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.post(
    "/convert/batch",
    response_model=BatchConvertResponse,
    summary="批量转换文件",
    description="批量转换多个S3文件，支持并发处理",
    responses={
        200: {"description": "批量转换任务已启动"},
        400: {"description": "请求参数错误", "model": ConversionErrorResponse},
    },
)
async def convert_batch(request: BatchConvertRequest):
    """
    批量转换文件

    同时转换多个S3文件，支持并发处理以提高效率。
    最多支持100个文件同时转换。
    """
    try:
        service_options = _map_service_options(request.options)
        service_format = _map_service_output_format(request.output_format)

        # 执行批量转换
        batch_result = await docling_service.convert_batch_async(
            s3_keys=request.s3_keys,
            output_format=service_format,
            options=service_options,
        )

        # 构建响应
        results = [
            BatchConvertItem(
                s3_key=r.s3_key,
                file_name=r.file_name,
                status=ConversionStatus(r.status.value),
                error_message=r.error_message,
                processing_time_ms=r.processing_time_ms,
            )
            for r in batch_result.results
        ]

        return BatchConvertResponse(
            success=batch_result.status == ConversionStatus.SUCCESS,
            batch_id=batch_result.batch_id,
            total_files=batch_result.total_files,
            completed_files=batch_result.completed_files,
            failed_files=batch_result.failed_files,
            pending_files=batch_result.pending_files,
            status=ConversionStatus(batch_result.status.value),
            results=results,
            created_at=batch_result.created_at,
            completed_at=batch_result.completed_at,
        )

    except Exception as e:
        logger.error(f"Unexpected error during batch conversion: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get(
    "/convert/batch/{batch_id}",
    response_model=BatchStatusResponse,
    summary="获取批量转换状态",
    description="查询批量转换任务的执行状态和进度",
    responses={
        200: {"description": "查询成功"},
        404: {"description": "批次不存在", "model": ConversionErrorResponse},
    },
)
async def get_batch_status(batch_id: str):
    """
    获取批量转换状态

    查询指定批次ID的转换任务状态和进度。
    """
    try:
        # 从数据库查询批次状态
        from models.database import ConversionTask, SessionLocal

        db = SessionLocal()
        try:
            task = db.query(ConversionTask).filter(ConversionTask.task_id == batch_id).first()
            if not task:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Batch not found: {batch_id}"
                )

            return BatchStatusResponse(
                success=True,
                batch_id=task.task_id,
                total_files=task.total_files,
                completed_files=task.completed_files,
                failed_files=task.failed_files,
                pending_files=task.total_files - task.completed_files - task.failed_files,
                status=ConversionStatus(task.status),
                created_at=task.created_at,
                completed_at=task.completed_at,
            )
        finally:
            db.close()

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error getting batch status: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


# ============================================================================
# 内容获取接口
# ============================================================================

@router.post(
    "/text",
    response_model=TextContentResponse,
    summary="获取文件文本内容",
    description="获取文件的完整文本内容，自动触发转换（如果尚未转换）",
    responses={
        200: {"description": "获取成功"},
        404: {"description": "文件不存在", "model": ConversionErrorResponse},
        422: {"description": "转换失败", "model": ConversionErrorResponse},
    },
)
async def get_text_content(request: TextContentRequest):
    """
    获取文件的完整文本内容

    自动触发转换（如果尚未转换），返回纯文本格式内容。
    """
    try:
        service_options = _map_service_options(request.options)

        result = await docling_service.convert_file_async(
            s3_key=request.s3_key,
            output_format=ServiceOutputFormat.TEXT,
            options=service_options,
        )

        if result.status != ConversionStatus.SUCCESS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=result.error_message or "Conversion failed"
            )

        return TextContentResponse(
            success=True,
            s3_key=request.s3_key,
            content=result.full_text,
            total_pages=result.total_pages,
            word_count=result.metadata.get("word_count", 0),
            char_count=result.metadata.get("char_count", 0),
        )

    except FileNotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error getting text content: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.post(
    "/page",
    response_model=PageContentResponse,
    summary="获取指定页面内容",
    description="获取文件指定页面的内容，页码从1开始",
    responses={
        200: {"description": "获取成功"},
        400: {"description": "页码无效", "model": ConversionErrorResponse},
        404: {"description": "文件不存在", "model": ConversionErrorResponse},
        422: {"description": "转换失败", "model": ConversionErrorResponse},
    },
)
async def get_page_content(request: PageContentRequest):
    """
    获取文件指定页面的内容

    - **s3_key**: S3存储路径
    - **page_number**: 页码（从1开始）
    """
    try:
        service_options = _map_service_options(request.options)

        result = await docling_service.convert_file_async(
            s3_key=request.s3_key,
            output_format=ServiceOutputFormat.MARKDOWN,
            options=service_options,
        )

        if result.status != ConversionStatus.SUCCESS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=result.error_message or "Conversion failed"
            )

        if request.page_number < 1 or request.page_number > result.total_pages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid page number: {request.page_number}. Total pages: {result.total_pages}"
            )

        page_content = result.pages.get(str(request.page_number), "")

        return PageContentResponse(
            success=True,
            s3_key=request.s3_key,
            page_number=request.page_number,
            content=page_content,
            total_pages=result.total_pages,
        )

    except FileNotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error getting page content: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.post(
    "/pages",
    response_model=AllPagesResponse,
    summary="获取所有页面内容",
    description="获取文件的所有页面内容",
    responses={
        200: {"description": "获取成功"},
        404: {"description": "文件不存在", "model": ConversionErrorResponse},
        422: {"description": "转换失败", "model": ConversionErrorResponse},
    },
)
async def get_all_pages(request: AllPagesRequest):
    """
    获取文件的所有页面内容

    返回包含所有页面的字典，键为页码，值为页面内容。
    """
    try:
        service_options = _map_service_options(request.options)

        result = await docling_service.convert_file_async(
            s3_key=request.s3_key,
            output_format=ServiceOutputFormat.MARKDOWN,
            options=service_options,
        )

        if result.status != ConversionStatus.SUCCESS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=result.error_message or "Conversion failed"
            )

        return AllPagesResponse(
            success=True,
            s3_key=request.s3_key,
            total_pages=result.total_pages,
            pages=result.pages,
        )

    except FileNotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error getting all pages: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.post(
    "/result",
    response_model=ConversionResultResponse,
    summary="获取转换结果",
    description="获取文件的完整转换结果，包括所有格式的内容",
    responses={
        200: {"description": "获取成功"},
        404: {"description": "文件不存在", "model": ConversionErrorResponse},
        422: {"description": "转换失败", "model": ConversionErrorResponse},
    },
)
async def get_conversion_result(request: ConversionResultRequest):
    """
    获取转换结果

    获取文件的完整转换结果，包括Markdown、JSON、HTML、Text、Doctags等格式。
    """
    try:
        service_format = _map_service_output_format(request.output_format)

        result = await docling_service.convert_file_async(
            s3_key=request.s3_key,
            output_format=service_format,
        )

        return _map_service_result(result)

    except FileNotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error getting conversion result: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


# ============================================================================
# 状态查询接口
# ============================================================================

@router.post(
    "/status",
    response_model=ConversionStatusResponse,
    summary="获取转换状态",
    description="获取文件的转换状态，检查是否已转换或需要重新转换",
    responses={
        200: {"description": "查询成功"},
    },
)
async def get_conversion_status(request: ConversionStatusRequest):
    """
    获取文件的转换状态

    返回文件的当前转换状态：pending、success、failed、not_found等。
    """
    try:
        status = docling_service.get_conversion_status(request.s3_key)

        return ConversionStatusResponse(
            success=True,
            s3_key=request.s3_key,
            status=ConversionStatus(status.value),
            is_converted=status == ConversionStatus.SUCCESS,
        )

    except Exception as e:
        logger.error(f"Unexpected error getting conversion status: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get(
    "/progress/{task_id}",
    response_model=ConversionProgressResponse,
    summary="获取转换进度",
    description="获取指定任务的转换进度",
    responses={
        200: {"description": "查询成功"},
        404: {"description": "任务不存在", "model": ConversionErrorResponse},
    },
)
async def get_conversion_progress(task_id: str):
    """
    获取转换进度

    查询指定任务的实时转换进度。
    """
    try:
        progress = docling_service.get_progress(task_id)

        if progress is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task not found: {task_id}"
            )

        return ConversionProgressResponse(
            success=True,
            progress=ConversionProgressData(
                task_id=progress.task_id,
                s3_key=progress.s3_key,
                status=progress.status,
                progress_percent=progress.progress_percent,
                current_page=progress.current_page,
                total_pages=progress.total_pages,
                message=progress.message,
                started_at=progress.started_at,
                updated_at=progress.updated_at,
                completed_at=progress.completed_at,
            )
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error getting conversion progress: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


# ============================================================================
# 缓存管理接口
# ============================================================================

@router.post(
    "/invalidate",
    response_model=InvalidateCacheResponse,
    summary="使缓存失效",
    description="使指定文件的转换缓存失效，下次访问时将重新转换",
    responses={
        200: {"description": "操作成功"},
    },
)
async def invalidate_cache(request: InvalidateCacheRequest):
    """
    使指定文件的转换缓存失效

    删除指定文件的所有转换缓存，下次访问时将重新转换。
    """
    try:
        deleted = docling_service.invalidate_cache(request.s3_key)

        return InvalidateCacheResponse(
            success=True,
            s3_key=request.s3_key,
            message="Cache invalidated" if deleted else "No cache found",
        )

    except Exception as e:
        logger.error(f"Unexpected error invalidating cache: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get(
    "/cache/stats",
    response_model=CacheStatsResponse,
    summary="获取缓存统计",
    description="获取转换缓存的统计信息",
    responses={
        200: {"description": "查询成功"},
    },
)
async def get_cache_stats():
    """
    获取缓存统计信息

    返回缓存条目数、总大小、最早/最新缓存时间等统计信息。
    """
    try:
        stats = docling_service.get_cache_stats()

        return CacheStatsResponse(
            success=True,
            stats=CacheStats(
                total_entries=stats["total_entries"],
                total_size_bytes=0,  # 暂不支持
                oldest_entry=stats.get("oldest_entry"),
                newest_entry=stats.get("newest_entry"),
            )
        )

    except Exception as e:
        logger.error(f"Unexpected error getting cache stats: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


# ============================================================================
# 格式信息接口
# ============================================================================

@router.get(
    "/formats",
    response_model=SupportedFormatsResponse,
    summary="获取支持的格式",
    description="获取所有支持的输入和输出格式列表",
    responses={
        200: {"description": "查询成功"},
    },
)
async def get_supported_formats():
    """
    获取支持的文件格式列表

    返回所有支持的输入格式（按分类）和输出格式列表。
    """
    try:
        input_formats = docling_service.get_supported_formats()
        output_formats_info = docling_service.get_supported_output_formats()

        output_formats = [
            OutputFormatInfo(
                format=fmt["format"],
                description=fmt["description"],
                mime_type=fmt["mime_type"],
            )
            for fmt in output_formats_info
        ]

        return SupportedFormatsResponse(
            success=True,
            input_formats=input_formats,
            output_formats=output_formats,
        )

    except Exception as e:
        logger.error(f"Unexpected error getting supported formats: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get(
    "/config",
    response_model=DoclingConfig,
    summary="获取Docling配置",
    description="获取当前Docling转换服务的配置信息",
    responses={
        200: {"description": "获取成功"},
    },
)
async def get_docling_config():
    """
    获取Docling配置

    返回当前转换服务的默认配置信息。
    """
    return DoclingConfig(
        do_ocr=settings.conversion.enable_ocr,
        do_table_structure=settings.conversion.enable_table_extraction,
        do_picture_description=False,
        do_picture_classification=False,
        ocr_languages=settings.conversion.ocr_languages,
        max_file_size=settings.conversion.max_file_size,
        timeout_seconds=settings.conversion.timeout,
    )
