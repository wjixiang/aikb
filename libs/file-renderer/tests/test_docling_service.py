"""
Docling Service Tests

Tests for the DoclingService which handles file conversion and text extraction.
"""

import io
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest

from services.docling_service import (
    ConversionResultData,
    ConversionStatus,
    DoclingService,
)


class TestDoclingServiceInit:
    """Tests for DoclingService initialization"""

    def test_init(self):
        """Test service initialization"""
        service = DoclingService()
        assert service._converter is None

    def test_converter_lazy_load(self, mocker):
        """Test converter is lazily loaded"""
        mock_converter_class = mocker.patch("services.docling_service.DocumentConverter")

        service = DoclingService()
        # Access converter property
        converter = service.converter

        assert converter is not None
        mock_converter_class.assert_called_once()
        assert service._converter is not None


class TestDoclingServiceSupportedFormats:
    """Tests for supported formats"""

    def test_get_supported_formats(self, docling_service_instance):
        """Test getting supported formats"""
        formats = docling_service_instance.get_supported_formats()

        assert "pdf" in formats
        assert "microsoft_office" in formats
        assert "text" in formats
        assert "image" in formats
        assert "other" in formats

        # Check specific extensions
        assert ".pdf" in formats["pdf"]
        assert ".docx" in formats["microsoft_office"]
        assert ".txt" in formats["text"]
        assert ".png" in formats["image"]

    def test_is_supported_true(self, docling_service_instance):
        """Test checking if supported file type"""
        assert docling_service_instance._is_supported("test.pdf") is True
        assert docling_service_instance._is_supported("test.docx") is True
        assert docling_service_instance._is_supported("test.txt") is True

    def test_is_supported_false(self, docling_service_instance):
        """Test checking if unsupported file type"""
        assert docling_service_instance._is_supported("test.unknown") is False
        assert docling_service_instance._is_supported("test.xyz") is False

    def test_get_file_type(self, docling_service_instance):
        """Test getting file type from extension"""
        assert docling_service_instance._get_file_type("test.pdf") == "pdf"
        assert docling_service_instance._get_file_type("test.docx") == "docx"
        assert docling_service_instance._get_file_type("test.txt") == "text"
        assert docling_service_instance._get_file_type("test.unknown") == "unknown"

    def test_get_file_extension(self, docling_service_instance):
        """Test getting file extension"""
        assert docling_service_instance._get_file_extension("test.pdf") == "pdf"
        assert docling_service_instance._get_file_extension("test.docx") == "docx"
        assert docling_service_instance._get_file_extension("path/to/file.txt") == "txt"
        assert docling_service_instance._get_file_extension("no_extension") == ""

    def test_get_file_name(self, docling_service_instance):
        """Test getting file name from s3_key"""
        assert docling_service_instance._get_file_name("test.pdf") == "test.pdf"
        assert docling_service_instance._get_file_name("path/to/file.txt") == "file.txt"


class TestDoclingServicePaginateText:
    """Tests for text pagination"""

    def test_paginate_text_empty(self, docling_service_instance):
        """Test paginating empty text"""
        pages = docling_service_instance._paginate_text("")

        assert pages == {"1": ""}

    def test_paginate_text_short(self, docling_service_instance):
        """Test paginating short text"""
        text = "Short text"
        pages = docling_service_instance._paginate_text(text, page_size=100)

        assert len(pages) == 1
        assert pages["1"] == "Short text"

    def test_paginate_text_multiple_pages(self, docling_service_instance):
        """Test paginating text into multiple pages"""
        text = "Page 1 content. " * 50 + "\n\n" + "Page 2 content. " * 50
        pages = docling_service_instance._paginate_text(text, page_size=100)

        assert len(pages) >= 2

    def test_paginate_text_respects_paragraph_boundary(self, docling_service_instance):
        """Test that pagination respects paragraph boundaries"""
        text = "Paragraph 1\n\nParagraph 2\n\nParagraph 3"
        pages = docling_service_instance._paginate_text(text, page_size=50)

        # Should try to break at paragraph boundaries
        assert len(pages) >= 1

    def test_paginate_text_custom_page_size(self, docling_service_instance):
        """Test paginating with custom page size"""
        text = "a" * 1000
        pages = docling_service_instance._paginate_text(text, page_size=100)

        assert len(pages) == 10


class TestDoclingServiceConvertFile:
    """Tests for file conversion"""

    def test_convert_unsupported_file(self, docling_service_instance):
        """Test converting unsupported file type"""
        result = docling_service_instance.convert_file("test.unknown")

        assert result.status == ConversionStatus.FAILED
        assert "unsupported" in result.error_message.lower()

    def test_convert_file_size_exceeds_limit(self, docling_service_instance, mocker):
        """Test converting file that exceeds size limit"""
        mock_storage = mocker.patch("services.docling_service.storage_service")
        mock_storage.get_file_size.return_value = 200 * 1024 * 1024  # 200MB

        mock_settings = mocker.patch("services.docling_service.settings")
        mock_settings.conversion.max_file_size = 100 * 1024 * 1024  # 100MB

        result = docling_service_instance.convert_file("test.pdf")

        assert result.status == ConversionStatus.FAILED
        assert "file size exceeds" in result.error_message.lower()

    def test_convert_file_not_found(self, docling_service_instance, mocker):
        """Test converting non-existent file"""
        mock_storage = mocker.patch("services.docling_service.storage_service")
        mock_storage.get_file_size.side_effect = Exception("File not found")

        result = docling_service_instance.convert_file("missing.pdf")

        assert result.status == ConversionStatus.FAILED

    def test_convert_file_from_cache(self, docling_service_instance, mocker):
        """Test converting file that is cached"""
        mock_storage = mocker.patch("services.docling_service.storage_service")
        mock_storage.get_file_size.return_value = 1024
        mock_storage.get_modified_time.return_value = 1234567890

        # Mock database cache hit
        mock_session = MagicMock()
        mock_db_result = MagicMock()
        mock_db_result.file_name = "test.pdf"
        mock_db_result.total_page = 3
        mock_db_result.pages = {"1": "Page 1", "2": "Page 2", "3": "Page 3"}
        mock_db_result.file_size = 1024
        mock_db_result.modified_time = 1234567890

        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = mock_db_result
        mock_session.query.return_value = mock_query

        mocker.patch("services.docling_service.SessionLocal", return_value=mock_session)

        result = docling_service_instance.convert_file("test.pdf")

        assert result.status == ConversionStatus.SUCCESS
        assert result.total_pages == 3


class TestDoclingServiceGetTextContent:
    """Tests for getting text content"""

    def test_get_text_content_success(self, docling_service_instance, mocker):
        """Test getting text content successfully"""
        mock_convert = mocker.patch.object(
            docling_service_instance,
            "convert_file",
            return_value=ConversionResultData(
                s3_key="test.pdf",
                file_name="test.pdf",
                file_size=1024,
                file_type="pdf",
                status=ConversionStatus.SUCCESS,
                total_pages=2,
                pages={"1": "Page 1", "2": "Page 2"},
                full_text="Page 1\n\nPage 2",
            )
        )

        content = docling_service_instance.get_text_content("test.pdf")

        assert content == "Page 1\n\nPage 2"
        mock_convert.assert_called_once_with("test.pdf")

    def test_get_text_content_failure(self, docling_service_instance, mocker):
        """Test getting text content when conversion fails"""
        mock_convert = mocker.patch.object(
            docling_service_instance,
            "convert_file",
            return_value=ConversionResultData(
                s3_key="test.pdf",
                file_name="test.pdf",
                file_size=0,
                file_type="pdf",
                status=ConversionStatus.FAILED,
                error_message="Conversion failed",
            )
        )

        with pytest.raises(ValueError, match="Failed to convert file"):
            docling_service_instance.get_text_content("test.pdf")


class TestDoclingServiceGetPageContent:
    """Tests for getting page content"""

    def test_get_page_content_success(self, docling_service_instance, mocker):
        """Test getting page content successfully"""
        mock_convert = mocker.patch.object(
            docling_service_instance,
            "convert_file",
            return_value=ConversionResultData(
                s3_key="test.pdf",
                file_name="test.pdf",
                file_size=1024,
                file_type="pdf",
                status=ConversionStatus.SUCCESS,
                total_pages=3,
                pages={"1": "Page 1 content", "2": "Page 2 content", "3": "Page 3 content"},
            )
        )

        content = docling_service_instance.get_page_content("test.pdf", 2)

        assert content == "Page 2 content"

    def test_get_page_content_invalid_page_number(self, docling_service_instance, mocker):
        """Test getting page content with invalid page number"""
        mock_convert = mocker.patch.object(
            docling_service_instance,
            "convert_file",
            return_value=ConversionResultData(
                s3_key="test.pdf",
                file_name="test.pdf",
                file_size=1024,
                file_type="pdf",
                status=ConversionStatus.SUCCESS,
                total_pages=3,
                pages={"1": "Page 1", "2": "Page 2", "3": "Page 3"},
            )
        )

        with pytest.raises(ValueError, match="Invalid page number"):
            docling_service_instance.get_page_content("test.pdf", 5)

    def test_get_page_content_zero_page_number(self, docling_service_instance, mocker):
        """Test getting page content with page number 0"""
        mock_convert = mocker.patch.object(
            docling_service_instance,
            "convert_file",
            return_value=ConversionResultData(
                s3_key="test.pdf",
                file_name="test.pdf",
                file_size=1024,
                file_type="pdf",
                status=ConversionStatus.SUCCESS,
                total_pages=3,
                pages={"1": "Page 1", "2": "Page 2", "3": "Page 3"},
            )
        )

        with pytest.raises(ValueError, match="Invalid page number"):
            docling_service_instance.get_page_content("test.pdf", 0)


class TestDoclingServiceGetConversionStatus:
    """Tests for getting conversion status"""

    def test_get_status_not_found(self, docling_service_instance, mocker):
        """Test getting status for non-existent file"""
        mock_storage = mocker.patch("services.docling_service.storage_service")
        mock_storage.exists.return_value = False

        status = docling_service_instance.get_conversion_status("missing.pdf")

        assert status == ConversionStatus.NOT_FOUND

    def test_get_status_pending(self, docling_service_instance, mocker):
        """Test getting pending status"""
        mock_storage = mocker.patch("services.docling_service.storage_service")
        mock_storage.exists.return_value = True
        mock_storage.get_file_size.return_value = 1024
        mock_storage.get_modified_time.return_value = 1234567890

        # Mock database cache miss
        mock_session = MagicMock()
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = None
        mock_session.query.return_value = mock_query

        mocker.patch("services.docling_service.SessionLocal", return_value=mock_session)

        status = docling_service_instance.get_conversion_status("test.pdf")

        assert status == ConversionStatus.PENDING

    def test_get_status_success(self, docling_service_instance, mocker):
        """Test getting success status"""
        mock_storage = mocker.patch("services.docling_service.storage_service")
        mock_storage.exists.return_value = True
        mock_storage.get_file_size.return_value = 1024
        mock_storage.get_modified_time.return_value = 1234567890

        # Mock database cache hit
        mock_session = MagicMock()
        mock_db_result = MagicMock()
        mock_db_result.file_size = 1024
        mock_db_result.modified_time = 1234567890

        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = mock_db_result
        mock_session.query.return_value = mock_query

        mocker.patch("services.docling_service.SessionLocal", return_value=mock_session)

        status = docling_service_instance.get_conversion_status("test.pdf")

        assert status == ConversionStatus.SUCCESS


class TestDoclingServiceGetAllPages:
    """Tests for getting all pages"""

    def test_get_all_pages_success(self, docling_service_instance, mocker):
        """Test getting all pages successfully"""
        mock_convert = mocker.patch.object(
            docling_service_instance,
            "convert_file",
            return_value=ConversionResultData(
                s3_key="test.pdf",
                file_name="test.pdf",
                file_size=1024,
                file_type="pdf",
                status=ConversionStatus.SUCCESS,
                total_pages=3,
                pages={"1": "Page 1", "2": "Page 2", "3": "Page 3"},
            )
        )

        pages = docling_service_instance.get_all_pages("test.pdf")

        assert len(pages) == 3
        assert pages["1"] == "Page 1"
        assert pages["2"] == "Page 2"
        assert pages["3"] == "Page 3"

    def test_get_all_pages_failure(self, docling_service_instance, mocker):
        """Test getting all pages when conversion fails"""
        mock_convert = mocker.patch.object(
            docling_service_instance,
            "convert_file",
            return_value=ConversionResultData(
                s3_key="test.pdf",
                file_name="test.pdf",
                file_size=0,
                file_type="pdf",
                status=ConversionStatus.FAILED,
                error_message="Conversion failed",
            )
        )

        with pytest.raises(ValueError, match="Failed to convert file"):
            docling_service_instance.get_all_pages("test.pdf")


class TestDoclingServiceInvalidateCache:
    """Tests for cache invalidation"""

    def test_invalidate_cache_exists(self, docling_service_instance, mocker):
        """Test invalidating existing cache"""
        mock_session = MagicMock()
        mock_db_result = MagicMock()

        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = mock_db_result
        mock_session.query.return_value = mock_query

        mocker.patch("services.docling_service.SessionLocal", return_value=mock_session)

        result = docling_service_instance.invalidate_cache("test.pdf")

        assert result is True
        mock_session.delete.assert_called_once_with(mock_db_result)
        mock_session.commit.assert_called_once()

    def test_invalidate_cache_not_exists(self, docling_service_instance, mocker):
        """Test invalidating non-existent cache"""
        mock_session = MagicMock()

        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = None
        mock_session.query.return_value = mock_query

        mocker.patch("services.docling_service.SessionLocal", return_value=mock_session)

        result = docling_service_instance.invalidate_cache("test.pdf")

        assert result is False


class TestDoclingServiceCacheOperations:
    """Tests for cache operations"""

    def test_get_from_cache_hit(self, docling_service_instance, mocker):
        """Test getting from cache when cache exists"""
        mock_session = MagicMock()
        mock_db_result = MagicMock()
        mock_db_result.file_name = "test.pdf"
        mock_db_result.total_page = 3
        mock_db_result.pages = {"1": "Page 1", "2": "Page 2"}
        mock_db_result.file_size = 1024
        mock_db_result.modified_time = 1234567890

        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = mock_db_result
        mock_session.query.return_value = mock_query

        mocker.patch("services.docling_service.SessionLocal", return_value=mock_session)

        result = docling_service_instance._get_from_cache("test.pdf", 1024, 1234567890)

        assert result is not None
        assert result["file_name"] == "test.pdf"
        assert result["total_page"] == 3

    def test_get_from_cache_miss(self, docling_service_instance, mocker):
        """Test getting from cache when cache doesn't exist"""
        mock_session = MagicMock()

        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = None
        mock_session.query.return_value = mock_query

        mocker.patch("services.docling_service.SessionLocal", return_value=mock_session)

        result = docling_service_instance._get_from_cache("test.pdf", 1024, 1234567890)

        assert result is None

    def test_get_from_cache_stale(self, docling_service_instance, mocker):
        """Test getting from cache when file has been modified"""
        mock_session = MagicMock()
        mock_db_result = MagicMock()
        mock_db_result.file_size = 1024  # Old size
        mock_db_result.modified_time = 1234567890  # Old timestamp

        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = mock_db_result
        mock_session.query.return_value = mock_query

        mocker.patch("services.docling_service.SessionLocal", return_value=mock_session)

        # File size changed
        result = docling_service_instance._get_from_cache("test.pdf", 2048, 1234567890)

        assert result is None
        mock_session.delete.assert_called_once_with(mock_db_result)
        mock_session.commit.assert_called_once()

    def test_save_to_cache_new(self, docling_service_instance, mocker):
        """Test saving new cache entry"""
        mock_session = MagicMock()

        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = None
        mock_session.query.return_value = mock_query

        mocker.patch("services.docling_service.SessionLocal", return_value=mock_session)

        docling_service_instance._save_to_cache(
            s3_key="test.pdf",
            file_name="test.pdf",
            file_size=1024,
            modified_time=1234567890,
            total_pages=3,
            pages={"1": "Page 1", "2": "Page 2"},
        )

        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()

    def test_save_to_cache_update(self, docling_service_instance, mocker):
        """Test updating existing cache entry"""
        mock_session = MagicMock()
        mock_db_result = MagicMock()

        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = mock_db_result
        mock_session.query.return_value = mock_query

        mocker.patch("services.docling_service.SessionLocal", return_value=mock_session)

        docling_service_instance._save_to_cache(
            s3_key="test.pdf",
            file_name="updated.pdf",
            file_size=2048,
            modified_time=1234567899,
            total_pages=5,
            pages={"1": "Page 1"},
        )

        assert mock_db_result.file_name == "updated.pdf"
        mock_session.commit.assert_called_once()


class TestDoclingServiceEdgeCases:
    """Edge case tests for DoclingService"""

    def test_convert_file_with_force_refresh(self, docling_service_instance, mocker):
        """Test converting file with force refresh"""
        mock_storage = mocker.patch("services.docling_service.storage_service")
        mock_storage.get_file_size.return_value = 1024
        mock_storage.get_modified_time.return_value = 1234567890
        mock_storage.download.return_value = b"PDF content"

        # Mock database cache
        mock_session = MagicMock()
        mock_db_result = MagicMock()

        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = mock_db_result
        mock_session.query.return_value = mock_query

        mocker.patch("services.docling_service.SessionLocal", return_value=mock_session)

        # Mock converter
        mock_converter = MagicMock()
        mock_result = MagicMock()
        mock_result.status = MagicMock()
        mock_result.status.value = "success"
        mock_doc = MagicMock()
        mock_doc.num_pages.return_value = 1
        mock_doc.export_to_markdown.return_value = "Content"
        mock_result.document = mock_doc
        mock_converter.convert.return_value = mock_result

        docling_service_instance._converter = mock_converter

        result = docling_service_instance.convert_file("test.pdf", force_refresh=True)

        # Should bypass cache and convert
        mock_converter.convert.assert_called_once()

    def test_convert_file_single_page(self, docling_service_instance, mocker):
        """Test converting single page document"""
        mock_storage = mocker.patch("services.docling_service.storage_service")
        mock_storage.get_file_size.return_value = 1024
        mock_storage.get_modified_time.return_value = 1234567890
        mock_storage.download.return_value = b"PDF content"

        mock_session = MagicMock()
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = None
        mock_session.query.return_value = mock_query

        mocker.patch("services.docling_service.SessionLocal", return_value=mock_session)

        mock_converter = MagicMock()
        mock_result = MagicMock()
        mock_result.status = MagicMock()
        mock_result.status.value = "success"
        mock_doc = MagicMock()
        mock_doc.num_pages.return_value = 1
        mock_doc.export_to_markdown.return_value = "Single page content"
        mock_result.document = mock_doc
        mock_converter.convert.return_value = mock_result

        docling_service_instance._converter = mock_converter

        result = docling_service_instance.convert_file("test.pdf")

        assert result.status == ConversionStatus.SUCCESS
        assert result.total_pages >= 1

    def test_convert_file_docling_failure(self, docling_service_instance, mocker):
        """Test handling docling conversion failure"""
        mock_storage = mocker.patch("services.docling_service.storage_service")
        mock_storage.get_file_size.return_value = 1024
        mock_storage.get_modified_time.return_value = 1234567890
        mock_storage.download.return_value = b"Corrupt PDF"

        mock_session = MagicMock()
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = None
        mock_session.query.return_value = mock_query

        mocker.patch("services.docling_service.SessionLocal", return_value=mock_session)

        mock_converter = MagicMock()
        mock_result = MagicMock()

        # Import the actual enum for comparison
        from docling.datamodel.base_models import ConversionStatus as DoclingConversionStatus
        mock_result.status = DoclingConversionStatus.FAILURE
        mock_converter.convert.return_value = mock_result

        docling_service_instance._converter = mock_converter

        result = docling_service_instance.convert_file("corrupt.pdf")

        assert result.status == ConversionStatus.FAILED
        assert "conversion failed" in result.error_message.lower()

    def test_unicode_s3_key(self, docling_service_instance):
        """Test handling unicode s3_key"""
        result = docling_service_instance._get_file_name("documents/\u4e2d\u6587.pdf")
        assert result == "\u4e2d\u6587.pdf"

    def test_special_chars_in_s3_key(self, docling_service_instance):
        """Test handling special characters in s3_key"""
        result = docling_service_instance._get_file_name("path/file with spaces & symbols.pdf")
        assert result == "file with spaces & symbols.pdf"
