"""
Text Router API Tests

Tests for the Text file creation router.
"""

import pytest
from fastapi.testclient import TestClient


class TestTextRouterCreate:
    """Tests for text file creation endpoint"""

    def test_create_text_success(self, client: TestClient, mock_storage_service):
        """Test creating text file successfully"""
        mock_storage_service.upload.return_value = "http://example.com/files/text/2026/03/17/test.txt"

        response = client.post("/api/v1/text/create", json={
            "fileName": "test.txt"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["message"] == "File created successfully"
        assert data["content_type"] == "text/plain"
        assert data["file_size"] == 0
        assert "s3_key" in data
        mock_storage_service.upload.assert_called_once()

    def test_create_text_with_custom_name(self, client: TestClient, mock_storage_service):
        """Test creating text file with custom name"""
        mock_storage_service.upload.return_value = "http://example.com/files/text/2026/03/17/notes.txt"

        response = client.post("/api/v1/text/create", json={
            "fileName": "my-notes.txt"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_create_text_storage_error(self, client: TestClient, mock_storage_service):
        """Test creating text file when storage fails"""
        mock_storage_service.upload.side_effect = Exception("S3 connection error")

        response = client.post("/api/v1/text/create", json={
            "fileName": "test.txt"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "failed" in data["message"].lower()
        assert "s3_key" in data

    def test_create_text_missing_filename(self, client: TestClient):
        """Test creating text file without filename"""
        response = client.post("/api/v1/text/create", json={
            "fileType": "text"
        })

        # Should fail validation
        assert response.status_code == 422

    def test_create_text_empty_filename(self, client: TestClient, mock_storage_service):
        """Test creating text file with empty filename"""
        mock_storage_service.upload.return_value = "http://example.com/files/text/2026/03/17/.txt"

        response = client.post("/api/v1/text/create", json={
            "fileName": ""
        })

        assert response.status_code == 200

    def test_create_text_unicode_filename(self, client: TestClient, mock_storage_service):
        """Test creating text file with unicode filename"""
        mock_storage_service.upload.return_value = "http://example.com/files/text/2026/03/17/test.txt"

        response = client.post("/api/v1/text/create", json={
            "fileName": "\u4e2d\u6587\u6587\u4ef6.txt"
        })

        assert response.status_code == 200
        assert response.json()["success"] is True

    def test_create_text_with_path_in_filename(self, client: TestClient, mock_storage_service):
        """Test creating text file with path in filename"""
        mock_storage_service.upload.return_value = "http://example.com/files/text/2026/03/17/test.txt"

        response = client.post("/api/v1/text/create", json={
            "fileName": "path/to/file.txt"
        })

        assert response.status_code == 200

    def test_create_text_special_chars(self, client: TestClient, mock_storage_service):
        """Test creating text file with special characters in filename"""
        mock_storage_service.upload.return_value = "http://example.com/files/text/2026/03/17/test.txt"

        response = client.post("/api/v1/text/create", json={
            "fileName": "file with spaces & symbols-v1.2.txt"
        })

        assert response.status_code == 200


class TestTextRouterResponseStructure:
    """Tests for response structure consistency"""

    def test_response_structure(self, client: TestClient, mock_storage_service):
        """Test that response has all required fields"""
        mock_storage_service.upload.return_value = "http://example.com/files/text/test.txt"

        response = client.post("/api/v1/text/create", json={
            "fileName": "test.txt"
        })

        assert response.status_code == 200
        data = response.json()

        # Check all expected fields
        assert "success" in data
        assert "message" in data
        assert "s3_key" in data
        assert "content_type" in data
        assert "file_size" in data

        # Check types
        assert isinstance(data["success"], bool)
        assert isinstance(data["message"], str)
        assert isinstance(data["s3_key"], (str, type(None)))
        assert isinstance(data["content_type"], (str, type(None)))
        assert isinstance(data["file_size"], (int, type(None)))

    def test_success_response_values(self, client: TestClient, mock_storage_service):
        """Test success response values"""
        mock_storage_service.upload.return_value = "http://example.com/files/text/test.txt"

        response = client.post("/api/v1/text/create", json={
            "fileName": "test.txt"
        })

        data = response.json()
        assert data["success"] is True
        assert data["content_type"] == "text/plain"
        assert data["file_size"] == 0

    def test_error_response_values(self, client: TestClient, mock_storage_service):
        """Test error response values"""
        mock_storage_service.upload.side_effect = Exception("Storage error")

        response = client.post("/api/v1/text/create", json={
            "fileName": "test.txt"
        })

        data = response.json()
        assert data["success"] is False
        assert "storage error" in data["message"].lower()


class TestTextRouterContentType:
    """Tests for content type handling"""

    def test_content_type_is_text_plain(self, client: TestClient, mock_storage_service):
        """Test that content type is text/plain"""
        mock_storage_service.upload.return_value = "http://example.com/files/text/test.txt"

        response = client.post("/api/v1/text/create", json={
            "fileName": "test.txt"
        })

        data = response.json()
        assert data["content_type"] == "text/plain"

        # Verify storage was called with correct content type
        call_kwargs = mock_storage_service.upload.call_args[1]
        assert call_kwargs["content_type"] == "text/plain"
