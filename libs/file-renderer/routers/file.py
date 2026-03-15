"""
File API Router
"""

import uuid

from fastapi import APIRouter, File, HTTPException, UploadFile

from config import settings
from lib.s3_key_generator import generate_file_key
from models.file import (
    FileDetailResponse,
    FileDownloadResponse,
    FileMetadata,
    FileStatus,
    FileUploadResponse,
)
from repositories.file_repository import file_repository
from services.storage_service import storage_service

router = APIRouter(prefix="/files", tags=["files"])


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(file: UploadFile = File(...)):
    """
    上传文件到S3存储

    Args:
        file: 上传的文件

    Returns:
        文件元数据
    """
    # 读取文件内容
    content = await file.read()

    # 检查文件大小
    if len(content) > settings.conversion.max_file_size:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max size: {settings.conversion.max_file_size} bytes"
        )

    # 生成唯一ID和S3 key
    file_id = str(uuid.uuid4())
    s3_key = generate_file_key(file.filename)

    # 上传到S3
    storage_service.upload(content, s3_key, file.content_type or "application/octet-stream")

    # 创建元数据
    metadata = FileMetadata(
        file_id=file_id,
        original_name=file.filename,
        s3_key=s3_key,
        content_type=file.content_type or "application/octet-stream",
        file_size=len(content),
        status=FileStatus.PENDING,
    )

    # 保存到仓库
    await file_repository.create(metadata)

    return FileUploadResponse(
        file_id=metadata.file_id,
        original_name=metadata.original_name,
        s3_key=metadata.s3_key,
        content_type=metadata.content_type,
        file_size=metadata.file_size,
        status=metadata.status,
    )


@router.get("/{file_id}", response_model=FileDetailResponse)
async def get_file(file_id: str):
    """
    获取文件元数据

    Args:
        file_id: 文件ID

    Returns:
        文件元数据
    """
    metadata = await file_repository.get(file_id)
    if not metadata:
        raise HTTPException(status_code=404, detail="File not found")

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


@router.get("/{file_id}/download", response_model=FileDownloadResponse)
async def download_file(file_id: str, expires_in: int = 3600):
    """
    获取文件下载链接

    Args:
        file_id: 文件ID
        expires_in: 链接过期时间(秒)

    Returns:
        预签名下载URL
    """
    metadata = await file_repository.get(file_id)
    if not metadata:
        raise HTTPException(status_code=404, detail="File not found")

    # 生成预签名URL
    download_url = storage_service.get_presigned_url(metadata.s3_key, expires_in)

    return FileDownloadResponse(
        download_url=download_url,
        expires_in=expires_in,
    )


@router.delete("/{file_id}")
async def delete_file(file_id: str):
    """
    删除文件

    Args:
        file_id: 文件ID

    Returns:
        删除结果
    """
    metadata = await file_repository.get(file_id)
    if not metadata:
        raise HTTPException(status_code=404, detail="File not found")

    # 从S3删除
    try:
        storage_service.delete(metadata.s3_key)
    except Exception:
        # 继续删除元数据，即使S3删除失败
        pass

    # 删除元数据
    await file_repository.delete(file_id)

    return {"message": "File deleted successfully", "file_id": file_id}


@router.get("/")
async def list_files(limit: int = 100, offset: int = 0):
    """
    列出所有文件

    Args:
        limit: 返回数量限制
        offset: 偏移量

    Returns:
        文件列表
    """
    files = await file_repository.list(limit, offset)
    return {
        "files": [
            FileDetailResponse(
                file_id=f.file_id,
                original_name=f.original_name,
                content_type=f.content_type,
                file_size=f.file_size,
                page_count=f.page_count,
                page_size=f.page_size,
                pagination_mode=f.pagination_mode,
                status=f.status,
                error_message=f.error_message,
                created_at=f.created_at,
                updated_at=f.updated_at,
            )
            for f in files
        ],
        "total": len(files),
        "limit": limit,
        "offset": offset,
    }
