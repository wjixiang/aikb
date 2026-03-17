"""
PDF Router API Tests
"""

import pytest
from fastapi.testclient import TestClient

from models.pdf_model import PdfMetadata, PdfReadResponse
from models.create import FileCreateResponse


class TestPdfCreate:
    """PDF create endpoint tests"""

    def test_create_pdf_success(self, client, mock_storage_service):
        """Test creating PDF file"""
        mock_storage_service.upload.return_value = "http://example.com/files/pdf/2026/03/17/test.pdf"

        response = client.post("/pdf/create", json={
            "fileName": "test.pdf"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "s3_key" in data
        assert data["content_type"] == "application/pdf"
        assert data["file_size"] == 0

        # Verify storage upload was called
        mock_storage_service.upload.assert_called_once()

    def test_create_pdf_storage_error(self, client, mock_storage_service):
        """Test creating PDF file with storage error"""
        mock_storage_service.upload.side_effect = Exception("S3 error")

        response = client.post("/pdf/create", json={
            "fileName": "test.pdf"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "S3 error" in data["message"]


class TestPdfRead:
    """PDF read endpoint tests"""

    def test_read_pdf_success(self, client, mocker):
        """Test reading PDF file"""
        mock_service = mocker.patch("routers.pdf.pdf_service")
        mock_service.read_pdf.return_value = PdfReadResponse(
            metadata=PdfMetadata(
                s3_key="test/file.pdf",
                file_name="file.pdf",
                total_pages=10,
            ),
            page=1,
            content="Page 1 markdown content",
        )

        response = client.post("/pdf/read", json={
            "s3Key": "test/file.pdf",
            "page": 1,
        })

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert "metadata" in data
        assert data["metadata"]["total_pages"] == 10
        assert data["content"] == "Page 1 markdown content"

    def test_read_pdf_page_5(self, client, mocker):
        """Test reading PDF page 5"""
        mock_service = mocker.patch("routers.pdf.pdf_service")
        mock_service.read_pdf.return_value = PdfReadResponse(
            metadata=PdfMetadata(
                s3_key="test/file.pdf",
                file_name="file.pdf",
                total_pages=10,
            ),
            page=5,
            content="Page 5 markdown content",
        )

        response = client.post("/pdf/read", json={
            "s3Key": "test/file.pdf",
            "page": 5,
        })

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 5
        assert data["content"] == "Page 5 markdown content"

    def test_read_pdf_default_page(self, client, mocker):
        """Test reading PDF with default page (1)"""
        mock_service = mocker.patch("routers.pdf.pdf_service")
        mock_service.read_pdf.return_value = PdfReadResponse(
            metadata=PdfMetadata(
                s3_key="test/file.pdf",
                file_name="file.pdf",
                total_pages=5,
            ),
            page=1,
            content="Page 1 content",
        )

        response = client.post("/pdf/read", json={
            "s3Key": "test/file.pdf",
        })

        assert response.status_code == 200
        # Verify service was called with default page=1
        mock_service.read_pdf.assert_called_once_with("test/file.pdf", 1)

    def test_read_pdf_invalid_page(self, client, mocker):
        """Test reading PDF with invalid page number"""
        mock_service = mocker.patch("routers.pdf.pdf_service")
        mock_service.read_pdf.side_effect = ValueError("Invalid page number: 100. Total pages: 10")

        response = client.post("/pdf/read", json={
            "s3Key": "test/file.pdf",
            "page": 100,
        })

        assert response.status_code == 400
        assert "Invalid page number" in response.json()["detail"]

    def test_read_pdf_file_not_found(self, client, mocker):
        """Test reading non-existent PDF"""
        mock_service = mocker.patch("routers.pdf.pdf_service")
        mock_service.read_pdf.side_effect = Exception("File not found")

        response = client.post("/pdf/read", json={
            "s3Key": "test/nonexistent.pdf",
            "page": 1,
        })

        assert response.status_code == 500
        assert "Failed to read PDF" in response.json()["detail"]

    def test_read_pdf_parse_error(self, client, mocker):
        """Test reading corrupted PDF"""
        mock_service = mocker.patch("routers.pdf.pdf_service")
        mock_service.read_pdf.side_effect = Exception("Failed to parse PDF")

        response = client.post("/pdf/read", json={
            "s3Key": "test/corrupted.pdf",
            "page": 1,
        })

        assert response.status_code == 500


class TestPdfRouterEdgeCases:
    """PDF router edge case tests"""

    def test_create_pdf_empty_filename(self, client, mock_storage_service):
        """Test creating PDF with empty filename"""
        mock_storage_service.upload.return_value = "http://example.com/files/pdf/2026/03/17/.pdf"

        response = client.post("/pdf/create", json={
            "fileName": "",
        })

        # Should still create with empty filename
        assert response.status_code == 200

    def test_create_pdf_unicode_filename(self, client, mock_storage_service):
        """Test creating PDF with unicode filename"""
        mock_storage_service.upload.return_value = "http://example.com/files/pdf/2026/03/17/test.pdf"

        response = client.post("/pdf/create", json={
            "fileName": "\u4e2d\u6587\u6587\u4ef6.pdf",
        })

        assert response.status_code == 200

    def test_read_pdf_zero_page(self, client, mocker):
        """Test reading PDF with page 0"""
        mock_service = mocker.patch("routers.pdf.pdf_service")
        mock_service.read_pdf.side_effect = ValueError("Invalid page number: 0")

        response = client.post("/pdf/read", json={
            "s3Key": "test/file.pdf",
            "page": 0,
        })

        assert response.status_code == 400

    def test_read_pdf_negative_page(self, client, mocker):
        """Test reading PDF with negative page"""
        mock_service = mocker.patch("routers.pdf.pdf_service")
        mock_service.read_pdf.side_effect = ValueError("Invalid page number: -1")

        response = client.post("/pdf/read", json={
            "s3Key": "test/file.pdf",
            "page": -1,
        })

        assert response.status_code == 400

    def test_read_pdf_single_page_document(self, client, mocker):
        """Test reading single-page PDF"""
        mock_service = mocker.patch("routers.pdf.pdf_service")
        mock_service.read_pdf.return_value = PdfReadResponse(
            metadata=PdfMetadata(
                s3_key="test/single.pdf",
                file_name="single.pdf",
                total_pages=1,
            ),
            page=1,
            content="Single page content",
        )

        response = client.post("/pdf/read", json={
            "s3Key": "test/single.pdf",
            "page": 1,
        })

        assert response.status_code == 200
        data = response.json()
        assert data["metadata"]["total_pages"] == 1
