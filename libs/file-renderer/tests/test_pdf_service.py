"""
PDF Service Unit Tests
"""

import io
from unittest.mock import MagicMock

import pytest

from services.pdf_service import PdfService
from models.pdf_model import PdfReadResponse


class TestPdfServiceUnit:
    """PdfService unit tests"""

    def test_init(self):
        """Test PdfService initialization"""
        service = PdfService()
        assert service._converter is None

    def test_converter_property(self, pdf_service_instance, mocker):
        """Test converter property creates DocumentConverter"""
        mock_converter_class = mocker.patch("services.pdf_service.DocumentConverter")
        mock_converter = MagicMock()
        mock_converter_class.return_value = mock_converter

        converter = pdf_service_instance.converter

        assert converter is mock_converter
        mock_converter_class.assert_called_once()

    def test_read_pdf_from_cache(self, pdf_service_instance, mocker):
        """Test reading PDF from cache"""
        # Mock storage service
        mock_storage = mocker.patch("services.pdf_service.storage_service")
        mock_storage.get_file_size.return_value = 1024
        mock_storage.get_modified_time.return_value = 1234567890

        # Mock cache service
        mock_cache = mocker.patch("services.pdf_service.pdf_cache_service")
        mock_cache.get_doc.return_value = {
            "file_name": "test.pdf",
            "total_page": 5,
            "pages": {
                "1": "Page 1 content",
                "2": "Page 2 content",
                "3": "Page 3 content",
                "4": "Page 4 content",
                "5": "Page 5 content",
            }
        }

        result = pdf_service_instance.read_pdf("test/file.pdf", page=1)

        assert isinstance(result, PdfReadResponse)
        assert result.page == 1
        assert result.content == "Page 1 content"
        assert result.metadata.total_pages == 5
        assert result.metadata.file_name == "test.pdf"

        # Verify cache was checked but storage download was not called
        mock_cache.get_doc.assert_called_once()
        mock_storage.download.assert_not_called()

    def test_read_pdf_from_cache_page_3(self, pdf_service_instance, mocker):
        """Test reading page 3 from cache"""
        mock_storage = mocker.patch("services.pdf_service.storage_service")
        mock_storage.get_file_size.return_value = 1024
        mock_storage.get_modified_time.return_value = 1234567890

        mock_cache = mocker.patch("services.pdf_service.pdf_cache_service")
        mock_cache.get_doc.return_value = {
            "file_name": "test.pdf",
            "total_page": 5,
            "pages": {
                "1": "Page 1 content",
                "2": "Page 2 content",
                "3": "Page 3 content",
            }
        }

        result = pdf_service_instance.read_pdf("test/file.pdf", page=3)

        assert result.page == 3
        assert result.content == "Page 3 content"

    def test_read_pdf_cache_miss(self, pdf_service_instance, mocker):
        """Test reading PDF when cache miss (needs to parse)"""
        # Mock storage service
        mock_storage = mocker.patch("services.pdf_service.storage_service")
        mock_storage.get_file_size.return_value = 1024
        mock_storage.get_modified_time.return_value = 1234567890
        mock_storage.download.return_value = b"PDF binary content"

        # Mock cache service - cache miss
        mock_cache = mocker.patch("services.pdf_service.pdf_cache_service")
        mock_cache.get_doc.return_value = None

        # Mock DocumentConverter
        mock_converter_class = mocker.patch("services.pdf_service.DocumentConverter")
        mock_converter = MagicMock()
        mock_converter_class.return_value = mock_converter

        # Mock document
        mock_doc = MagicMock()
        mock_doc.num_pages.return_value = 3
        mock_doc.export_to_markdown.side_effect = lambda page_no: f"Page {page_no} markdown content"

        mock_result = MagicMock()
        mock_result.document = mock_doc
        mock_converter.convert.return_value = mock_result

        # Mock DocumentStream
        mocker.patch("services.pdf_service.DocumentStream")

        result = pdf_service_instance.read_pdf("test/file.pdf", page=1)

        assert isinstance(result, PdfReadResponse)
        assert result.page == 1
        assert result.content == "Page 1 markdown content"
        assert result.metadata.total_pages == 3

        # Verify cache was set
        mock_cache.set_doc.assert_called_once()

    def test_read_pdf_invalid_page_zero(self, pdf_service_instance, mocker):
        """Test reading PDF with invalid page number (0)"""
        mock_storage = mocker.patch("services.pdf_service.storage_service")
        mock_storage.get_file_size.return_value = 1024
        mock_storage.get_modified_time.return_value = 1234567890

        mock_cache = mocker.patch("services.pdf_service.pdf_cache_service")
        mock_cache.get_doc.return_value = {
            "file_name": "test.pdf",
            "total_page": 5,
            "pages": {"1": "Page 1", "2": "Page 2", "3": "Page 3", "4": "Page 4", "5": "Page 5"}
        }

        with pytest.raises(ValueError, match="Invalid page number: 0"):
            pdf_service_instance.read_pdf("test/file.pdf", page=0)

    def test_read_pdf_invalid_page_too_large(self, pdf_service_instance, mocker):
        """Test reading PDF with page number exceeding total pages"""
        mock_storage = mocker.patch("services.pdf_service.storage_service")
        mock_storage.get_file_size.return_value = 1024
        mock_storage.get_modified_time.return_value = 1234567890

        mock_cache = mocker.patch("services.pdf_service.pdf_cache_service")
        mock_cache.get_doc.return_value = {
            "file_name": "test.pdf",
            "total_page": 5,
            "pages": {"1": "Page 1", "2": "Page 2", "3": "Page 3", "4": "Page 4", "5": "Page 5"}
        }

        with pytest.raises(ValueError, match="Invalid page number: 10"):
            pdf_service_instance.read_pdf("test/file.pdf", page=10)

    def test_read_pdf_negative_page(self, pdf_service_instance, mocker):
        """Test reading PDF with negative page number"""
        mock_storage = mocker.patch("services.pdf_service.storage_service")
        mock_storage.get_file_size.return_value = 1024
        mock_storage.get_modified_time.return_value = 1234567890

        mock_cache = mocker.patch("services.pdf_service.pdf_cache_service")
        mock_cache.get_doc.return_value = {
            "file_name": "test.pdf",
            "total_page": 5,
            "pages": {"1": "Page 1", "2": "Page 2", "3": "Page 3", "4": "Page 4", "5": "Page 5"}
        }

        with pytest.raises(ValueError, match="Invalid page number: -1"):
            pdf_service_instance.read_pdf("test/file.pdf", page=-1)

    def test_read_pdf_file_name_extraction(self, pdf_service_instance, mocker):
        """Test file name extraction from s3_key"""
        mock_storage = mocker.patch("services.pdf_service.storage_service")
        mock_storage.get_file_size.return_value = 1024
        mock_storage.get_modified_time.return_value = 1234567890

        mock_cache = mocker.patch("services.pdf_service.pdf_cache_service")
        mock_cache.get_doc.return_value = {
            "file_name": "document.pdf",
            "total_page": 3,
            "pages": {"1": "Page 1", "2": "Page 2", "3": "Page 3"}
        }

        result = pdf_service_instance.read_pdf("path/to/my-document.pdf", page=1)

        assert result.metadata.file_name == "document.pdf"
        assert result.metadata.s3_key == "path/to/my-document.pdf"

    def test_read_pdf_simple_file_name(self, pdf_service_instance, mocker):
        """Test file name extraction with simple file name"""
        mock_storage = mocker.patch("services.pdf_service.storage_service")
        mock_storage.get_file_size.return_value = 1024
        mock_storage.get_modified_time.return_value = 1234567890

        mock_cache = mocker.patch("services.pdf_service.pdf_cache_service")
        mock_cache.get_doc.return_value = {
            "file_name": "test.pdf",
            "total_page": 3,
            "pages": {"1": "Page 1", "2": "Page 2", "3": "Page 3"}
        }

        result = pdf_service_instance.read_pdf("test.pdf", page=1)

        assert result.metadata.file_name == "test.pdf"


class TestPdfServiceCacheMiss:
    """PdfService cache miss scenarios"""

    def test_read_pdf_parse_and_cache(self, pdf_service_instance, mocker):
        """Test parsing PDF and caching results"""
        # Mock storage
        mock_storage = mocker.patch("services.pdf_service.storage_service")
        mock_storage.get_file_size.return_value = 1024
        mock_storage.get_modified_time.return_value = 1234567890
        mock_storage.download.return_value = b"PDF content"

        # Mock cache - miss
        mock_cache = mocker.patch("services.pdf_service.pdf_cache_service")
        mock_cache.get_doc.return_value = None

        # Mock converter
        mock_converter_class = mocker.patch("services.pdf_service.DocumentConverter")
        mock_converter = MagicMock()
        mock_converter_class.return_value = mock_converter

        # Mock document with 3 pages
        mock_doc = MagicMock()
        mock_doc.num_pages.return_value = 3
        mock_doc.export_to_markdown.side_effect = [
            "Page 1 content",
            "Page 2 content",
            "Page 3 content",
        ]

        mock_result = MagicMock()
        mock_result.document = mock_doc
        mock_converter.convert.return_value = mock_result

        # Mock DocumentStream
        mocker.patch("services.pdf_service.DocumentStream")

        result = pdf_service_instance.read_pdf("test/file.pdf", page=2)

        assert result.page == 2
        assert result.content == "Page 2 content"

        # Verify all pages were extracted and cached
        assert mock_doc.export_to_markdown.call_count == 3
        mock_cache.set_doc.assert_called_once()

        # Verify cache parameters
        call_args = mock_cache.set_doc.call_args
        assert call_args.kwargs["s3_key"] == "test/file.pdf"
        assert call_args.kwargs["file_name"] == "file.pdf"
        assert call_args.kwargs["total_page"] == 3
        assert "pages" in call_args.kwargs
        assert call_args.kwargs["pages"]["1"] == "Page 1 content"
        assert call_args.kwargs["pages"]["2"] == "Page 2 content"
        assert call_args.kwargs["pages"]["3"] == "Page 3 content"


class TestPdfServiceEdgeCases:
    """PdfService edge case tests"""

    def test_read_pdf_single_page(self, pdf_service_instance, mocker):
        """Test reading single page PDF"""
        mock_storage = mocker.patch("services.pdf_service.storage_service")
        mock_storage.get_file_size.return_value = 1024
        mock_storage.get_modified_time.return_value = 1234567890

        mock_cache = mocker.patch("services.pdf_service.pdf_cache_service")
        mock_cache.get_doc.return_value = {
            "file_name": "single.pdf",
            "total_page": 1,
            "pages": {"1": "Only page content"}
        }

        result = pdf_service_instance.read_pdf("test/single.pdf", page=1)

        assert result.metadata.total_pages == 1
        assert result.content == "Only page content"

    def test_read_pdf_default_page(self, pdf_service_instance, mocker):
        """Test reading PDF with default page (1)"""
        mock_storage = mocker.patch("services.pdf_service.storage_service")
        mock_storage.get_file_size.return_value = 1024
        mock_storage.get_modified_time.return_value = 1234567890

        mock_cache = mocker.patch("services.pdf_service.pdf_cache_service")
        mock_cache.get_doc.return_value = {
            "file_name": "test.pdf",
            "total_page": 5,
            "pages": {"1": "First page", "2": "Second page"}
        }

        result = pdf_service_instance.read_pdf("test/file.pdf")  # Default page=1

        assert result.page == 1
        assert result.content == "First page"
