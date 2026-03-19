"""
File API Router - 文件管理路由

提供文件上传、元数据查询、下载链接生成、删除和列表查询等功能
"""

import uuid
from typing import Any

from fastapi import APIRouter, File, Path, Query, UploadFile, status

from config import Settings, get_settings
from lib.exceptions import FileNotFoundException, FileTooLargeException
from lib.logging_config import get_logger
from lib.s3_key_generator import generate_file_key
from lib.schemas import COMMON_RESPONSES, FileDeleteResponse
from models.file import (
    FileDetailResponse,
    FileDownloadResponse,
    FileMetadata,
    FileStatus,
    FileUploadResponse,
)
from models.pagination import (
    CursorPaginationRequest,
    OffsetPaginationRequest,
    PaginatedResponse,
    PaginationParams,
    PaginationStrategy,
)
from repositories.file_repository import file_repository
from services.pagination_service import apply_pagination, create_page_response
from services.storage_service import storage_service

router = APIRouter(prefix="/files", tags=["files"])
logger = get_logger(__name__)

settings: Settings = get_settings()


@router.post(
    "/upload",
    response_model=FileUploadResponse,
    summary="上传文件",
    description="""
    上传文件到 S3 存储并创建文件元数据记录。

    - 支持所有文件类型
    - 自动生成唯一的 file_id
    - 文件大小限制由配置决定（默认 100MB）
    - 上传后文件状态为 PENDING，需要后续处理
    """,
    operation_id="uploadFile",
    responses={
        status.HTTP_201_CREATED: {
            "description": "文件上传成功",
            "model": FileUploadResponse,
        },
        status.HTTP_400_BAD_REQUEST: {
            "description": "文件过大或格式不支持",
            "content": {
                "application/json": {
                    "example": {"detail": "File too large. Max size: 104857600 bytes"}
                }
            },
        },
        **COMMON_RESPONSES,
    },
    status_code=status.HTTP_201_CREATED,
)
async def upload_file(
    file: UploadFile = File(..., description="要上传的文件，支持任意格式")
) -> FileUploadResponse:
    """
    上传文件到 S3 存储

    Args:
        file: 上传的文件对象

    Returns:
        FileUploadResponse: 文件上传后的元数据

    Raises:
        FileTooLargeException: 文件超过大小限制
    """
    # 读取文件内容
    content = await file.read()

    # 检查文件大小
    if len(content) > settings.conversion.max_file_size:
        raise FileTooLargeException(
            max_size=settings.conversion.max_file_size,
            actual_size=len(content),
        )

    # 生成唯一ID和S3 key
    file_id = str(uuid.uuid4())
    s3_key = generate_file_key(file.filename or "unnamed")

    logger.info(
        f"Uploading file: {file.filename}",
        extra={
            "file_id": file_id,
            "original_name": file.filename,
            "size": len(content),
            "content_type": file.content_type,
        },
    )

    # 上传到S3
    storage_service.upload(
        content, s3_key, file.content_type or "application/octet-stream"
    )

    # 创建元数据
    metadata = FileMetadata(
        file_id=file_id,
        original_name=file.filename or "unnamed",
        s3_key=s3_key,
        content_type=file.content_type or "application/octet-stream",
        file_size=len(content),
        status=FileStatus.PENDING,
    )

    # 保存到仓库
    await file_repository.create(metadata)

    logger.info(
        f"File uploaded successfully: {file_id}",
        extra={"file_id": file_id, "s3_key": s3_key},
    )

    return FileUploadResponse(
        file_id=metadata.file_id,
        original_name=metadata.original_name,
        s3_key=metadata.s3_key,
        content_type=metadata.content_type,
        file_size=metadata.file_size,
        status=metadata.status,
    )


@router.get(
    "/{file_id}",
    response_model=FileDetailResponse,
    summary="获取文件元数据",
    description="""
    根据 file_id 获取文件的完整元数据信息。

    返回信息包括：
    - 文件基本信息（名称、类型、大小）
    - 分页信息（页数、每页大小、分页模式）
    - 处理状态（pending/processing/completed/failed）
    - 时间戳（创建时间、更新时间）
    """,
    operation_id="getFileMetadata",
    responses={
        status.HTTP_200_OK: {
            "description": "成功获取文件元数据",
            "model": FileDetailResponse,
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "文件不存在",
            "content": {
                "application/json": {"example": {"detail": "File not found"}}
            },
        },
        **COMMON_RESPONSES,
    },
)
async def get_file(
    file_id: str = Path(
        ...,
        description="文件唯一标识符(UUID)",
        examples=["550e8400-e29b-41d4-a716-446655440000"],
    )
) -> FileDetailResponse:
    """
    获取文件元数据

    Args:
        file_id: 文件唯一标识符

    Returns:
        FileDetailResponse: 文件完整元数据

    Raises:
        FileNotFoundException: 文件不存在
    """
    metadata = await file_repository.get(file_id)
    if not metadata:
        logger.warning(f"File not found: {file_id}", extra={"file_id": file_id})
        raise FileNotFoundException(file_id=file_id)

    return FileDetailResponse(
        file_id=metadata.file_id,
        original_name=metadata.original_name,
        content_type=metadata.content_type,
        file_size=metadata.file_size,
        page_count=metadata.page_count,
        page_size=metadata.page_size,
        pagination_mode=metadata.pagination_mode,
        status=metadata.status,
        error_message=metadata.error_message,
        created_at=metadata.created_at,
        updated_at=metadata.updated_at,
    )


@router.get(
    "/{file_id}/download",
    response_model=FileDownloadResponse,
    summary="获取文件下载链接",
    description="""
    生成文件的预签名下载 URL。

    - URL 具有时效性，默认 1 小时（3600 秒）
    - 可自定义过期时间（60-86400 秒）
    - 直接访问 URL 即可下载文件
    """,
    operation_id="getFileDownloadUrl",
    responses={
        status.HTTP_200_OK: {
            "description": "成功生成下载链接",
            "model": FileDownloadResponse,
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "文件不存在",
            "content": {
                "application/json": {"example": {"detail": "File not found"}}
            },
        },
        **COMMON_RESPONSES,
    },
)
async def download_file(
    file_id: str = Path(
        ...,
        description="文件唯一标识符(UUID)",
        examples=["550e8400-e29b-41d4-a716-446655440000"],
    ),
    expires_in: int = Query(
        default=3600,
        description="链接过期时间（秒）",
        ge=60,
        le=86400,
        examples=[3600, 7200],
    ),
) -> FileDownloadResponse:
    """
    获取文件下载链接

    Args:
        file_id: 文件唯一标识符
        expires_in: 链接过期时间（秒）

    Returns:
        FileDownloadResponse: 预签名下载 URL

    Raises:
        FileNotFoundException: 文件不存在
    """
    metadata = await file_repository.get(file_id)
    if not metadata:
        logger.warning(
            f"File not found for download: {file_id}",
            extra={"file_id": file_id},
        )
        raise FileNotFoundException(file_id=file_id)

    # 生成预签名URL
    download_url = storage_service.get_presigned_url(metadata.s3_key, expires_in)

    logger.info(
        f"Generated download URL for file: {file_id}",
        extra={"file_id": file_id, "expires_in": expires_in},
    )

    return FileDownloadResponse(download_url=download_url, expires_in=expires_in)


@router.delete(
    "/{file_id}",
    response_model=FileDeleteResponse,
    summary="删除文件",
    description="""
    删除文件及其元数据。

    - 从 S3 存储删除文件对象
    - 从数据库删除元数据记录
    - 即使 S3 删除失败也会删除元数据
    """,
    operation_id="deleteFile",
    responses={
        status.HTTP_200_OK: {
            "description": "文件删除成功",
            "model": FileDeleteResponse,
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "文件不存在",
            "content": {
                "application/json": {"example": {"detail": "File not found"}}
            },
        },
        **COMMON_RESPONSES,
    },
)
async def delete_file(
    file_id: str = Path(
        ...,
        description="文件唯一标识符(UUID)",
        examples=["550e8400-e29b-41d4-a716-446655440000"],
    )
) -> FileDeleteResponse:
    """
    删除文件

    Args:
        file_id: 文件唯一标识符

    Returns:
        FileDeleteResponse: 删除结果

    Raises:
        FileNotFoundException: 文件不存在
    """
    metadata = await file_repository.get(file_id)
    if not metadata:
        logger.warning(
            f"File not found for deletion: {file_id}",
            extra={"file_id": file_id},
        )
        raise FileNotFoundException(file_id=file_id)

    # 从S3删除
    try:
        storage_service.delete(metadata.s3_key)
        logger.info(
            f"File deleted from S3: {file_id}",
            extra={"file_id": file_id, "s3_key": metadata.s3_key},
        )
    except Exception as e:
        # 记录错误但继续删除元数据
        logger.warning(
            f"Failed to delete file from S3, continuing with metadata deletion: {e}",
            extra={"file_id": file_id, "s3_key": metadata.s3_key},
        )

    # 删除元数据
    await file_repository.delete(file_id)
    logger.info(f"File metadata deleted: {file_id}", extra={"file_id": file_id})

    return FileDeleteResponse(
        success=True, message="File deleted successfully", file_id=file_id
    )


@router.get(
    "/",
    response_model=PaginatedResponse[dict],
    summary="列出所有文件",
    description="""
    分页列出所有文件的元数据。

    - 支持 Offset 和 Cursor 两种分页策略
    - Offset 分页: 使用 page 和 page_size 参数
    - Cursor 分页: 使用 cursor 和 limit 参数
    - 默认使用 Offset 分页，每页 20 条
    - 按创建时间倒序排列
    """,
    operation_id="listFiles",
    responses={
        status.HTTP_200_OK: {
            "description": "成功获取文件列表",
            "model": PaginatedResponse[dict],
        },
        **COMMON_RESPONSES,
    },
)
async def list_files(
    strategy: PaginationStrategy = Query(
        default=PaginationStrategy.OFFSET,
        description="分页策略: offset 或 cursor",
        examples=["offset"],
    ),
    page: int = Query(
        default=1,
        description="页码（Offset分页，从1开始）",
        ge=1,
        examples=[1, 2, 3],
    ),
    page_size: int = Query(
        default=20,
        description="每页数量",
        ge=1,
        le=1000,
        examples=[10, 20, 50],
    ),
    cursor: str | None = Query(
        default=None,
        description="游标（Cursor分页）",
        examples=["eyJpZCI6ICIxMjM0NTYifQ=="],
    ),
    limit: int = Query(
        default=20,
        description="每页数量（Cursor分页）",
        ge=1,
        le=1000,
        examples=[10, 20, 50],
    ),
    sort_by: str | None = Query(
        default="created_at",
        description="排序字段",
        examples=["created_at", "original_name", "file_size"],
    ),
    sort_order: str = Query(
        default="desc",
        description="排序方向: asc 或 desc",
        examples=["desc", "asc"],
    ),
) -> PaginatedResponse[dict]:
    """
    列出所有文件

    Args:
        strategy: 分页策略
        page: 页码（Offset分页）
        page_size: 每页数量
        cursor: 游标（Cursor分页）
        limit: 每页数量（Cursor分页）
        sort_by: 排序字段
        sort_order: 排序方向

    Returns:
        PaginatedResponse: 分页文件列表
    """
    # 构建分页参数
    if strategy == PaginationStrategy.CURSOR:
        params = CursorPaginationRequest(
            cursor=cursor,
            limit=limit,
            sort_by=sort_by,
            sort_order=sort_order,  # type: ignore
        ).to_params()
    else:
        params = OffsetPaginationRequest(
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,  # type: ignore
        ).to_params()

    # 获取所有文件（内存存储，实际项目中应该使用数据库查询）
    all_files = await file_repository.list(limit=10000, offset=0)

    # 应用排序
    if sort_by == "created_at":
        all_files.sort(key=lambda f: f.created_at or 0, reverse=(sort_order == "desc"))
    elif sort_by == "original_name":
        all_files.sort(key=lambda f: f.original_name or "", reverse=(sort_order == "desc"))
    elif sort_by == "file_size":
        all_files.sort(key=lambda f: f.file_size or 0, reverse=(sort_order == "desc"))

    # 转换为字典列表
    file_dicts = [
        {
            "file_id": f.file_id,
            "original_name": f.original_name,
            "content_type": f.content_type,
            "file_size": f.file_size,
            "page_count": f.page_count,
            "page_size": f.page_size,
            "pagination_mode": f.pagination_mode.value if f.pagination_mode else None,
            "status": f.status.value if f.status else None,
            "error_message": f.error_message,
            "created_at": f.created_at.isoformat() if f.created_at else None,
            "updated_at": f.updated_at.isoformat() if f.updated_at else None,
        }
        for f in all_files
    ]

    # 应用分页
    result = apply_pagination(file_dicts, params)

    logger.debug(
        f"Listed files: {len(result.data)} results",
        extra={
            "strategy": strategy.value,
            "page": page if strategy == PaginationStrategy.OFFSET else None,
            "cursor": cursor if strategy == PaginationStrategy.CURSOR else None,
            "count": len(result.data),
        },
    )

    return result
