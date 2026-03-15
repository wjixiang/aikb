"""
File Repository - 文件元数据存储
"""

import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

from models.file import FileMetadata, FileStatus


class FileRepository:
    """文件元数据仓库（内存存储）"""

    def __init__(self):
        self._files: dict[str, FileMetadata] = {}

    async def create(self, metadata: FileMetadata) -> FileMetadata:
        """创建文件元数据"""
        self._files[metadata.file_id] = metadata
        return metadata

    async def get(self, file_id: str) -> Optional[FileMetadata]:
        """获取文件元数据"""
        return self._files.get(file_id)

    async def update(
        self, file_id: str, metadata: FileMetadata
    ) -> Optional[FileMetadata]:
        """更新文件元数据"""
        if file_id in self._files:
            metadata.updated_at = datetime.now()
            self._files[file_id] = metadata
            return metadata
        return None

    async def delete(self, file_id: str) -> bool:
        """删除文件元数据"""
        if file_id in self._files:
            del self._files[file_id]
            return True
        return False

    async def list(self, limit: int = 100, offset: int = 0) -> list[FileMetadata]:
        """列出文件元数据"""
        files = list(self._files.values())
        files.sort(key=lambda f: f.created_at, reverse=True)
        return files[offset : offset + limit]

    async def exists(self, file_id: str) -> bool:
        """检查文件是否存在"""
        return file_id in self._files


# 全局仓库实例
file_repository = FileRepository()
