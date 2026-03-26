"""
File storage service (local filesystem)

Handles file upload, storage, and retrieval using local filesystem.
"""

import logging
import os
import shutil
from pathlib import Path
from typing import Optional
from uuid import uuid4

from config import settings

logger = logging.getLogger(__name__)


class FileService:
    """Service for managing file storage"""

    def __init__(self, storage_path: Optional[str] = None):
        """
        Initialize file service

        Args:
            storage_path: Base path for file storage
        """
        self.storage_path = Path(storage_path or "/tmp/bibmax_documents")
        self.storage_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"FileService initialized with storage: {self.storage_path}")

    def generate_file_id(self) -> str:
        """Generate unique file ID"""
        return str(uuid4())

    async def save_file(
        self,
        filename: str,
        content: bytes,
        content_type: str,
    ) -> tuple[str, str]:
        """
        Save file to local storage

        Args:
            filename: Original filename
            content: File content
            content_type: MIME type

        Returns:
            Tuple of (file_id, file_path)
        """
        file_id = self.generate_file_id()

        # Create subdirectory based on file_id prefix
        prefix = file_id[:2]
        dir_path = self.storage_path / prefix
        dir_path.mkdir(parents=True, exist_ok=True)

        # Save file
        file_path = dir_path / file_id
        with open(file_path, "wb") as f:
            f.write(content)

        logger.info(f"Saved file: {file_id} ({len(content)} bytes)")
        return file_id, str(file_path)

    async def get_file_path(self, file_id: str) -> Optional[str]:
        """
        Get file path by ID

        Args:
            file_id: File identifier

        Returns:
            File path or None if not found
        """
        prefix = file_id[:2]
        file_path = self.storage_path / prefix / file_id

        if file_path.exists():
            return str(file_path)
        return None

    async def delete_file(self, file_id: str) -> bool:
        """
        Delete file by ID

        Args:
            file_id: File identifier

        Returns:
            True if deleted, False otherwise
        """
        prefix = file_id[:2]
        file_path = self.storage_path / prefix / file_id

        if file_path.exists():
            file_path.unlink()
            logger.info(f"Deleted file: {file_id}")
            return True
        return False

    async def file_exists(self, file_id: str) -> bool:
        """
        Check if file exists

        Args:
            file_id: File identifier

        Returns:
            True if file exists
        """
        file_path = await self.get_file_path(file_id)
        return file_path is not None

    async def get_file_size(self, file_id: str) -> Optional[int]:
        """
        Get file size

        Args:
            file_id: File identifier

        Returns:
            File size in bytes or None
        """
        file_path = await self.get_file_path(file_id)
        if file_path:
            return os.path.getsize(file_path)
        return None


# Singleton instance
_file_service: Optional[FileService] = None


def get_file_service() -> FileService:
    """Get or create file service singleton"""
    global _file_service
    if _file_service is None:
        _file_service = FileService()
    return _file_service
