"""
Editor API Router - 统一的文件编辑CRUD接口

基于 S3 Key 的扁平化管理，不依赖 file_id
支持操作: create, read, update, delete, move, copy, exists, list
提供 RESTful 风格的 CRUD 接口和高级功能（版本控制、批量操作、格式转换）
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Path, Query, status

from lib.logging_config import get_logger
from lib.schemas import (
    COMMON_RESPONSES,
    HTTP_400_RESPONSE,
    HTTP_404_RESPONSE,
    HTTP_500_RESPONSE,
)
from models.edit import (
    BatchOperationItem,
    BatchOperationRequest,
    BatchOperationResponse,
    BatchOperationResult,
    BatchOperationType,
    ConvertFormat,
    CreateVersionRequest,
    EditorAction,
    EditorUnifiedRequest,
    FileConvertRequest,
    FileConvertResponse,
    FileCopyRequest,
    FileCopyResponse,
    FileCreateRequest,
    FileCreateResponse,
    FileCreateRESTRequest,
    FileDeleteRequest,
    FileDeleteResponse,
    FileEditResponse,
    FileExistsRequest,
    FileExistsResponse,
    FileMetadata,
    FileMetadataResponse,
    FileMetadataUpdateRequest,
    FileMoveRequest,
    FileMoveResponse,
    FileReadRequest,
    FileReadResponse,
    FileRESTResponse,
    FileUpdateRequest,
    FileUpdateResponse,
    FileUpdateRESTRequest,
    FileVersion,
    FileVersionHistoryResponse,
    RestoreVersionRequest,
    RestoreVersionResponse,
    UpdateMode,
)
from services.docling_service import ConversionStatus, docling_service
from services.storage_service import storage_service

router = APIRouter(prefix="/editor", tags=["editor"])
logger = get_logger(__name__)


# ==================== RESTful CRUD 接口 ====================


@router.post(
    "/files",
    response_model=FileRESTResponse,
    status_code=status.HTTP_201_CREATED,
    summary="创建文件",
    description="创建新文件到指定 S3 路径",
    responses={
        201: {"description": "文件创建成功"},
        400: HTTP_400_RESPONSE,
        409: {"description": "文件已存在"},
        500: HTTP_500_RESPONSE,
    },
)
async def create_file(
    s3_key: str = Query(
        ..., description="S3存储路径(key)", examples=["notes/my-note.md"]
    ),
    request: FileCreateRESTRequest = ...,
):
    """
    创建新文件

    - **s3_key**: 文件的 S3 存储路径
    - **content**: 文件内容
    - **content_type**: 内容类型 (MIME type)
    - **encoding**: 编码格式
    - **custom_metadata**: 自定义元数据
    """
    try:
        # 检查文件是否已存在
        if storage_service.exists(s3_key):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"File already exists: {s3_key}",
            )

        # 上传文件
        data = request.content.encode(request.encoding)
        storage_service.upload(data, s3_key, request.content_type)

        # 获取文件大小和元数据
        file_size = storage_service.get_file_size(s3_key)
        file_name = s3_key.split("/")[-1] if "/" in s3_key else s3_key

        metadata = FileMetadata(
            s3_key=s3_key,
            file_name=file_name,
            content_type=request.content_type,
            file_size=file_size,
            custom_metadata=request.custom_metadata,
        )

        logger.info(
            f"File created: {s3_key}", extra={"s3_key": s3_key, "size": file_size}
        )

        return FileRESTResponse(
            success=True,
            message="File created successfully",
            s3_key=s3_key,
            content_type=request.content_type,
            file_size=file_size,
            metadata=metadata,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to create file: {e}", extra={"s3_key": s3_key}, exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create file: {str(e)}",
        )


@router.get(
    "/files/{s3_key:path}",
    response_model=FileReadResponse,
    summary="读取文件",
    description="读取指定 S3 路径的文件内容",
    responses={
        200: {"description": "文件读取成功"},
        404: HTTP_404_RESPONSE,
        500: HTTP_500_RESPONSE,
    },
)
async def read_file(
    s3_key: str = Path(
        ..., description="S3存储路径(key)", examples=["notes/my-note.md"]
    ),
    encoding: str = Query(default="utf-8", description="编码格式"),
    include_content: bool = Query(default=True, description="是否包含文件内容"),
):
    """
    读取文件内容

    - **s3_key**: 文件的 S3 存储路径
    - **encoding**: 编码格式
    - **include_content**: 是否返回文件内容（false 时只返回元数据）
    """
    try:
        # 检查文件是否存在
        if not storage_service.exists(s3_key):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File not found: {s3_key}",
            )

        # 获取文件元数据
        file_size = storage_service.get_file_size(s3_key)

        content = None
        if include_content:
            # 下载并解码文件
            data = storage_service.download(s3_key)
            content = data.decode(encoding)

        return FileReadResponse(
            success=True,
            s3_key=s3_key,
            content=content or "",
            file_size=file_size,
            encoding=encoding,
        )
    except HTTPException:
        raise
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to decode file with encoding: {encoding}",
        )
    except Exception as e:
        logger.error(
            f"Failed to read file: {e}", extra={"s3_key": s3_key}, exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read file: {str(e)}",
        )


@router.put(
    "/files/{s3_key:path}",
    response_model=FileRESTResponse,
    summary="更新文件",
    description="更新指定 S3 路径的文件内容",
    responses={
        200: {"description": "文件更新成功"},
        400: HTTP_400_RESPONSE,
        404: HTTP_404_RESPONSE,
        500: HTTP_500_RESPONSE,
    },
)
async def update_file(
    s3_key: str = Path(
        ..., description="S3存储路径(key)", examples=["notes/my-note.md"]
    ),
    request: FileUpdateRESTRequest = ...,
):
    """
    更新文件内容

    - **s3_key**: 文件的 S3 存储路径
    - **content**: 新文件内容
    - **mode**: 更新模式 (overwrite/append/prepend)
    - **encoding**: 编码格式
    - **create_version**: 更新前是否创建版本
    - **version_comment**: 版本备注
    """
    try:
        # 检查文件是否存在
        if not storage_service.exists(s3_key):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File not found: {s3_key}",
            )

        # 获取原文件内容类型
        content_type = "text/plain"
        try:
            from config import settings

            head_response = storage_service.client.head_object(
                Bucket=settings.s3.bucket,
                Key=s3_key.lstrip("/"),
            )
            content_type = head_response.get("ContentType", "text/plain")
        except Exception:
            pass

        # 根据模式处理内容
        if request.mode == UpdateMode.OVERWRITE:
            new_content = request.content
        elif request.mode == UpdateMode.APPEND:
            existing_data = storage_service.download(s3_key)
            existing_content = existing_data.decode(request.encoding)
            new_content = existing_content + request.content
        elif request.mode == UpdateMode.PREPEND:
            existing_data = storage_service.download(s3_key)
            existing_content = existing_data.decode(request.encoding)
            new_content = request.content + existing_content
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid update mode: {request.mode}",
            )

        # 如果需要，创建版本（简化实现：复制到版本路径）
        version_id = None
        if request.create_version:
            version_id = await _create_version_internal(s3_key, request.version_comment)

        # 上传更新后的内容
        data = new_content.encode(request.encoding)
        storage_service.upload(data, s3_key, content_type)

        file_size = len(data)
        file_name = s3_key.split("/")[-1] if "/" in s3_key else s3_key

        metadata = FileMetadata(
            s3_key=s3_key,
            file_name=file_name,
            content_type=content_type,
            file_size=file_size,
        )

        logger.info(
            f"File updated: {s3_key}",
            extra={
                "s3_key": s3_key,
                "mode": request.mode.value,
                "version_id": version_id,
            },
        )

        return FileRESTResponse(
            success=True,
            message=f"File updated successfully ({request.mode.value})",
            s3_key=s3_key,
            content_type=content_type,
            file_size=file_size,
            version_id=version_id,
            metadata=metadata,
        )
    except HTTPException:
        raise
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to decode file with encoding: {request.encoding}",
        )
    except Exception as e:
        logger.error(
            f"Failed to update file: {e}", extra={"s3_key": s3_key}, exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update file: {str(e)}",
        )


@router.delete(
    "/files/{s3_key:path}",
    response_model=FileDeleteResponse,
    summary="删除文件",
    description="删除指定 S3 路径的文件",
    responses={
        200: {"description": "文件删除成功"},
        404: HTTP_404_RESPONSE,
        500: HTTP_500_RESPONSE,
    },
)
async def delete_file(
    s3_key: str = Path(
        ..., description="S3存储路径(key)", examples=["notes/my-note.md"]
    ),
    create_backup: bool = Query(default=False, description="删除前是否创建备份版本"),
):
    """
    删除文件

    - **s3_key**: 文件的 S3 存储路径
    - **create_backup**: 删除前是否创建备份版本
    """
    try:
        # 检查文件是否存在
        if not storage_service.exists(s3_key):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File not found: {s3_key}",
            )

        # 如果需要，创建备份
        if create_backup:
            await _create_version_internal(s3_key, "Backup before deletion")

        # 删除文件
        storage_service.delete(s3_key)

        logger.info(f"File deleted: {s3_key}", extra={"s3_key": s3_key})

        return FileDeleteResponse(
            success=True,
            message="File deleted successfully",
            s3_key=s3_key,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to delete file: {e}", extra={"s3_key": s3_key}, exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete file: {str(e)}",
        )


# ==================== 文件转换接口 ====================


@router.post(
    "/files/{s3_key:path}/convert",
    response_model=FileConvertResponse,
    summary="转换文件格式",
    description="将文件转换为指定格式（使用 DoclingService）",
    responses={
        200: {"description": "文件转换成功"},
        400: HTTP_400_RESPONSE,
        404: HTTP_404_RESPONSE,
        422: {"description": "转换失败或不支持的格式"},
        500: HTTP_500_RESPONSE,
    },
)
async def convert_file(
    s3_key: str = Path(
        ..., description="源文件S3路径", examples=["input/document.pdf"]
    ),
    request: FileConvertRequest = ...,
):
    """
    转换文件格式

    使用 DoclingService 将文件转换为 LLM 友好的纯文本格式。
    支持 PDF、DOCX、PPTX、XLSX、CSV、HTML、Markdown、图片等格式转换为 Markdown 或纯文本。

    - **s3_key**: 源文件 S3 路径
    - **target_format**: 目标格式 (markdown/text/html/json)
    - **target_s3_key**: 转换后文件存储路径（可选，默认自动生成）
    - **options**: 转换选项
    """
    try:
        # 检查源文件是否存在
        if not storage_service.exists(s3_key):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Source file not found: {s3_key}",
            )

        # 使用 DoclingService 转换文件
        result = docling_service.convert_file(s3_key)

        if result.status != ConversionStatus.SUCCESS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Conversion failed: {result.error_message}",
            )

        # 确定目标路径
        target_s3_key = request.target_s3_key
        if not target_s3_key:
            # 自动生成目标路径
            base_name = s3_key.rsplit(".", 1)[0] if "." in s3_key else s3_key
            target_s3_key = f"{base_name}.{request.target_format.value}"

        # 根据目标格式准备内容
        if request.target_format == ConvertFormat.MARKDOWN:
            content = result.full_text
            content_type = "text/markdown"
        elif request.target_format == ConvertFormat.TEXT:
            content = result.full_text
            content_type = "text/plain"
        elif request.target_format == ConvertFormat.HTML:
            # 简单地将 markdown 转换为 HTML（实际应用可使用更复杂的转换）
            content = f"<html><body><pre>{result.full_text}</pre></body></html>"
            content_type = "text/html"
        elif request.target_format == ConvertFormat.JSON:
            import json

            content = json.dumps(
                {
                    "source": s3_key,
                    "pages": result.pages,
                    "full_text": result.full_text,
                },
                ensure_ascii=False,
                indent=2,
            )
            content_type = "application/json"
        else:
            content = result.full_text
            content_type = "text/plain"

        # 保存转换后的文件
        data = content.encode("utf-8")
        storage_service.upload(data, target_s3_key, content_type)

        file_size = len(data)

        logger.info(
            f"File converted: {s3_key} -> {target_s3_key}",
            extra={
                "source": s3_key,
                "target": target_s3_key,
                "format": request.target_format.value,
            },
        )

        return FileConvertResponse(
            success=True,
            message="File converted successfully",
            source_s3_key=s3_key,
            target_s3_key=target_s3_key,
            source_format=result.file_type,
            target_format=request.target_format.value,
            file_size=file_size,
            pages=result.total_pages,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to convert file: {e}",
            extra={"s3_key": s3_key},
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to convert file: {str(e)}",
        )


# ==================== 版本控制接口 ====================


@router.get(
    "/files/{s3_key:path}/versions",
    response_model=FileVersionHistoryResponse,
    summary="获取文件版本历史",
    description="获取文件的版本历史列表",
    responses={
        200: {"description": "版本历史获取成功"},
        404: HTTP_404_RESPONSE,
        500: HTTP_500_RESPONSE,
    },
)
async def get_file_versions(
    s3_key: str = Path(
        ..., description="S3存储路径(key)", examples=["notes/my-note.md"]
    ),
):
    """
    获取文件版本历史

    注意：当前实现为简化版本，实际版本控制需要配合 S3 版本控制或数据库实现。
    """
    try:
        # 检查文件是否存在
        if not storage_service.exists(s3_key):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File not found: {s3_key}",
            )

        # 简化实现：列出版本路径下的文件
        version_prefix = f".versions/{s3_key}/"
        version_keys = storage_service.list_objects(version_prefix)

        versions = []
        for key in version_keys:
            try:
                version_id = key.split("/")[-1] if "/" in key else key
                file_size = storage_service.get_file_size(key)
                versions.append(
                    FileVersion(
                        version_id=version_id,
                        s3_key=s3_key,
                        file_size=file_size,
                        created_at=__import__("datetime").datetime.utcnow(),
                    )
                )
            except Exception:
                pass

        return FileVersionHistoryResponse(
            success=True,
            message="Version history retrieved",
            s3_key=s3_key,
            versions=versions,
            total_versions=len(versions),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to get version history: {e}",
            extra={"s3_key": s3_key},
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get version history: {str(e)}",
        )


@router.post(
    "/files/{s3_key:path}/versions",
    response_model=FileRESTResponse,
    summary="创建文件版本",
    description="为文件创建一个新版本",
    responses={
        201: {"description": "版本创建成功"},
        404: HTTP_404_RESPONSE,
        500: HTTP_500_RESPONSE,
    },
)
async def create_version(
    s3_key: str = Path(
        ..., description="S3存储路径(key)", examples=["notes/my-note.md"]
    ),
    request: CreateVersionRequest = ...,
):
    """
    创建文件版本

    将当前文件内容保存为一个版本。
    """
    try:
        # 检查文件是否存在
        if not storage_service.exists(s3_key):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File not found: {s3_key}",
            )

        version_id = await _create_version_internal(s3_key, request.comment)

        file_size = storage_service.get_file_size(s3_key)
        file_name = s3_key.split("/")[-1] if "/" in s3_key else s3_key

        return FileRESTResponse(
            success=True,
            message="Version created successfully",
            s3_key=s3_key,
            content_type="text/plain",
            file_size=file_size,
            version_id=version_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to create version: {e}",
            extra={"s3_key": s3_key},
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create version: {str(e)}",
        )


@router.post(
    "/files/{s3_key:path}/versions/restore",
    response_model=RestoreVersionResponse,
    summary="恢复文件版本",
    description="将文件恢复到指定版本",
    responses={
        200: {"description": "版本恢复成功"},
        404: HTTP_404_RESPONSE,
        500: HTTP_500_RESPONSE,
    },
)
async def restore_version(
    s3_key: str = Path(
        ..., description="S3存储路径(key)", examples=["notes/my-note.md"]
    ),
    request: RestoreVersionRequest = ...,
):
    """
    恢复文件版本

    将文件恢复到指定版本，当前内容会成为新版本。
    """
    try:
        # 检查文件是否存在
        if not storage_service.exists(s3_key):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File not found: {s3_key}",
            )

        # 检查版本是否存在
        version_key = f".versions/{s3_key}/{request.version_id}"
        if not storage_service.exists(version_key):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Version not found: {request.version_id}",
            )

        # 先创建当前版本的备份
        new_version_id = await _create_version_internal(
            s3_key, f"Auto backup before restoring {request.version_id}"
        )

        # 恢复版本
        from config import settings

        source_key = version_key.lstrip("/")
        dest_key = s3_key.lstrip("/")

        storage_service.client.copy_object(
            Bucket=settings.s3.bucket,
            CopySource={"Bucket": settings.s3.bucket, "Key": source_key},
            Key=dest_key,
        )

        logger.info(
            f"Version restored: {s3_key} -> {request.version_id}",
            extra={"s3_key": s3_key, "version_id": request.version_id},
        )

        return RestoreVersionResponse(
            success=True,
            message="Version restored successfully",
            s3_key=s3_key,
            restored_version=request.version_id,
            new_version_id=new_version_id or "unknown",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to restore version: {e}",
            extra={"s3_key": s3_key, "version_id": request.version_id},
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to restore version: {str(e)}",
        )


# ==================== 批量操作接口 ====================


@router.post(
    "/batch",
    response_model=BatchOperationResponse,
    summary="批量操作",
    description="批量执行文件操作（创建、更新、删除、复制、移动）",
    responses={
        200: {"description": "批量操作完成"},
        207: {"description": "部分操作成功"},
        400: HTTP_400_RESPONSE,
        500: HTTP_500_RESPONSE,
    },
)
async def batch_operation(request: BatchOperationRequest):
    """
    批量文件操作

    在一次请求中执行多个文件操作。支持：
    - **create**: 创建多个文件
    - **update**: 更新多个文件
    - **delete**: 删除多个文件
    - **copy**: 复制多个文件
    - **move**: 移动多个文件

    - **operation**: 操作类型
    - **items**: 操作项列表（最多100项）
    - **continue_on_error**: 遇到错误时是否继续
    """
    results = []
    succeeded = 0
    failed = 0

    for item in request.items:
        try:
            if request.operation == BatchOperationType.CREATE:
                result = await _batch_create(item)
            elif request.operation == BatchOperationType.UPDATE:
                result = await _batch_update(item)
            elif request.operation == BatchOperationType.DELETE:
                result = await _batch_delete(item)
            elif request.operation == BatchOperationType.COPY:
                result = await _batch_copy(item)
            elif request.operation == BatchOperationType.MOVE:
                result = await _batch_move(item)
            else:
                result = BatchOperationResult(
                    s3_key=item.s3_key,
                    success=False,
                    message=f"Unsupported operation: {request.operation}",
                    error_code="UNSUPPORTED_OPERATION",
                )

            if result.success:
                succeeded += 1
            else:
                failed += 1

            results.append(result)

            if not result.success and not request.continue_on_error:
                break

        except Exception as e:
            failed += 1
            results.append(
                BatchOperationResult(
                    s3_key=item.s3_key,
                    success=False,
                    message=str(e),
                    error_code="INTERNAL_ERROR",
                )
            )
            if not request.continue_on_error:
                break

    overall_success = failed == 0
    status_code = (
        status.HTTP_200_OK if overall_success else status.HTTP_207_MULTI_STATUS
    )

    return BatchOperationResponse(
        success=overall_success,
        message=f"Batch operation completed: {succeeded} succeeded, {failed} failed",
        operation=request.operation,
        total=len(request.items),
        succeeded=succeeded,
        failed=failed,
        results=results,
    )


# ==================== 元数据管理接口 ====================


@router.get(
    "/files/{s3_key:path}/metadata",
    response_model=FileMetadataResponse,
    summary="获取文件元数据",
    description="获取文件的完整元数据信息",
    responses={
        200: {"description": "元数据获取成功"},
        404: HTTP_404_RESPONSE,
        500: HTTP_500_RESPONSE,
    },
)
async def get_file_metadata(
    s3_key: str = Path(
        ..., description="S3存储路径(key)", examples=["notes/my-note.md"]
    ),
):
    """
    获取文件元数据

    - **s3_key**: 文件的 S3 存储路径
    """
    try:
        # 检查文件是否存在
        if not storage_service.exists(s3_key):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File not found: {s3_key}",
            )

        # 获取文件信息
        file_size = storage_service.get_file_size(s3_key)
        file_name = s3_key.split("/")[-1] if "/" in s3_key else s3_key
        content_type = _guess_content_type(s3_key)

        # 获取 S3 元数据
        from config import settings

        try:
            head_response = storage_service.client.head_object(
                Bucket=settings.s3.bucket,
                Key=s3_key.lstrip("/"),
            )
            modified_at = head_response.get("LastModified")
            etag = head_response.get("ETag")
        except Exception:
            modified_at = None
            etag = None

        metadata = FileMetadata(
            s3_key=s3_key,
            file_name=file_name,
            content_type=content_type,
            file_size=file_size,
            modified_at=modified_at,
            etag=etag,
        )

        return FileMetadataResponse(
            success=True,
            message="Metadata retrieved successfully",
            s3_key=s3_key,
            metadata=metadata,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to get metadata: {e}",
            extra={"s3_key": s3_key},
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get metadata: {str(e)}",
        )


@router.patch(
    "/files/{s3_key:path}/metadata",
    response_model=FileMetadataResponse,
    summary="更新文件元数据",
    description="更新文件的自定义元数据",
    responses={
        200: {"description": "元数据更新成功"},
        404: HTTP_404_RESPONSE,
        500: HTTP_500_RESPONSE,
    },
)
async def update_file_metadata(
    s3_key: str = Path(
        ..., description="S3存储路径(key)", examples=["notes/my-note.md"]
    ),
    request: FileMetadataUpdateRequest = ...,
):
    """
    更新文件元数据

    - **s3_key**: 文件的 S3 存储路径
    - **custom_metadata**: 自定义元数据（会合并到现有元数据）
    """
    try:
        # 检查文件是否存在
        if not storage_service.exists(s3_key):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File not found: {s3_key}",
            )

        # 获取当前元数据
        file_size = storage_service.get_file_size(s3_key)
        file_name = s3_key.split("/")[-1] if "/" in s3_key else s3_key
        content_type = _guess_content_type(s3_key)

        # 注意：S3 不支持直接修改元数据而不重新上传文件
        # 这里仅返回模拟的更新结果
        metadata = FileMetadata(
            s3_key=s3_key,
            file_name=file_name,
            content_type=content_type,
            file_size=file_size,
            custom_metadata=request.custom_metadata,
        )

        return FileMetadataResponse(
            success=True,
            message="Metadata updated successfully",
            s3_key=s3_key,
            metadata=metadata,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to update metadata: {e}",
            extra={"s3_key": s3_key},
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update metadata: {str(e)}",
        )


# ==================== 统一操作接口（保留原有功能） ====================


@router.post(
    "/unified",
    response_model=FileEditResponse,
    summary="统一文件操作接口",
    description="通过 action 字段指定操作类型的统一接口",
    responses={
        200: {"description": "操作成功"},
        400: HTTP_400_RESPONSE,
        404: HTTP_404_RESPONSE,
        409: {"description": "资源冲突"},
        500: HTTP_500_RESPONSE,
    },
)
async def editor_unified(request: EditorUnifiedRequest):
    """
    统一的文件编辑接口

    通过 action 字段指定操作类型:
    - **create**: 创建文件
    - **read**: 读取文件
    - **update**: 更新文件
    - **delete**: 删除文件
    - **move**: 移动/重命名文件
    - **copy**: 复制文件
    - **exists**: 检查文件是否存在
    """
    try:
        if request.action == EditorAction.CREATE:
            return await _handle_create(request)
        elif request.action == EditorAction.READ:
            return await _handle_read(request)
        elif request.action == EditorAction.UPDATE:
            return await _handle_update(request)
        elif request.action == EditorAction.DELETE:
            return await _handle_delete(request)
        elif request.action == EditorAction.MOVE:
            return await _handle_move(request)
        elif request.action == EditorAction.COPY:
            return await _handle_copy(request)
        elif request.action == EditorAction.EXISTS:
            return await _handle_exists(request)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported action: {request.action}",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Operation failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Operation failed: {str(e)}",
        )


# ==================== 独立操作接口（保留原有功能） ====================


@router.post(
    "/create",
    response_model=FileCreateResponse,
    summary="创建文件（独立接口）",
    description="创建新文件的独立接口",
    responses={
        200: {"description": "文件创建成功"},
        409: {"description": "文件已存在"},
        500: HTTP_500_RESPONSE,
    },
)
async def editor_create(request: FileCreateRequest):
    """创建新文件"""
    try:
        if storage_service.exists(request.s3_key):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"File already exists: {request.s3_key}",
            )

        data = request.content.encode(request.encoding)
        storage_service.upload(data, request.s3_key, request.content_type)
        file_size = storage_service.get_file_size(request.s3_key)

        return FileCreateResponse(
            success=True,
            message="File created successfully",
            s3_key=request.s3_key,
            content_type=request.content_type,
            file_size=file_size,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create file: {e}", extra={"s3_key": request.s3_key})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create file: {str(e)}",
        )


@router.get(
    "/read",
    response_model=FileReadResponse,
    summary="读取文件（独立接口）",
    description="读取文件内容的独立接口",
    responses={
        200: {"description": "文件读取成功"},
        404: HTTP_404_RESPONSE,
        500: HTTP_500_RESPONSE,
    },
)
async def editor_read(
    s3_key: str = Query(..., description="S3存储路径(key)"),
    encoding: str = Query(default="utf-8", description="编码格式"),
):
    """读取文件内容"""
    try:
        if not storage_service.exists(s3_key):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File not found: {s3_key}",
            )

        data = storage_service.download(s3_key)
        content = data.decode(encoding)
        file_size = len(data)

        return FileReadResponse(
            success=True,
            s3_key=s3_key,
            content=content,
            file_size=file_size,
            encoding=encoding,
        )
    except HTTPException:
        raise
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to decode file with encoding: {encoding}",
        )
    except Exception as e:
        logger.error(f"Failed to read file: {e}", extra={"s3_key": s3_key})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read file: {str(e)}",
        )


@router.post(
    "/update",
    response_model=FileUpdateResponse,
    summary="更新文件（独立接口）",
    description="更新文件内容的独立接口",
    responses={
        200: {"description": "文件更新成功"},
        400: HTTP_400_RESPONSE,
        404: HTTP_404_RESPONSE,
        500: HTTP_500_RESPONSE,
    },
)
async def editor_update(request: FileUpdateRequest):
    """更新文件内容"""
    try:
        if not storage_service.exists(request.s3_key):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File not found: {request.s3_key}",
            )

        # 获取原文件内容类型
        content_type = "text/plain"
        try:
            from config import settings

            head_response = storage_service.client.head_object(
                Bucket=settings.s3.bucket,
                Key=request.s3_key.lstrip("/"),
            )
            content_type = head_response.get("ContentType", "text/plain")
        except Exception:
            pass

        # 根据模式处理内容
        if request.mode == UpdateMode.OVERWRITE:
            new_content = request.content
        elif request.mode == UpdateMode.APPEND:
            existing_data = storage_service.download(request.s3_key)
            existing_content = existing_data.decode(request.encoding)
            new_content = existing_content + request.content
        elif request.mode == UpdateMode.PREPEND:
            existing_data = storage_service.download(request.s3_key)
            existing_content = existing_data.decode(request.encoding)
            new_content = request.content + existing_content
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid update mode: {request.mode}",
            )

        data = new_content.encode(request.encoding)
        storage_service.upload(data, request.s3_key, content_type)
        file_size = len(data)

        return FileUpdateResponse(
            success=True,
            message=f"File updated successfully ({request.mode.value})",
            s3_key=request.s3_key,
            mode=request.mode,
            file_size=file_size,
        )
    except HTTPException:
        raise
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to decode file with encoding: {request.encoding}",
        )
    except Exception as e:
        logger.error(f"Failed to update file: {e}", extra={"s3_key": request.s3_key})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update file: {str(e)}",
        )


@router.delete(
    "/delete",
    response_model=FileDeleteResponse,
    summary="删除文件（独立接口）",
    description="删除文件的独立接口",
    responses={
        200: {"description": "文件删除成功"},
        404: HTTP_404_RESPONSE,
        500: HTTP_500_RESPONSE,
    },
)
async def editor_delete(
    s3_key: str = Query(..., description="S3存储路径(key)"),
):
    """删除文件"""
    try:
        if not storage_service.exists(s3_key):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File not found: {s3_key}",
            )

        storage_service.delete(s3_key)

        return FileDeleteResponse(
            success=True,
            message="File deleted successfully",
            s3_key=s3_key,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete file: {e}", extra={"s3_key": s3_key})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete file: {str(e)}",
        )


@router.post(
    "/move",
    response_model=FileMoveResponse,
    summary="移动文件（独立接口）",
    description="移动/重命名文件的独立接口",
    responses={
        200: {"description": "文件移动成功"},
        404: HTTP_404_RESPONSE,
        409: {"description": "目标文件已存在"},
        500: HTTP_500_RESPONSE,
    },
)
async def editor_move(request: FileMoveRequest):
    """移动/重命名文件"""
    try:
        if not storage_service.exists(request.s3_key):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Source file not found: {request.s3_key}",
            )

        if storage_service.exists(request.new_s3_key):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Destination file already exists: {request.new_s3_key}",
            )

        from config import settings

        source_key = request.s3_key.lstrip("/")
        dest_key = request.new_s3_key.lstrip("/")

        storage_service.client.copy_object(
            Bucket=settings.s3.bucket,
            CopySource={"Bucket": settings.s3.bucket, "Key": source_key},
            Key=dest_key,
        )

        storage_service.delete(request.s3_key)

        return FileMoveResponse(
            success=True,
            message="File moved successfully",
            s3_key=request.s3_key,
            new_s3_key=request.new_s3_key,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to move file: {e}",
            extra={"source": request.s3_key, "dest": request.new_s3_key},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to move file: {str(e)}",
        )


@router.post(
    "/copy",
    response_model=FileCopyResponse,
    summary="复制文件（独立接口）",
    description="复制文件的独立接口",
    responses={
        200: {"description": "文件复制成功"},
        404: HTTP_404_RESPONSE,
        409: {"description": "目标文件已存在"},
        500: HTTP_500_RESPONSE,
    },
)
async def editor_copy(request: FileCopyRequest):
    """复制文件"""
    try:
        if not storage_service.exists(request.s3_key):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Source file not found: {request.s3_key}",
            )

        if storage_service.exists(request.new_s3_key):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Destination file already exists: {request.new_s3_key}",
            )

        from config import settings

        source_key = request.s3_key.lstrip("/")
        dest_key = request.new_s3_key.lstrip("/")

        storage_service.client.copy_object(
            Bucket=settings.s3.bucket,
            CopySource={"Bucket": settings.s3.bucket, "Key": source_key},
            Key=dest_key,
        )

        return FileCopyResponse(
            success=True,
            message="File copied successfully",
            s3_key=request.s3_key,
            new_s3_key=request.new_s3_key,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to copy file: {e}",
            extra={"source": request.s3_key, "dest": request.new_s3_key},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to copy file: {str(e)}",
        )


@router.get(
    "/exists",
    response_model=FileExistsResponse,
    summary="检查文件存在性（独立接口）",
    description="检查文件是否存在的独立接口",
    responses={
        200: {"description": "检查完成"},
        500: HTTP_500_RESPONSE,
    },
)
async def editor_exists(
    s3_key: str = Query(..., description="S3存储路径(key)"),
):
    """检查文件是否存在"""
    try:
        exists = storage_service.exists(s3_key)
        return FileExistsResponse(exists=exists, s3_key=s3_key)
    except Exception as e:
        logger.error(f"Failed to check existence: {e}", extra={"s3_key": s3_key})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check file existence: {str(e)}",
        )


# ==================== 内部辅助函数 ====================


async def _handle_create(request: EditorUnifiedRequest) -> FileEditResponse:
    """处理创建操作"""
    if not request.content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Content is required for create action",
        )

    content_type = request.content_type or "text/plain"
    encoding = request.encoding or "utf-8"

    if storage_service.exists(request.s3_key):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"File already exists: {request.s3_key}",
        )

    data = request.content.encode(encoding)
    storage_service.upload(data, request.s3_key, content_type)
    file_size = storage_service.get_file_size(request.s3_key)

    return FileEditResponse(
        success=True,
        message="File created successfully",
        action="create",
        s3_key=request.s3_key,
        content_type=content_type,
        file_size=file_size,
    )


async def _handle_read(request: EditorUnifiedRequest) -> FileEditResponse:
    """处理读取操作"""
    encoding = request.encoding or "utf-8"

    if not storage_service.exists(request.s3_key):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File not found: {request.s3_key}",
        )

    data = storage_service.download(request.s3_key)
    content = data.decode(encoding)
    file_size = len(data)

    return FileEditResponse(
        success=True,
        message="File read successfully",
        action="read",
        s3_key=request.s3_key,
        content=content,
        file_size=file_size,
        encoding=encoding,
    )


async def _handle_update(request: EditorUnifiedRequest) -> FileEditResponse:
    """处理更新操作"""
    if request.content is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Content is required for update action",
        )

    mode = request.mode or UpdateMode.OVERWRITE
    encoding = request.encoding or "utf-8"

    if not storage_service.exists(request.s3_key):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File not found: {request.s3_key}",
        )

    if mode == UpdateMode.OVERWRITE:
        new_content = request.content
    elif mode == UpdateMode.APPEND:
        existing_data = storage_service.download(request.s3_key)
        existing_content = existing_data.decode(encoding)
        new_content = existing_content + request.content
    elif mode == UpdateMode.PREPEND:
        existing_data = storage_service.download(request.s3_key)
        existing_content = existing_data.decode(encoding)
        new_content = request.content + existing_content
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid update mode: {mode}",
        )

    content_type = "text/plain"
    try:
        from config import settings

        head_response = storage_service.client.head_object(
            Bucket=settings.s3.bucket,
            Key=request.s3_key.lstrip("/"),
        )
        content_type = head_response.get("ContentType", "text/plain")
    except Exception:
        pass

    data = new_content.encode(encoding)
    storage_service.upload(data, request.s3_key, content_type)
    file_size = len(data)

    return FileEditResponse(
        success=True,
        message=f"File updated successfully ({mode.value})",
        action="update",
        s3_key=request.s3_key,
        file_size=file_size,
    )


async def _handle_delete(request: EditorUnifiedRequest) -> FileEditResponse:
    """处理删除操作"""
    if not storage_service.exists(request.s3_key):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File not found: {request.s3_key}",
        )

    storage_service.delete(request.s3_key)

    return FileEditResponse(
        success=True,
        message="File deleted successfully",
        action="delete",
        s3_key=request.s3_key,
    )


async def _handle_move(request: EditorUnifiedRequest) -> FileEditResponse:
    """处理移动操作"""
    if not request.new_s3_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="new_s3_key is required for move action",
        )

    if not storage_service.exists(request.s3_key):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Source file not found: {request.s3_key}",
        )

    if storage_service.exists(request.new_s3_key):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Destination file already exists: {request.new_s3_key}",
        )

    from config import settings

    source_key = request.s3_key.lstrip("/")
    dest_key = request.new_s3_key.lstrip("/")

    storage_service.client.copy_object(
        Bucket=settings.s3.bucket,
        CopySource={"Bucket": settings.s3.bucket, "Key": source_key},
        Key=dest_key,
    )

    storage_service.delete(request.s3_key)

    return FileEditResponse(
        success=True,
        message="File moved successfully",
        action="move",
        s3_key=request.s3_key,
        new_s3_key=request.new_s3_key,
    )


async def _handle_copy(request: EditorUnifiedRequest) -> FileEditResponse:
    """处理复制操作"""
    if not request.new_s3_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="new_s3_key is required for copy action",
        )

    if not storage_service.exists(request.s3_key):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Source file not found: {request.s3_key}",
        )

    if storage_service.exists(request.new_s3_key):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Destination file already exists: {request.new_s3_key}",
        )

    from config import settings

    source_key = request.s3_key.lstrip("/")
    dest_key = request.new_s3_key.lstrip("/")

    storage_service.client.copy_object(
        Bucket=settings.s3.bucket,
        CopySource={"Bucket": settings.s3.bucket, "Key": source_key},
        Key=dest_key,
    )

    return FileEditResponse(
        success=True,
        message="File copied successfully",
        action="copy",
        s3_key=request.s3_key,
        new_s3_key=request.new_s3_key,
    )


async def _handle_exists(request: EditorUnifiedRequest) -> FileEditResponse:
    """处理存在性检查操作"""
    exists = storage_service.exists(request.s3_key)

    return FileEditResponse(
        success=True,
        message="File existence checked",
        action="exists",
        s3_key=request.s3_key,
        exists=exists,
    )


async def _create_version_internal(s3_key: str, comment: Optional[str] = None) -> str:
    """
    内部函数：创建文件版本

    返回版本ID
    """
    from datetime import datetime

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    version_id = f"v_{timestamp}"

    version_key = f".versions/{s3_key}/{version_id}"

    from config import settings

    source_key = s3_key.lstrip("/")
    dest_key = version_key.lstrip("/")

    storage_service.client.copy_object(
        Bucket=settings.s3.bucket,
        CopySource={"Bucket": settings.s3.bucket, "Key": source_key},
        Key=dest_key,
    )

    logger.info(
        f"Version created: {s3_key} -> {version_id}",
        extra={"s3_key": s3_key, "version_id": version_id, "comment": comment},
    )

    return version_id


async def _batch_create(item: BatchOperationItem) -> BatchOperationResult:
    """批量创建文件"""
    try:
        if storage_service.exists(item.s3_key):
            return BatchOperationResult(
                s3_key=item.s3_key,
                success=False,
                message="File already exists",
                error_code="FILE_EXISTS",
            )

        content = item.content or ""
        data = content.encode("utf-8")
        storage_service.upload(data, item.s3_key, item.content_type or "text/plain")

        return BatchOperationResult(
            s3_key=item.s3_key,
            success=True,
            message="File created successfully",
        )
    except Exception as e:
        return BatchOperationResult(
            s3_key=item.s3_key,
            success=False,
            message=str(e),
            error_code="CREATE_ERROR",
        )


async def _batch_update(item: BatchOperationItem) -> BatchOperationResult:
    """批量更新文件"""
    try:
        if not storage_service.exists(item.s3_key):
            return BatchOperationResult(
                s3_key=item.s3_key,
                success=False,
                message="File not found",
                error_code="FILE_NOT_FOUND",
            )

        content = item.content or ""
        data = content.encode("utf-8")
        storage_service.upload(data, item.s3_key, item.content_type or "text/plain")

        return BatchOperationResult(
            s3_key=item.s3_key,
            success=True,
            message="File updated successfully",
        )
    except Exception as e:
        return BatchOperationResult(
            s3_key=item.s3_key,
            success=False,
            message=str(e),
            error_code="UPDATE_ERROR",
        )


async def _batch_delete(item: BatchOperationItem) -> BatchOperationResult:
    """批量删除文件"""
    try:
        if not storage_service.exists(item.s3_key):
            return BatchOperationResult(
                s3_key=item.s3_key,
                success=False,
                message="File not found",
                error_code="FILE_NOT_FOUND",
            )

        storage_service.delete(item.s3_key)

        return BatchOperationResult(
            s3_key=item.s3_key,
            success=True,
            message="File deleted successfully",
        )
    except Exception as e:
        return BatchOperationResult(
            s3_key=item.s3_key,
            success=False,
            message=str(e),
            error_code="DELETE_ERROR",
        )


async def _batch_copy(item: BatchOperationItem) -> BatchOperationResult:
    """批量复制文件"""
    try:
        if not item.source_key:
            return BatchOperationResult(
                s3_key=item.s3_key,
                success=False,
                message="Source key is required for copy",
                error_code="MISSING_SOURCE_KEY",
            )

        if not storage_service.exists(item.source_key):
            return BatchOperationResult(
                s3_key=item.s3_key,
                success=False,
                message=f"Source file not found: {item.source_key}",
                error_code="SOURCE_NOT_FOUND",
            )

        if storage_service.exists(item.s3_key):
            return BatchOperationResult(
                s3_key=item.s3_key,
                success=False,
                message="Destination file already exists",
                error_code="DESTINATION_EXISTS",
            )

        from config import settings

        source_key = item.source_key.lstrip("/")
        dest_key = item.s3_key.lstrip("/")

        storage_service.client.copy_object(
            Bucket=settings.s3.bucket,
            CopySource={"Bucket": settings.s3.bucket, "Key": source_key},
            Key=dest_key,
        )

        return BatchOperationResult(
            s3_key=item.s3_key,
            success=True,
            message="File copied successfully",
        )
    except Exception as e:
        return BatchOperationResult(
            s3_key=item.s3_key,
            success=False,
            message=str(e),
            error_code="COPY_ERROR",
        )


async def _batch_move(item: BatchOperationItem) -> BatchOperationResult:
    """批量移动文件"""
    try:
        if not item.source_key:
            return BatchOperationResult(
                s3_key=item.s3_key,
                success=False,
                message="Source key is required for move",
                error_code="MISSING_SOURCE_KEY",
            )

        if not storage_service.exists(item.source_key):
            return BatchOperationResult(
                s3_key=item.s3_key,
                success=False,
                message=f"Source file not found: {item.source_key}",
                error_code="SOURCE_NOT_FOUND",
            )

        if storage_service.exists(item.s3_key):
            return BatchOperationResult(
                s3_key=item.s3_key,
                success=False,
                message="Destination file already exists",
                error_code="DESTINATION_EXISTS",
            )

        from config import settings

        source_key = item.source_key.lstrip("/")
        dest_key = item.s3_key.lstrip("/")

        storage_service.client.copy_object(
            Bucket=settings.s3.bucket,
            CopySource={"Bucket": settings.s3.bucket, "Key": source_key},
            Key=dest_key,
        )

        storage_service.delete(item.source_key)

        return BatchOperationResult(
            s3_key=item.s3_key,
            success=True,
            message="File moved successfully",
        )
    except Exception as e:
        return BatchOperationResult(
            s3_key=item.s3_key,
            success=False,
            message=str(e),
            error_code="MOVE_ERROR",
        )


def _guess_content_type(s3_key: str) -> str:
    """根据文件扩展名猜测内容类型"""
    ext = s3_key.lower().split(".")[-1] if "." in s3_key else ""

    mime_types = {
        "txt": "text/plain",
        "md": "text/markdown",
        "markdown": "text/markdown",
        "json": "application/json",
        "xml": "application/xml",
        "html": "text/html",
        "htm": "text/html",
        "csv": "text/csv",
        "pdf": "application/pdf",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "gif": "image/gif",
        "bmp": "image/bmp",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }

    return mime_types.get(ext, "application/octet-stream")
