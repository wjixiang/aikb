"""
Docling Router API Tests

Tests for the Docling API which provides file conversion and text extraction.
"""

import pytest
from fastapi.testclient import TestClient

from services.docling_service import ConversionStatus


class TestDoclingConvert:
    """Tests for file conversion endpoint"""

    def test_convert_file_success(self, client: TestClient, mock_docling_service):
        """Test converting a file successfully"""
        response = client.post("/api/v1/docling/convert", json={
            "s3_key": "documents/test.pdf",
            "file_type": "pdf",
            "force_refresh": False
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["s3_key"] == "documents/test.pdf"
        assert data["status"] == ConversionStatus.SUCCESS
        mock_docling_service.convert_file.assert_called_once()

    def test_convert_file_with_force_refresh(self, client: TestClient, mock_docling_service):
        """Test converting a file with force refresh"""
        response = client.post("/api/v1/docling/convert", json={
            "s3_key": "documents/test.pdf",
            "file_type": "pdf",
            "force_refresh": True
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        call_kwargs = mock_docling_service.convert_file.call_args[1]
        assert call_kwargs["force_refresh"] is True

    def test_convert_file_failed(self, client: TestClient, mock_docling_service_failed):
        """Test converting a file that fails"""
        response = client.post("/api/v1/docling/convert", json={
            "s3_key": "documents/corrupt.pdf",
            "file_type": "pdf",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert data["status"] == ConversionStatus.FAILED
        assert "error_message" in data

    def test_convert_file_auto_detect_type(self, client: TestClient, mock_docling_service):
        """Test converting a file with auto-detected type"""
        response = client.post("/api/v1/docling/convert", json={
            "s3_key": "documents/test.docx",
        })

        assert response.status_code == 200
        call_kwargs = mock_docling_service.convert_file.call_args[1]
        assert call_kwargs.get("file_type") is None

    def test_convert_missing_s3_key(self, client: TestClient):
        """Test converting without s3_key"""
        response = client.post("/api/v1/docling/convert", json={
            "file_type": "pdf",
        })

        assert response.status_code == 422


class TestDoclingTextContent:
    """Tests for text content endpoint"""

    def test_get_text_content_success(self, client: TestClient, mock_docling_service):
        """Test getting text content successfully"""
        response = client.post("/api/v1/docling/text", json={
            "s3_key": "documents/test.pdf",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["s3_key"] == "documents/test.pdf"
        assert data["content"] == "Full document text content"
        assert data["total_pages"] == 5

    def test_get_text_content_not_found(self, client: TestClient, mock_docling_service_not_found):
        """Test getting text content for non-existent file"""
        response = client.post("/api/v1/docling/text", json={
            "s3_key": "documents/missing.pdf",
        })

        assert response.status_code == 400
        assert "not found" in response.json()["detail"].lower()

    def test_get_text_content_conversion_failed(self, client: TestClient, mock_docling_service_failed):
        """Test getting text content when conversion fails"""
        response = client.post("/api/v1/docling/text", json={
            "s3_key": "documents/corrupt.pdf",
        })

        assert response.status_code == 400

    def test_get_text_content_missing_s3_key(self, client: TestClient):
        """Test getting text content without s3_key"""
        response = client.post("/api/v1/docling/text", json={})

        assert response.status_code == 422


class TestDoclingPageContent:
    """Tests for page content endpoint"""

    def test_get_page_content_success(self, client: TestClient, mock_docling_service):
        """Test getting page content successfully"""
        response = client.post("/api/v1/docling/page", json={
            "s3_key": "documents/test.pdf",
            "page_number": 1
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["s3_key"] == "documents/test.pdf"
        assert data["page_number"] == 1
        assert data["content"] == "Page content"
        assert data["total_pages"] == 5

    def test_get_page_content_specific_page(self, client: TestClient, mock_docling_service):
        """Test getting specific page content"""
        mock_docling_service.get_page_content.return_value = "Page 3 specific content"

        response = client.post("/api/v1/docling/page", json={
            "s3_key": "documents/test.pdf",
            "page_number": 3
        })

        assert response.status_code == 200
        data = response.json()
        assert data["page_number"] == 3
        assert data["content"] == "Page 3 specific content"
        mock_docling_service.get_page_content.assert_called_with("documents/test.pdf", 3)

    def test_get_page_content_not_found(self, client: TestClient, mock_docling_service_not_found):
        """Test getting page content for non-existent file"""
        response = client.post("/api/v1/docling/page", json={
            "s3_key": "documents/missing.pdf",
            "page_number": 1
        })

        assert response.status_code == 400

    def test_get_page_content_invalid_page_number(self, client: TestClient, mock_docling_service):
        """Test getting page content with invalid page number"""
        mock_docling_service.get_page_content.side_effect = ValueError("Invalid page number")

        response = client.post("/api/v1/docling/page", json={
            "s3_key": "documents/test.pdf",
            "page_number": 999
        })

        assert response.status_code == 400

    def test_get_page_content_zero_page_number(self, client: TestClient):
        """Test getting page content with page_number=0 (should fail validation)"""
        response = client.post("/api/v1/docling/page", json={
            "s3_key": "documents/test.pdf",
            "page_number": 0
        })

        assert response.status_code == 422

    def test_get_page_content_negative_page_number(self, client: TestClient):
        """Test getting page content with negative page number"""
        response = client.post("/api/v1/docling/page", json={
            "s3_key": "documents/test.pdf",
            "page_number": -1
        })

        assert response.status_code == 422

    def test_get_page_content_missing_page_number(self, client: TestClient):
        """Test getting page content without page_number"""
        response = client.post("/api/v1/docling/page", json={
            "s3_key": "documents/test.pdf",
        })

        assert response.status_code == 422


class TestDoclingStatus:
    """Tests for conversion status endpoint"""

    def test_get_status_success(self, client: TestClient, mock_docling_service):
        """Test getting conversion status successfully"""
        response = client.post("/api/v1/docling/status", json={
            "s3_key": "documents/test.pdf",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["s3_key"] == "documents/test.pdf"
        assert data["status"] == ConversionStatus.SUCCESS
        assert data["is_converted"] is True

    def test_get_status_pending(self, client: TestClient, mock_docling_service):
        """Test getting pending conversion status"""
        mock_docling_service.get_conversion_status.return_value = ConversionStatus.PENDING

        response = client.post("/api/v1/docling/status", json={
            "s3_key": "documents/unconverted.pdf",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == ConversionStatus.PENDING
        assert data["is_converted"] is False

    def test_get_status_not_found(self, client: TestClient, mock_docling_service):
        """Test getting status for non-existent file"""
        mock_docling_service.get_conversion_status.return_value = ConversionStatus.NOT_FOUND

        response = client.post("/api/v1/docling/status", json={
            "s3_key": "documents/missing.pdf",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == ConversionStatus.NOT_FOUND
        assert data["is_converted"] is False

    def test_get_status_missing_s3_key(self, client: TestClient):
        """Test getting status without s3_key"""
        response = client.post("/api/v1/docling/status", json={})

        assert response.status_code == 422


class TestDoclingAllPages:
    """Tests for all pages endpoint"""

    def test_get_all_pages_success(self, client: TestClient, mock_docling_service):
        """Test getting all pages successfully"""
        response = client.post("/api/v1/docling/pages", json={
            "s3_key": "documents/test.pdf",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["s3_key"] == "documents/test.pdf"
        assert data["total_pages"] == 2
        assert "pages" in data
        assert isinstance(data["pages"], dict)

    def test_get_all_pages_not_found(self, client: TestClient, mock_docling_service_not_found):
        """Test getting all pages for non-existent file"""
        response = client.post("/api/v1/docling/pages", json={
            "s3_key": "documents/missing.pdf",
        })

        assert response.status_code == 400

    def test_get_all_pages_conversion_failed(self, client: TestClient, mock_docling_service_failed):
        """Test getting all pages when conversion fails"""
        response = client.post("/api/v1/docling/pages", json={
            "s3_key": "documents/corrupt.pdf",
        })

        assert response.status_code == 400

    def test_get_all_pages_missing_s3_key(self, client: TestClient):
        """Test getting all pages without s3_key"""
        response = client.post("/api/v1/docling/pages", json={})

        assert response.status_code == 422


class TestDoclingInvalidateCache:
    """Tests for cache invalidation endpoint"""

    def test_invalidate_cache_success(self, client: TestClient, mock_docling_service):
        """Test invalidating cache successfully"""
        mock_docling_service.invalidate_cache.return_value = True

        response = client.post("/api/v1/docling/invalidate", json={
            "s3_key": "documents/test.pdf",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["s3_key"] == "documents/test.pdf"
        assert "invalidated" in data["message"].lower()

    def test_invalidate_cache_not_found(self, client: TestClient, mock_docling_service):
        """Test invalidating cache for file without cache"""
        mock_docling_service.invalidate_cache.return_value = False

        response = client.post("/api/v1/docling/invalidate", json={
            "s3_key": "documents/uncached.pdf",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "no cache found" in data["message"].lower()

    def test_invalidate_cache_missing_s3_key(self, client: TestClient):
        """Test invalidating cache without s3_key"""
        response = client.post("/api/v1/docling/invalidate", json={})

        assert response.status_code == 422


class TestDoclingSupportedFormats:
    """Tests for supported formats endpoint"""

    def test_get_supported_formats(self, client: TestClient, mock_docling_service):
        """Test getting supported formats"""
        response = client.get("/api/v1/docling/formats")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "formats" in data
        formats = data["formats"]
        assert "pdf" in formats
        assert "microsoft_office" in formats
        assert "text" in formats

    def test_get_supported_formats_structure(self, client: TestClient, mock_docling_service):
        """Test that supported formats has correct structure"""
        mock_docling_service.get_supported_formats.return_value = {
            "pdf": [".pdf"],
            "microsoft_office": [".docx", ".pptx", ".xlsx"],
            "text": [".txt", ".md", ".csv"],
            "image": [".png", ".jpg"],
            "other": [".json"],
        }

        response = client.get("/api/v1/docling/formats")

        assert response.status_code == 200
        data = response.json()
        formats = data["formats"]
        assert isinstance(formats["pdf"], list)
        assert ".pdf" in formats["pdf"]
        assert ".docx" in formats["microsoft_office"]


class TestDoclingEdgeCases:
    """Edge case tests for docling router"""

    def test_unicode_s3_key(self, client: TestClient, mock_docling_service):
        """Test with unicode characters in s3_key"""
        response = client.post("/api/v1/docling/convert", json={
            "s3_key": "documents/\u4e2d\u6587\u6587\u4ef6.pdf",
        })

        assert response.status_code == 200
        call_args = mock_docling_service.convert_file.call_args[1]
        assert call_args["s3_key"] == "documents/\u4e2d\u6587\u6587\u4ef6.pdf"

    def test_special_chars_in_s3_key(self, client: TestClient, mock_docling_service):
        """Test with special characters in s3_key"""
        response = client.post("/api/v1/docling/convert", json={
            "s3_key": "documents/file with spaces & symbols-v1.2.pdf",
        })

        assert response.status_code == 200

    def test_deeply_nested_path(self, client: TestClient, mock_docling_service):
        """Test with deeply nested path"""
        response = client.post("/api/v1/docling/convert", json={
            "s3_key": "a/b/c/d/e/f/g/deep-file.pdf",
        })

        assert response.status_code == 200

    def test_very_long_s3_key(self, client: TestClient, mock_docling_service):
        """Test with very long s3_key"""
        long_key = "documents/" + "a" * 200 + ".pdf"

        response = client.post("/api/v1/docling/convert", json={
            "s3_key": long_key,
        })

        assert response.status_code == 200

    def test_different_file_types(self, client: TestClient, mock_docling_service):
        """Test with different file types"""
        file_types = ["pdf", "docx", "pptx", "xlsx", "csv", "html", "md", "txt"]

        for file_type in file_types:
            mock_docling_service.reset_mock()
            response = client.post("/api/v1/docling/convert", json={
                "s3_key": f"documents/test.{file_type}",
                "file_type": file_type,
            })

            assert response.status_code == 200, f"Failed for type: {file_type}"

    def test_internal_server_error(self, client: TestClient, mock_docling_service):
        """Test handling of internal server error"""
        mock_docling_service.get_text_content.side_effect = Exception("Unexpected error")

        response = client.post("/api/v1/docling/text", json={
            "s3_key": "documents/test.pdf",
        })

        assert response.status_code == 500
