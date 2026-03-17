"""
File Router API Tests
"""

import io
import uuid
from datetime import datetime
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from models.file import FileMetadata, FileStatus, PaginationMode


class TestFileUpload:
    """File upload endpoint tests"""

    def test_upload_file_success(self, client, mock_storage_service, mock_file_repository):
        """Test successful file upload"""
        mock_file_repository.create = AsyncMock(return_value=None)

        file_content = b"Hello, World!"
        files = {"file": ("test.txt", io.BytesIO(file_content), "text/plain")}

        response = client.post("/files/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert "file_id" in data
        assert data["original_name"] == "test.txt"
        assert data["content_type"] == "text/plain"
        assert data["file_size"] == len(file_content)
        assert data["status"] == "pending"

        # Verify storage service was called
        mock_storage_service.upload.assert_called_once()
        # Verify repository was called
        mock_file_repository.create.assert_called_once()

    def test_upload_file_too_large(self, client, mocker):
        """Test uploading file that exceeds size limit"""
        mock_settings = mocker.patch("routers.file.settings")
        mock_settings.conversion.max_file_size = 100  # 100 bytes limit

        file_content = b"x" * 200  # 200 bytes
        files = {"file": ("large.txt", io.BytesIO(file_content), "text/plain")}

        response = client.post("/files/upload", files=files)

        assert response.status_code == 400
        assert "too large" in response.json()["detail"].lower()

    def test_upload_file_no_filename(self, client, mock_storage_service, mock_file_repository):
        """Test uploading file without filename"""
        mock_file_repository.create = AsyncMock(return_value=None)

        file_content = b"Content"
        files = {"file": ("", io.BytesIO(file_content), "text/plain")}

        response = client.post("/files/upload", files=files)

        # Should still work with empty filename
        assert response.status_code == 200

    def test_upload_file_binary_content(self, client, mock_storage_service, mock_file_repository):
        """Test uploading binary file"""
        mock_file_repository.create = AsyncMock(return_value=None)

        file_content = b"\x00\x01\x02\x03\xff\xfe"
        files = {"file": ("binary.bin", io.BytesIO(file_content), "application/octet-stream")}

        response = client.post("/files/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert data["content_type"] == "application/octet-stream"


class TestFileDetail:
    """File detail endpoint tests"""

    def test_get_file_success(self, client, mock_file_repository, sample_file_metadata):
        """Test getting file metadata"""
        mock_file_repository.get = AsyncMock(return_value=sample_file_metadata)

        response = client.get(f"/files/{sample_file_metadata.file_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["file_id"] == sample_file_metadata.file_id
        assert data["original_name"] == sample_file_metadata.original_name
        assert data["content_type"] == sample_file_metadata.content_type
        assert data["file_size"] == sample_file_metadata.file_size
        assert data["status"] == sample_file_metadata.status.value

    def test_get_file_not_found(self, client, mock_file_repository):
        """Test getting non-existent file"""
        mock_file_repository.get = AsyncMock(return_value=None)

        response = client.get(f"/files/{uuid.uuid4()}")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_get_file_invalid_uuid(self, client):
        """Test getting file with invalid UUID format"""
        response = client.get("/files/invalid-uuid")

        # FastAPI will still try to call the endpoint
        # The repository will return None for invalid UUID
        assert response.status_code in [404, 422]


class TestFileDownload:
    """File download endpoint tests"""

    def test_download_file_success(self, client, mock_file_repository, mock_storage_service, sample_file_metadata):
        """Test getting download URL"""
        mock_file_repository.get = AsyncMock(return_value=sample_file_metadata)
        mock_storage_service.get_presigned_url.return_value = "http://example.com/download?token=abc123"

        response = client.get(f"/files/{sample_file_metadata.file_id}/download")

        assert response.status_code == 200
        data = response.json()
        assert "download_url" in data
        assert data["download_url"] == "http://example.com/download?token=abc123"
        assert data["expires_in"] == 3600

    def test_download_file_custom_expiry(self, client, mock_file_repository, mock_storage_service, sample_file_metadata):
        """Test getting download URL with custom expiry"""
        mock_file_repository.get = AsyncMock(return_value=sample_file_metadata)
        mock_storage_service.get_presigned_url.return_value = "http://example.com/download?token=abc123"

        response = client.get(f"/files/{sample_file_metadata.file_id}/download?expires_in=7200")

        assert response.status_code == 200
        data = response.json()
        assert data["expires_in"] == 7200

        # Verify storage service was called with custom expiry
        mock_storage_service.get_presigned_url.assert_called_once_with(
            sample_file_metadata.s3_key, 7200
        )

    def test_download_file_not_found(self, client, mock_file_repository):
        """Test downloading non-existent file"""
        mock_file_repository.get = AsyncMock(return_value=None)

        response = client.get(f"/files/{uuid.uuid4()}/download")

        assert response.status_code == 404


class TestFileDelete:
    """File delete endpoint tests"""

    def test_delete_file_success(self, client, mock_file_repository, mock_storage_service, sample_file_metadata):
        """Test deleting file"""
        mock_file_repository.get = AsyncMock(return_value=sample_file_metadata)
        mock_file_repository.delete = AsyncMock(return_value=True)

        response = client.delete(f"/files/{sample_file_metadata.file_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["file_id"] == sample_file_metadata.file_id
        assert "deleted successfully" in data["message"].lower()

        # Verify storage service delete was called
        mock_storage_service.delete.assert_called_once_with(sample_file_metadata.s3_key)
        # Verify repository delete was called
        mock_file_repository.delete.assert_called_once_with(sample_file_metadata.file_id)

    def test_delete_file_not_found(self, client, mock_file_repository):
        """Test deleting non-existent file"""
        mock_file_repository.get = AsyncMock(return_value=None)

        response = client.delete(f"/files/{uuid.uuid4()}")

        assert response.status_code == 404

    def test_delete_file_storage_error(self, client, mock_file_repository, mock_storage_service, sample_file_metadata):
        """Test deleting file when storage delete fails"""
        mock_file_repository.get = AsyncMock(return_value=sample_file_metadata)
        mock_file_repository.delete = AsyncMock(return_value=True)
        mock_storage_service.delete.side_effect = Exception("S3 error")

        # Should still succeed even if S3 delete fails
        response = client.delete(f"/files/{sample_file_metadata.file_id}")

        assert response.status_code == 200
        # Repository delete should still be called
        mock_file_repository.delete.assert_called_once()


class TestFileList:
    """File list endpoint tests"""

    def test_list_files_empty(self, client, mock_file_repository):
        """Test listing files (empty)"""
        mock_file_repository.list = AsyncMock(return_value=[])

        response = client.get("/files/")

        assert response.status_code == 200
        data = response.json()
        assert data["files"] == []
        assert data["total"] == 0
        assert data["limit"] == 100
        assert data["offset"] == 0

    def test_list_files_with_data(self, client, mock_file_repository, sample_file_metadatas):
        """Test listing files with data"""
        mock_file_repository.list = AsyncMock(return_value=sample_file_metadatas)

        response = client.get("/files/")

        assert response.status_code == 200
        data = response.json()
        assert len(data["files"]) == 3
        assert data["total"] == 3

    def test_list_files_with_pagination(self, client, mock_file_repository):
        """Test listing files with pagination"""
        mock_file_repository.list = AsyncMock(return_value=[])

        response = client.get("/files/?limit=10&offset=20")

        assert response.status_code == 200
        data = response.json()
        assert data["limit"] == 10
        assert data["offset"] == 20

        # Verify repository was called with correct params
        mock_file_repository.list.assert_called_once_with(10, 20)


class TestFileRouterEdgeCases:
    """File router edge case tests"""

    def test_upload_empty_file(self, client, mock_storage_service, mock_file_repository):
        """Test uploading empty file"""
        mock_file_repository.create = AsyncMock(return_value=None)

        files = {"file": ("empty.txt", io.BytesIO(b""), "text/plain")}

        response = client.post("/files/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert data["file_size"] == 0

    def test_upload_unicode_filename(self, client, mock_storage_service, mock_file_repository):
        """Test uploading file with unicode filename"""
        mock_file_repository.create = AsyncMock(return_value=None)

        file_content = b"Content"
        files = {"file": ("\u4e2d\u6587\u6587\u4ef6.txt", io.BytesIO(file_content), "text/plain")}

        response = client.post("/files/upload", files=files)

        assert response.status_code == 200

    def test_list_files_large_limit(self, client, mock_file_repository):
        """Test listing files with large limit"""
        mock_file_repository.list = AsyncMock(return_value=[])

        response = client.get("/files/?limit=10000")

        assert response.status_code == 200
