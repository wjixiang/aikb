"""
PDF Cache Service Unit Tests
"""

from datetime import datetime
from unittest.mock import MagicMock

import pytest

from services.pdf_cache_service import PdfCacheService
from models.database import PdfParseResult


class TestPdfCacheServiceUnit:
    """PdfCacheService unit tests"""

    def test_init(self):
        """Test PdfCacheService initialization"""
        service = PdfCacheService()
        assert service._db is None

    def test_db_property(self, pdf_cache_service_instance, mocker):
        """Test db property creates session"""
        mock_session_local = mocker.patch("services.pdf_cache_service.SessionLocal")
        mock_session = MagicMock()
        mock_session_local.return_value = mock_session

        db = pdf_cache_service_instance.db

        assert db is mock_session
        mock_session_local.assert_called_once()

    def test_close(self, pdf_cache_service_instance, mocker):
        """Test closing database session"""
        mock_session_local = mocker.patch("services.pdf_cache_service.SessionLocal")
        mock_session = MagicMock()
        mock_session_local.return_value = mock_session

        # Access db first to create session
        _ = pdf_cache_service_instance.db
        pdf_cache_service_instance.close()

        mock_session.close.assert_called_once()
        assert pdf_cache_service_instance._db is None

    def test_get_doc_cache_hit(self, pdf_cache_service_instance, mocker):
        """Test getting document from cache (cache hit)"""
        mock_session = MagicMock()
        mocker.patch("services.pdf_cache_service.SessionLocal", return_value=mock_session)

        # Mock query result
        mock_result = MagicMock()
        mock_result.file_name = "test.pdf"
        mock_result.file_size = 1024
        mock_result.modified_time = 1234567890
        mock_result.total_page = 5
        mock_result.pages = {"1": "Page 1", "2": "Page 2"}

        mock_query = MagicMock()
        mock_session.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = mock_result

        result = pdf_cache_service_instance.get_doc("test/file.pdf", 1024, 1234567890)

        assert result is not None
        assert result["file_name"] == "test.pdf"
        assert result["total_page"] == 5
        assert result["pages"] == {"1": "Page 1", "2": "Page 2"}

    def test_get_doc_cache_miss(self, pdf_cache_service_instance, mocker):
        """Test getting document from cache (cache miss)"""
        mock_session = MagicMock()
        mocker.patch("services.pdf_cache_service.SessionLocal", return_value=mock_session)

        mock_query = MagicMock()
        mock_session.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = None

        result = pdf_cache_service_instance.get_doc("test/file.pdf", 1024, 1234567890)

        assert result is None

    def test_get_doc_stale_cache(self, pdf_cache_service_instance, mocker):
        """Test getting document with stale cache (file modified)"""
        mock_session = MagicMock()
        mocker.patch("services.pdf_cache_service.SessionLocal", return_value=mock_session)

        # Mock query result with different file_size (stale)
        mock_result = MagicMock()
        mock_result.file_size = 2048  # Different from requested
        mock_result.modified_time = 1234567890

        mock_query = MagicMock()
        mock_session.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = mock_result

        result = pdf_cache_service_instance.get_doc("test/file.pdf", 1024, 1234567890)

        assert result is None
        # Verify old cache was deleted
        mock_session.delete.assert_called_once_with(mock_result)
        mock_session.commit.assert_called()

    def test_get_doc_stale_cache_modified_time(self, pdf_cache_service_instance, mocker):
        """Test getting document with stale cache (different modified time)"""
        mock_session = MagicMock()
        mocker.patch("services.pdf_cache_service.SessionLocal", return_value=mock_session)

        mock_result = MagicMock()
        mock_result.file_size = 1024
        mock_result.modified_time = 9999999999  # Different from requested

        mock_query = MagicMock()
        mock_session.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = mock_result

        result = pdf_cache_service_instance.get_doc("test/file.pdf", 1024, 1234567890)

        assert result is None
        mock_session.delete.assert_called_once()

    def test_set_doc_create_new(self, pdf_cache_service_instance, mocker):
        """Test setting document cache (create new)"""
        mock_session = MagicMock()
        mocker.patch("services.pdf_cache_service.SessionLocal", return_value=mock_session)

        # No existing record
        mock_query = MagicMock()
        mock_session.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = None

        pdf_cache_service_instance.set_doc(
            s3_key="test/file.pdf",
            file_name="file.pdf",
            file_size=1024,
            modified_time=1234567890,
            total_page=5,
            pages={"1": "Page 1", "2": "Page 2"},
        )

        # Verify new record was added
        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()

        # Verify the added object
        call_args = mock_session.add.call_args
        added_obj = call_args[0][0]
        assert added_obj.s3_key == "test/file.pdf"
        assert added_obj.file_name == "file.pdf"
        assert added_obj.file_size == 1024
        assert added_obj.total_page == 5

    def test_set_doc_update_existing(self, pdf_cache_service_instance, mocker):
        """Test setting document cache (update existing)"""
        mock_session = MagicMock()
        mocker.patch("services.pdf_cache_service.SessionLocal", return_value=mock_session)

        # Existing record
        mock_existing = MagicMock()
        mock_query = MagicMock()
        mock_session.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = mock_existing

        pdf_cache_service_instance.set_doc(
            s3_key="test/file.pdf",
            file_name="updated.pdf",
            file_size=2048,
            modified_time=9999999999,
            total_page=10,
            pages={"1": "Updated Page 1"},
        )

        # Verify existing record was updated
        assert mock_existing.file_name == "updated.pdf"
        assert mock_existing.file_size == 2048
        assert mock_existing.modified_time == 9999999999
        assert mock_existing.total_page == 10
        assert mock_existing.pages == {"1": "Updated Page 1"}
        mock_session.commit.assert_called_once()

    def test_invalidate_existing(self, pdf_cache_service_instance, mocker):
        """Test invalidating existing cache"""
        mock_session = MagicMock()
        mocker.patch("services.pdf_cache_service.SessionLocal", return_value=mock_session)

        mock_result = MagicMock()
        mock_query = MagicMock()
        mock_session.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = mock_result

        pdf_cache_service_instance.invalidate("test/file.pdf")

        mock_session.delete.assert_called_once_with(mock_result)
        mock_session.commit.assert_called_once()

    def test_invalidate_nonexistent(self, pdf_cache_service_instance, mocker):
        """Test invalidating non-existent cache"""
        mock_session = MagicMock()
        mocker.patch("services.pdf_cache_service.SessionLocal", return_value=mock_session)

        mock_query = MagicMock()
        mock_session.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = None

        pdf_cache_service_instance.invalidate("test/file.pdf")

        # Should not attempt to delete
        mock_session.delete.assert_not_called()


class TestPdfCacheServiceEdgeCases:
    """PdfCacheService edge case tests"""

    def test_get_doc_empty_pages(self, pdf_cache_service_instance, mocker):
        """Test getting document with empty pages"""
        mock_session = MagicMock()
        mocker.patch("services.pdf_cache_service.SessionLocal", return_value=mock_session)

        mock_result = MagicMock()
        mock_result.file_name = "empty.pdf"
        mock_result.file_size = 0
        mock_result.modified_time = 1234567890
        mock_result.total_page = 0
        mock_result.pages = {}

        mock_query = MagicMock()
        mock_session.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = mock_result

        result = pdf_cache_service_instance.get_doc("test/empty.pdf", 0, 1234567890)

        assert result["pages"] == {}
        assert result["total_page"] == 0

    def test_set_doc_large_pages(self, pdf_cache_service_instance, mocker):
        """Test setting document with many pages"""
        mock_session = MagicMock()
        mocker.patch("services.pdf_cache_service.SessionLocal", return_value=mock_session)

        mock_query = MagicMock()
        mock_session.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = None

        pages = {str(i): f"Page {i} content" for i in range(1, 101)}

        pdf_cache_service_instance.set_doc(
            s3_key="test/large.pdf",
            file_name="large.pdf",
            file_size=1000000,
            modified_time=1234567890,
            total_page=100,
            pages=pages,
        )

        mock_session.add.assert_called_once()
        call_args = mock_session.add.call_args
        added_obj = call_args[0][0]
        assert added_obj.total_page == 100
        assert len(added_obj.pages) == 100
