"""
CSV Router API Tests

Tests for the CSV file creation router.
"""

import pytest
from fastapi.testclient import TestClient


class TestCsvRouterCreate:
    """Tests for CSV file creation endpoint"""

    def test_create_csv_success(self, client: TestClient, mock_storage_service):
        """Test creating CSV file successfully"""
        mock_storage_service.upload.return_value = "http://example.com/files/csv/2026/03/17/test.csv"

        response = client.post("/api/v1/csv/create", json={
            "fileName": "test.csv"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["message"] == "File created successfully"
        assert data["content_type"] == "text/csv"
        assert data["file_size"] == 0
        assert "s3_key" in data
        mock_storage_service.upload.assert_called_once()

    def test_create_csv_with_custom_name(self, client: TestClient, mock_storage_service):
        """Test creating CSV file with custom name"""
        mock_storage_service.upload.return_value = "http://example.com/files/csv/2026/03/17/data.csv"

        response = client.post("/api/v1/csv/create", json={
            "fileName": "my-data.csv"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_create_csv_storage_error(self, client: TestClient, mock_storage_service):
        """Test creating CSV file when storage fails"""
        mock_storage_service.upload.side_effect = Exception("S3 connection error")

        response = client.post("/api/v1/csv/create", json={
            "fileName": "test.csv"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "failed" in data["message"].lower()

    def test_create_csv_missing_filename(self, client: TestClient):
        """Test creating CSV file without filename"""
        response = client.post("/api/v1/csv/create", json={
            "fileType": "csv"
        })

        assert response.status_code == 422

    def test_create_csv_empty_filename(self, client: TestClient, mock_storage_service):
        """Test creating CSV file with empty filename"""
        mock_storage_service.upload.return_value = "http://example.com/files/csv/2026/03/17/.csv"

        response = client.post("/api/v1/csv/create", json={
            "fileName": ""
        })

        assert response.status_code == 200

    def test_create_csv_unicode_filename(self, client: TestClient, mock_storage_service):
        """Test creating CSV file with unicode filename"""
        mock_storage_service.upload.return_value = "http://example.com/files/csv/2026/03/17/test.csv"

        response = client.post("/api/v1/csv/create", json={
            "fileName": "\u6570\u636e.csv"
        })

        assert response.status_code == 200
        assert response.json()["success"] is True

    def test_create_csv_special_chars(self, client: TestClient, mock_storage_service):
        """Test creating CSV file with special characters in filename"""
        mock_storage_service.upload.return_value = "http://example.com/files/csv/2026/03/17/test.csv"

        response = client.post("/api/v1/csv/create", json={
            "fileName": "sales-data_2026-Q1.csv"
        })

        assert response.status_code == 200


class TestCsvRouterResponseStructure:
    """Tests for response structure consistency"""

    def test_response_structure(self, client: TestClient, mock_storage_service):
        """Test that response has all required fields"""
        mock_storage_service.upload.return_value = "http://example.com/files/csv/test.csv"

        response = client.post("/api/v1/csv/create", json={
            "fileName": "test.csv"
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
        mock_storage_service.upload.return_value = "http://example.com/files/csv/test.csv"

        response = client.post("/api/v1/csv/create", json={
            "fileName": "test.csv"
        })

        data = response.json()
        assert data["success"] is True
        assert data["content_type"] == "text/csv"
        assert data["file_size"] == 0


class TestCsvRouterContentType:
    """Tests for content type handling"""

    def test_content_type_is_text_csv(self, client: TestClient, mock_storage_service):
        """Test that content type is text/csv"""
        mock_storage_service.upload.return_value = "http://example.com/files/csv/test.csv"

        response = client.post("/api/v1/csv/create", json={
            "fileName": "test.csv"
        })

        data = response.json()
        assert data["content_type"] == "text/csv"

        call_kwargs = mock_storage_service.upload.call_args[1]
        assert call_kwargs["content_type"] == "text/csv"
