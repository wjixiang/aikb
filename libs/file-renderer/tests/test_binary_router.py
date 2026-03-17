"""
Binary Router API Tests

Tests for the Binary file creation router.
"""

import pytest
from fastapi.testclient import TestClient


class TestBinaryRouterCreate:
    """Tests for binary file creation endpoint"""

    def test_create_binary_success(self, client: TestClient, mock_storage_service):
        """Test creating binary file successfully"""
        mock_storage_service.upload.return_value = "http://example.com/files/binary/2026/03/17/test.bin"

        response = client.post("/api/v1/binary/create", json={
            "fileName": "test.bin"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["message"] == "File created successfully"
        assert data["content_type"] == "application/octet-stream"
        assert data["file_size"] == 0
        assert "s3_key" in data
        mock_storage_service.upload.assert_called_once()

    def test_create_binary_with_custom_name(self, client: TestClient, mock_storage_service):
        """Test creating binary file with custom name"""
        mock_storage_service.upload.return_value = "http://example.com/files/binary/2026/03/17/data.bin"

        response = client.post("/api/v1/binary/create", json={
            "fileName": "my-data.bin"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_create_binary_storage_error(self, client: TestClient, mock_storage_service):
        """Test creating binary file when storage fails"""
        mock_storage_service.upload.side_effect = Exception("S3 connection error")

        response = client.post("/api/v1/binary/create", json={
            "fileName": "test.bin"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "failed" in data["message"].lower()

    def test_create_binary_missing_filename(self, client: TestClient):
        """Test creating binary file without filename"""
        response = client.post("/api/v1/binary/create", json={
            "fileType": "binary"
        })

        assert response.status_code == 422

    def test_create_binary_various_extensions(self, client: TestClient, mock_storage_service):
        """Test creating binary files with various extensions"""
        extensions = [".bin", ".dat", ".raw", ".exe", ".dll"]

        for ext in extensions:
            mock_storage_service.reset_mock()
            mock_storage_service.upload.return_value = f"http://example.com/files/binary/test{ext}"

            response = client.post("/api/v1/binary/create", json={
                "fileName": f"test{ext}"
            })

            assert response.status_code == 200
            assert response.json()["success"] is True


class TestBinaryRouterResponseStructure:
    """Tests for response structure consistency"""

    def test_response_structure(self, client: TestClient, mock_storage_service):
        """Test that response has all required fields"""
        mock_storage_service.upload.return_value = "http://example.com/files/binary/test.bin"

        response = client.post("/api/v1/binary/create", json={
            "fileName": "test.bin"
        })

        assert response.status_code == 200
        data = response.json()

        assert "success" in data
        assert "message" in data
        assert "s3_key" in data
        assert "content_type" in data
        assert "file_size" in data

    def test_success_response_values(self, client: TestClient, mock_storage_service):
        """Test success response values"""
        mock_storage_service.upload.return_value = "http://example.com/files/binary/test.bin"

        response = client.post("/api/v1/binary/create", json={
            "fileName": "test.bin"
        })

        data = response.json()
        assert data["success"] is True
        assert data["content_type"] == "application/octet-stream"
        assert data["file_size"] == 0


class TestBinaryRouterContentType:
    """Tests for content type handling"""

    def test_content_type_is_octet_stream(self, client: TestClient, mock_storage_service):
        """Test that content type is application/octet-stream"""
        mock_storage_service.upload.return_value = "http://example.com/files/binary/test.bin"

        response = client.post("/api/v1/binary/create", json={
            "fileName": "test.bin"
        })

        data = response.json()
        assert data["content_type"] == "application/octet-stream"

        call_kwargs = mock_storage_service.upload.call_args[1]
        assert call_kwargs["content_type"] == "application/octet-stream"
