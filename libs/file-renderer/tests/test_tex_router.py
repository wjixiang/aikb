"""
TeX Router API Tests

Tests for the TeX file creation router.
"""

import pytest
from fastapi.testclient import TestClient


class TestTexRouterCreate:
    """Tests for TeX file creation endpoint"""

    def test_create_tex_success(self, client: TestClient, mock_storage_service):
        """Test creating TeX file successfully"""
        mock_storage_service.upload.return_value = "http://example.com/files/tex/2026/03/17/test.tex"

        response = client.post("/api/v1/tex/create", json={
            "fileName": "test.tex"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["message"] == "File created successfully"
        assert data["content_type"] == "application/x-tex"
        assert data["file_size"] == 0
        assert "s3_key" in data
        mock_storage_service.upload.assert_called_once()

    def test_create_tex_with_custom_name(self, client: TestClient, mock_storage_service):
        """Test creating TeX file with custom name"""
        mock_storage_service.upload.return_value = "http://example.com/files/tex/2026/03/17/document.tex"

        response = client.post("/api/v1/tex/create", json={
            "fileName": "my-document.tex"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_create_tex_storage_error(self, client: TestClient, mock_storage_service):
        """Test creating TeX file when storage fails"""
        mock_storage_service.upload.side_effect = Exception("S3 connection error")

        response = client.post("/api/v1/tex/create", json={
            "fileName": "test.tex"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "failed" in data["message"].lower()

    def test_create_tex_missing_filename(self, client: TestClient):
        """Test creating TeX file without filename"""
        response = client.post("/api/v1/tex/create", json={
            "fileType": "tex"
        })

        assert response.status_code == 422

    def test_create_tex_various_extensions(self, client: TestClient, mock_storage_service):
        """Test creating TeX files with various extensions"""
        extensions = [".tex", ".latex"]

        for ext in extensions:
            mock_storage_service.reset_mock()
            mock_storage_service.upload.return_value = f"http://example.com/files/tex/test{ext}"

            response = client.post("/api/v1/tex/create", json={
                "fileName": f"test{ext}"
            })

            assert response.status_code == 200
            assert response.json()["success"] is True

    def test_create_tex_common_names(self, client: TestClient, mock_storage_service):
        """Test creating common TeX file names"""
        names = ["main.tex", "article.tex", "report.tex", "thesis.tex", "paper.tex"]

        for name in names:
            mock_storage_service.reset_mock()
            mock_storage_service.upload.return_value = f"http://example.com/files/tex/{name}"

            response = client.post("/api/v1/tex/create", json={
                "fileName": name
            })

            assert response.status_code == 200
            assert response.json()["success"] is True


class TestTexRouterResponseStructure:
    """Tests for response structure consistency"""

    def test_response_structure(self, client: TestClient, mock_storage_service):
        """Test that response has all required fields"""
        mock_storage_service.upload.return_value = "http://example.com/files/tex/test.tex"

        response = client.post("/api/v1/tex/create", json={
            "fileName": "test.tex"
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
        mock_storage_service.upload.return_value = "http://example.com/files/tex/test.tex"

        response = client.post("/api/v1/tex/create", json={
            "fileName": "test.tex"
        })

        data = response.json()
        assert data["success"] is True
        assert data["content_type"] == "application/x-tex"
        assert data["file_size"] == 0


class TestTexRouterContentType:
    """Tests for content type handling"""

    def test_content_type_is_tex(self, client: TestClient, mock_storage_service):
        """Test that content type is application/x-tex"""
        mock_storage_service.upload.return_value = "http://example.com/files/tex/test.tex"

        response = client.post("/api/v1/tex/create", json={
            "fileName": "test.tex"
        })

        data = response.json()
        assert data["content_type"] == "application/x-tex"

        call_kwargs = mock_storage_service.upload.call_args[1]
        assert call_kwargs["content_type"] == "application/x-tex"
