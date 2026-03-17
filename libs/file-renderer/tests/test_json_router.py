"""
JSON Router API Tests

Tests for the JSON file creation router.
"""

import pytest
from fastapi.testclient import TestClient


class TestJsonRouterCreate:
    """Tests for JSON file creation endpoint"""

    def test_create_json_success(self, client: TestClient, mock_storage_service):
        """Test creating JSON file successfully"""
        mock_storage_service.upload.return_value = "http://example.com/files/json/2026/03/17/test.json"

        response = client.post("/api/v1/json/create", json={
            "fileName": "test.json"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["message"] == "File created successfully"
        assert data["content_type"] == "application/json"
        assert data["file_size"] == 0
        assert "s3_key" in data
        mock_storage_service.upload.assert_called_once()

    def test_create_json_with_custom_name(self, client: TestClient, mock_storage_service):
        """Test creating JSON file with custom name"""
        mock_storage_service.upload.return_value = "http://example.com/files/json/2026/03/17/config.json"

        response = client.post("/api/v1/json/create", json={
            "fileName": "my-config.json"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_create_json_storage_error(self, client: TestClient, mock_storage_service):
        """Test creating JSON file when storage fails"""
        mock_storage_service.upload.side_effect = Exception("S3 connection error")

        response = client.post("/api/v1/json/create", json={
            "fileName": "test.json"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "failed" in data["message"].lower()

    def test_create_json_missing_filename(self, client: TestClient):
        """Test creating JSON file without filename"""
        response = client.post("/api/v1/json/create", json={
            "fileType": "json"
        })

        assert response.status_code == 422

    def test_create_json_various_extensions(self, client: TestClient, mock_storage_service):
        """Test creating JSON files with various extensions"""
        extensions = [".json", ".jsonc", ".json5"]

        for ext in extensions:
            mock_storage_service.reset_mock()
            mock_storage_service.upload.return_value = f"http://example.com/files/json/test{ext}"

            response = client.post("/api/v1/json/create", json={
                "fileName": f"test{ext}"
            })

            assert response.status_code == 200
            assert response.json()["success"] is True

    def test_create_json_config_files(self, client: TestClient, mock_storage_service):
        """Test creating common config file names"""
        config_names = ["package.json", "tsconfig.json", ".eslintrc.json", "config.json"]

        for name in config_names:
            mock_storage_service.reset_mock()
            mock_storage_service.upload.return_value = f"http://example.com/files/json/{name}"

            response = client.post("/api/v1/json/create", json={
                "fileName": name
            })

            assert response.status_code == 200
            assert response.json()["success"] is True


class TestJsonRouterResponseStructure:
    """Tests for response structure consistency"""

    def test_response_structure(self, client: TestClient, mock_storage_service):
        """Test that response has all required fields"""
        mock_storage_service.upload.return_value = "http://example.com/files/json/test.json"

        response = client.post("/api/v1/json/create", json={
            "fileName": "test.json"
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
        mock_storage_service.upload.return_value = "http://example.com/files/json/test.json"

        response = client.post("/api/v1/json/create", json={
            "fileName": "test.json"
        })

        data = response.json()
        assert data["success"] is True
        assert data["content_type"] == "application/json"
        assert data["file_size"] == 0


class TestJsonRouterContentType:
    """Tests for content type handling"""

    def test_content_type_is_application_json(self, client: TestClient, mock_storage_service):
        """Test that content type is application/json"""
        mock_storage_service.upload.return_value = "http://example.com/files/json/test.json"

        response = client.post("/api/v1/json/create", json={
            "fileName": "test.json"
        })

        data = response.json()
        assert data["content_type"] == "application/json"

        call_kwargs = mock_storage_service.upload.call_args[1]
        assert call_kwargs["content_type"] == "application/json"
