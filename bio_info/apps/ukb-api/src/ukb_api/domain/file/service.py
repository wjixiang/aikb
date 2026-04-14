"""文件操作服务。"""

from __future__ import annotations

from pathlib import Path

from dx_client import DXFileInfo, IDXClient


class FileService:
    """文件操作服务。"""

    def __init__(self, dx_client: IDXClient) -> None:
        self._client = dx_client

    def list_files(
        self,
        folder: str | None = None,
        name_pattern: str | None = None,
        recurse: bool = False,
        limit: int = 100,
        refresh: bool = False,
    ) -> list[DXFileInfo]:
        """列出当前项目中的文件。"""
        return self._client.list_files(
            folder=folder,
            name_pattern=name_pattern,
            recurse=recurse,
            limit=limit,
            refresh=refresh,
        )

    def describe_file(self, file_id: str, refresh: bool = False) -> DXFileInfo:
        """获取文件元数据。"""
        return self._client.describe_file(file_id, refresh=refresh)

    def upload_file(
        self,
        local_path: str | Path,
        name: str | None = None,
        folder: str = "/",
        project_id: str | None = None,
    ) -> DXFileInfo:
        """上传本地文件到项目。"""
        return self._client.upload_file(
            local_path=local_path,
            name=name,
            folder=folder,
            project_id=project_id,
        )

    def download_file(self, file_id: str, local_path: str | None = None) -> Path:
        """下载文件到本地路径。"""
        return self._client.download_file(file_id=file_id, local_path=local_path)
