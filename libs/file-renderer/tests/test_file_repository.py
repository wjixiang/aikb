"""
File Repository Unit Tests
"""

import uuid
from datetime import datetime

import pytest

from repositories.file_repository import FileRepository
from models.file import FileMetadata, FileStatus, PaginationMode


class TestFileRepositoryUnit:
    """FileRepository unit tests"""

    def test_init(self):
        """Test FileRepository initialization"""
        repo = FileRepository()
        assert repo._files == {}

    async def test_create(self, file_repository_instance):
        """Test creating file metadata"""
        metadata = FileMetadata(
            file_id=str(uuid.uuid4()),
            original_name="test.pdf",
            s3_key="files/test.pdf",
            content_type="application/pdf",
            file_size=1024,
            status=FileStatus.PENDING,
        )

        result = await file_repository_instance.create(metadata)

        assert result is metadata
        assert metadata.file_id in file_repository_instance._files

    async def test_get_existing(self, file_repository_instance):
        """Test getting existing file metadata"""
        metadata = FileMetadata(
            file_id=str(uuid.uuid4()),
            original_name="test.pdf",
            s3_key="files/test.pdf",
            content_type="application/pdf",
            file_size=1024,
        )
        await file_repository_instance.create(metadata)

        result = await file_repository_instance.get(metadata.file_id)

        assert result is metadata

    async def test_get_nonexistent(self, file_repository_instance):
        """Test getting non-existent file metadata"""
        result = await file_repository_instance.get("nonexistent-id")

        assert result is None

    async def test_update_existing(self, file_repository_instance):
        """Test updating existing file metadata"""
        metadata = FileMetadata(
            file_id=str(uuid.uuid4()),
            original_name="test.pdf",
            s3_key="files/test.pdf",
            content_type="application/pdf",
            file_size=1024,
            status=FileStatus.PENDING,
        )
        await file_repository_instance.create(metadata)

        # Update metadata
        metadata.status = FileStatus.COMPLETED
        metadata.page_count = 10

        result = await file_repository_instance.update(metadata.file_id, metadata)

        assert result is metadata
        assert result.status == FileStatus.COMPLETED
        assert result.page_count == 10
        assert result.updated_at >= result.created_at

    async def test_update_nonexistent(self, file_repository_instance):
        """Test updating non-existent file metadata"""
        metadata = FileMetadata(
            file_id=str(uuid.uuid4()),
            original_name="test.pdf",
            s3_key="files/test.pdf",
            content_type="application/pdf",
        )

        result = await file_repository_instance.update("nonexistent-id", metadata)

        assert result is None

    async def test_delete_existing(self, file_repository_instance):
        """Test deleting existing file metadata"""
        metadata = FileMetadata(
            file_id=str(uuid.uuid4()),
            original_name="test.pdf",
            s3_key="files/test.pdf",
            content_type="application/pdf",
        )
        await file_repository_instance.create(metadata)

        result = await file_repository_instance.delete(metadata.file_id)

        assert result is True
        assert metadata.file_id not in file_repository_instance._files

    async def test_delete_nonexistent(self, file_repository_instance):
        """Test deleting non-existent file metadata"""
        result = await file_repository_instance.delete("nonexistent-id")

        assert result is False

    async def test_list_empty(self, file_repository_instance):
        """Test listing files (empty)"""
        result = await file_repository_instance.list()

        assert result == []

    async def test_list_with_files(self, file_repository_instance):
        """Test listing files with data"""
        # Create multiple files
        for i in range(5):
            metadata = FileMetadata(
                file_id=str(uuid.uuid4()),
                original_name=f"test{i}.pdf",
                s3_key=f"files/test{i}.pdf",
                content_type="application/pdf",
            )
            await file_repository_instance.create(metadata)

        result = await file_repository_instance.list()

        assert len(result) == 5

    async def test_list_with_limit(self, file_repository_instance):
        """Test listing files with limit"""
        # Create 10 files
        for i in range(10):
            metadata = FileMetadata(
                file_id=str(uuid.uuid4()),
                original_name=f"test{i}.pdf",
                s3_key=f"files/test{i}.pdf",
                content_type="application/pdf",
            )
            await file_repository_instance.create(metadata)

        result = await file_repository_instance.list(limit=5)

        assert len(result) == 5

    async def test_list_with_offset(self, file_repository_instance):
        """Test listing files with offset"""
        # Create files with known names
        for i in range(5):
            metadata = FileMetadata(
                file_id=str(uuid.uuid4()),
                original_name=f"test{i}.pdf",
                s3_key=f"files/test{i}.pdf",
                content_type="application/pdf",
            )
            await file_repository_instance.create(metadata)

        result = await file_repository_instance.list(limit=2, offset=2)

        assert len(result) == 2

    async def test_list_sorted_by_created_at(self, file_repository_instance):
        """Test that files are sorted by created_at descending"""
        import asyncio

        # Create files with delays to ensure different timestamps
        metadata1 = FileMetadata(
            file_id="id1",
            original_name="first.pdf",
            s3_key="files/first.pdf",
            content_type="application/pdf",
        )
        await file_repository_instance.create(metadata1)

        await asyncio.sleep(0.01)  # Small delay

        metadata2 = FileMetadata(
            file_id="id2",
            original_name="second.pdf",
            s3_key="files/second.pdf",
            content_type="application/pdf",
        )
        await file_repository_instance.create(metadata2)

        result = await file_repository_instance.list()

        # Should be sorted by created_at descending (newest first)
        assert result[0].file_id == "id2"
        assert result[1].file_id == "id1"

    async def test_exists_true(self, file_repository_instance):
        """Test checking existence (file exists)"""
        metadata = FileMetadata(
            file_id=str(uuid.uuid4()),
            original_name="test.pdf",
            s3_key="files/test.pdf",
            content_type="application/pdf",
        )
        await file_repository_instance.create(metadata)

        result = await file_repository_instance.exists(metadata.file_id)

        assert result is True

    async def test_exists_false(self, file_repository_instance):
        """Test checking existence (file does not exist)"""
        result = await file_repository_instance.exists("nonexistent-id")

        assert result is False


class TestFileRepositoryEdgeCases:
    """FileRepository edge case tests"""

    async def test_create_duplicate_id(self, file_repository_instance):
        """Test creating file with duplicate ID (should overwrite)"""
        file_id = str(uuid.uuid4())

        metadata1 = FileMetadata(
            file_id=file_id,
            original_name="first.pdf",
            s3_key="files/first.pdf",
            content_type="application/pdf",
        )
        await file_repository_instance.create(metadata1)

        metadata2 = FileMetadata(
            file_id=file_id,
            original_name="second.pdf",
            s3_key="files/second.pdf",
            content_type="application/pdf",
        )
        await file_repository_instance.create(metadata2)

        result = await file_repository_instance.get(file_id)

        assert result.original_name == "second.pdf"

    async def test_list_large_offset(self, file_repository_instance):
        """Test listing with offset larger than data size"""
        metadata = FileMetadata(
            file_id=str(uuid.uuid4()),
            original_name="test.pdf",
            s3_key="files/test.pdf",
            content_type="application/pdf",
        )
        await file_repository_instance.create(metadata)

        result = await file_repository_instance.list(offset=100)

        assert result == []

    async def test_list_zero_limit(self, file_repository_instance):
        """Test listing with limit=0"""
        for i in range(5):
            metadata = FileMetadata(
                file_id=str(uuid.uuid4()),
                original_name=f"test{i}.pdf",
                s3_key=f"files/test{i}.pdf",
                content_type="application/pdf",
            )
            await file_repository_instance.create(metadata)

        result = await file_repository_instance.list(limit=0)

        assert result == []

    async def test_update_preserves_id(self, file_repository_instance):
        """Test that update preserves file_id"""
        original_id = str(uuid.uuid4())
        metadata = FileMetadata(
            file_id=original_id,
            original_name="test.pdf",
            s3_key="files/test.pdf",
            content_type="application/pdf",
        )
        await file_repository_instance.create(metadata)

        # Create new metadata with different ID but same file_id
        new_metadata = FileMetadata(
            file_id=original_id,
            original_name="updated.pdf",
            s3_key="files/updated.pdf",
            content_type="application/pdf",
        )

        await file_repository_instance.update(original_id, new_metadata)

        result = await file_repository_instance.get(original_id)
        assert result.file_id == original_id
        assert result.original_name == "updated.pdf"
