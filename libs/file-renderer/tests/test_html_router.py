"""
HTML Router API Tests

Tests for the HTML file creation router.
"""

import pytest
from fastapi.testclient import TestClient


class TestHtmlRouterCreate:
    """Tests for HTML file creation endpoint"""

    def test_create_html_success(self, client: TestClient, mock_storage_service):
        """Test creating HTML file successfully"""
        mock_storage_service.upload.return_value = "http://example.com/files/html/2026/03/17/test.html"

        response = client.post("/api/v1/html/create", json={
            "fileName": "test.html"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["message"] == "File created successfully"
        assert data["content_type"] == "text/html"
        assert data["file_size"] == 0
        assert "s3_key" in data
        mock_storage_service.upload.assert_called_once()

    def test_create_html_with_custom_name(self, client: TestClient, mock_storage_service):
        """Test creating HTML file with custom name"""
        mock_storage_service.upload.return_value = "http://example.com/files/html/2026/03/17/index.html"

        response = client.post("/api/v1/html/create", json={
            "fileName": "my-page.html"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_create_html_storage_error(self, client: TestClient, mock_storage_service):
        """Test creating HTML file when storage fails"""
        mock_storage_service.upload.side_effect = Exception("S3 connection error")

        response = client.post("/api/v1/html/create", json={
            "fileName": "test.html"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "failed" in data["message"].lower()

    def test_create_html_missing_filename(self, client: TestClient):
        """Test creating HTML file without filename"""
        response = client.post("/api/v1/html/create", json={
            "fileType": "html"
        })

        assert response.status_code == 422

    def test_create_html_various_extensions(self, client: TestClient, mock_storage_service):
        """Test creating HTML files with various extensions"""
        extensions = [".html", ".htm"]

        for ext in extensions:
            mock_storage_service.reset_mock()
            mock_storage_service.upload.return_value = f"http://example.com/files/html/test{ext}"

            response = client.post("/api/v1/html/create", json={
                "fileName": f"test{ext}"
            })

            assert response.status_code == 200
            assert response.json()["success"] is True

    def test_create_html_common_names(self, client: TestClient, mock_storage_service):
        """Test creating common HTML file names"""
        names = ["index.html", "about.html", "contact.htm", "home.html"]

        for name in names:
            mock_storage_service.reset_mock()
            mock_storage_service.upload.return_value = f"http://example.com/files/html/{name}"

            response = client.post("/api/v1/html/create", json={
                "fileName": name
            })

            assert response.status_code == 200
            assert response.json()["success"] is True


class TestHtmlRouterResponseStructure:
    """Tests for response structure consistency"""

    def test_response_structure(self, client: TestClient, mock_storage_service):
        """Test that response has all required fields"""
        mock_storage_service.upload.return_value = "http://example.com/files/html/test.html"

        response = client.post("/api/v1/html/create", json={
            "fileName": "test.html"
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
        mock_storage_service.upload.return_value = "http://example.com/files/html/test.html"

        response = client.post("/api/v1/html/create", json={
            "fileName": "test.html"
        })

        data = response.json()
        assert data["success"] is True
        assert data["content_type"] == "text/html"
        assert data["file_size"] == 0


class TestHtmlRouterContentType:
    """Tests for content type handling"""

    def test_content_type_is_text_html(self, client: TestClient, mock_storage_service):
        """Test that content type is text/html"""
        mock_storage_service.upload.return_value = "http://example.com/files/html/test.html"

        response = client.post("/api/v1/html/create", json={
            "fileName": "test.html"
        })

        data = response.json()
        assert data["content_type"] == "text/html"

        call_kwargs = mock_storage_service.upload.call_args[1]
        assert call_kwargs["content_type"] == "text/html"
