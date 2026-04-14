"""文件操作 REST 端点。"""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse

from ukb_api.api.deps import get_dx_client
from ukb_api.domain.file.models import FileInfo, FileListItem
from ukb_api.domain.file.service import FileService
from dx_client import IDXClient

router = APIRouter(prefix="/file", tags=["file"])


def get_file_service(dx_client: IDXClient = Depends(get_dx_client)) -> FileService:
    return FileService(dx_client)


@router.get("/", response_model=list[FileListItem])
def list_files(
    folder: str | None = Query(default=None, description="文件夹路径。"),
    name: str | None = Query(default=None, description="文件名匹配模式。"),
    recurse: bool = Query(default=False, description="是否递归列出子文件夹。"),
    limit: int = Query(default=100, ge=1, le=1000, description="返回数量上限。"),
    refresh: bool = Query(default=False, description="是否跳过缓存。"),
    service: FileService = Depends(get_file_service),
) -> list[FileListItem]:
    """列出当前项目中的文件。"""
    files = service.list_files(
        folder=folder,
        name_pattern=name,
        recurse=recurse,
        limit=limit,
        refresh=refresh,
    )
    return [
        FileListItem(
            id=f.id,
            name=f.name,
            project=f.project,
            folder=f.folder,
            state=f.state,
            size=f.size,
            created=f.created,
            modified=f.modified,
        )
        for f in files
    ]


@router.get("/{file_id}", response_model=FileInfo)
def get_file_info(
    file_id: str,
    refresh: bool = Query(default=False),
    service: FileService = Depends(get_file_service),
) -> FileInfo:
    """获取文件元数据。"""
    try:
        f = service.describe_file(file_id, refresh=refresh)
        return FileInfo(
            id=f.id,
            name=f.name,
            project=f.project,
            folder=f.folder,
            state=f.state,
            size=f.size,
            created=f.created,
            modified=f.modified,
            description=f.description,
            md5=f.md5,
            sha256=f.sha256,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload", response_model=FileInfo)
async def upload_file(
    file: UploadFile = File(..., description="要上传的文件。"),
    name: str | None = Query(default=None, description="上传后的文件名。"),
    folder: str = Query(default="/", description="目标文件夹路径。"),
    project_id: str | None = Query(default=None, description="目标项目 ID。"),
    service: FileService = Depends(get_file_service),
) -> FileInfo:
    """上传本地文件到项目。"""
    try:
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = Path(tmp.name)

        try:
            result = service.upload_file(
                local_path=tmp_path,
                name=name or file.filename,
                folder=folder,
                project_id=project_id,
            )
            return FileInfo(
                id=result.id,
                name=result.name,
                project=result.project,
                folder=result.folder,
                state=result.state,
                size=result.size,
                created=result.created,
                modified=result.modified,
                description=result.description,
                md5=result.md5,
                sha256=result.sha256,
            )
        finally:
            tmp_path.unlink(missing_ok=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{file_id}/download")
def download_file(
    file_id: str,
    local_path: str | None = Query(
        default=None, description="本地保存路径。为 None 时使用临时目录。"
    ),
    service: FileService = Depends(get_file_service),
) -> FileResponse:
    """下载文件到本地路径。"""
    try:
        saved_path = service.download_file(file_id=file_id, local_path=local_path)
        return FileResponse(path=saved_path, filename=saved_path.name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
