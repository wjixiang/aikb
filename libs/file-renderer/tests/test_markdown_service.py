"""
Markdown Service Unit Tests
"""

import pytest

from services.markdown_service import MarkdownService
from models.markdown_model import MarkdownReadByPageResponse


class TestMarkdownServiceUnit:
    """MarkdownService unit tests"""

    def test_init(self):
        """Test MarkdownService initialization"""
        service = MarkdownService()
        assert service is not None

    def test_read_by_page_first_page(self, markdown_service_instance, mocker):
        """Test reading first page"""
        # Mock storage_service.download
        mock_storage = mocker.patch("services.markdown_service.storage_service")
        content = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5"
        mock_storage.download.return_value = content.encode("utf-8")

        result = markdown_service_instance.read_by_page(
            s3_key="test/file.md",
            page=1,
            page_size=2,
        )

        assert isinstance(result, MarkdownReadByPageResponse)
        assert result.page == 1
        assert result.start_line == 0
        assert result.end_line == 2
        assert result.has_next is True
        assert result.has_previous is False
        assert result.metadata.total_lines == 5
        assert result.metadata.total_pages == 3

    def test_read_by_page_middle_page(self, markdown_service_instance, mocker):
        """Test reading middle page"""
        mock_storage = mocker.patch("services.markdown_service.storage_service")
        content = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5"
        mock_storage.download.return_value = content.encode("utf-8")

        result = markdown_service_instance.read_by_page(
            s3_key="test/file.md",
            page=2,
            page_size=2,
        )

        assert result.page == 2
        assert result.start_line == 2
        assert result.end_line == 4
        assert result.has_next is True
        assert result.has_previous is True

    def test_read_by_page_last_page(self, markdown_service_instance, mocker):
        """Test reading last page"""
        mock_storage = mocker.patch("services.markdown_service.storage_service")
        content = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5"
        mock_storage.download.return_value = content.encode("utf-8")

        result = markdown_service_instance.read_by_page(
            s3_key="test/file.md",
            page=3,
            page_size=2,
        )

        assert result.page == 3
        assert result.start_line == 4
        assert result.end_line == 5
        assert result.has_next is False
        assert result.has_previous is True

    def test_read_by_page_default_values(self, markdown_service_instance, mocker):
        """Test reading with default values"""
        mock_storage = mocker.patch("services.markdown_service.storage_service")
        lines = [f"Line {i}" for i in range(1500)]
        content = "\n".join(lines)
        mock_storage.download.return_value = content.encode("utf-8")

        result = markdown_service_instance.read_by_page(s3_key="test/file.md")

        assert result.page == 1
        assert result.metadata.total_lines == 1500
        # Default page_size is 1000, so 2 pages
        assert result.metadata.total_pages == 2

    def test_read_by_page_page_too_large(self, markdown_service_instance, mocker):
        """Test reading with page number larger than total pages"""
        mock_storage = mocker.patch("services.markdown_service.storage_service")
        content = "Line 1\nLine 2\nLine 3"
        mock_storage.download.return_value = content.encode("utf-8")

        result = markdown_service_instance.read_by_page(
            s3_key="test/file.md",
            page=100,  # Way larger than total pages
            page_size=2,
        )

        # Should clamp to last page
        assert result.page == 2
        assert result.has_next is False

    def test_read_by_page_page_zero(self, markdown_service_instance, mocker):
        """Test reading with page number 0 (invalid)"""
        mock_storage = mocker.patch("services.markdown_service.storage_service")
        content = "Line 1\nLine 2\nLine 3"
        mock_storage.download.return_value = content.encode("utf-8")

        result = markdown_service_instance.read_by_page(
            s3_key="test/file.md",
            page=0,  # Invalid
            page_size=2,
        )

        # Should clamp to page 1
        assert result.page == 1

    def test_read_by_page_negative_page(self, markdown_service_instance, mocker):
        """Test reading with negative page number"""
        mock_storage = mocker.patch("services.markdown_service.storage_service")
        content = "Line 1\nLine 2\nLine 3"
        mock_storage.download.return_value = content.encode("utf-8")

        result = markdown_service_instance.read_by_page(
            s3_key="test/file.md",
            page=-5,  # Invalid
            page_size=2,
        )

        # Should clamp to page 1
        assert result.page == 1

    def test_read_by_page_empty_file(self, markdown_service_instance, mocker):
        """Test reading empty file"""
        mock_storage = mocker.patch("services.markdown_service.storage_service")
        mock_storage.download.return_value = b""

        result = markdown_service_instance.read_by_page(
            s3_key="test/file.md",
            page=1,
            page_size=10,
        )

        assert result.metadata.total_lines == 1  # Empty string split gives ['']
        assert result.metadata.total_pages == 1
        assert result.has_next is False
        assert result.has_previous is False

    def test_read_by_page_single_line(self, markdown_service_instance, mocker):
        """Test reading single line file"""
        mock_storage = mocker.patch("services.markdown_service.storage_service")
        mock_storage.download.return_value = b"Single line content"

        result = markdown_service_instance.read_by_page(
            s3_key="test/file.md",
            page=1,
            page_size=10,
        )

        assert result.metadata.total_lines == 1
        assert result.metadata.total_pages == 1
        assert result.content == "Single line content"

    def test_read_by_page_file_name_extraction(self, markdown_service_instance, mocker):
        """Test file name extraction from s3_key"""
        mock_storage = mocker.patch("services.markdown_service.storage_service")
        mock_storage.download.return_value = b"Content"

        result = markdown_service_instance.read_by_page(
            s3_key="path/to/my-file.md",
            page=1,
            page_size=10,
        )

        assert result.metadata.file_name == "my-file.md"
        assert result.metadata.s3_key == "path/to/my-file.md"

    def test_read_by_page_simple_file_name(self, markdown_service_instance, mocker):
        """Test file name extraction with simple file name"""
        mock_storage = mocker.patch("services.markdown_service.storage_service")
        mock_storage.download.return_value = b"Content"

        result = markdown_service_instance.read_by_page(
            s3_key="file.md",
            page=1,
            page_size=10,
        )

        assert result.metadata.file_name == "file.md"


class TestMarkdownServiceEdgeCases:
    """MarkdownService edge case tests"""

    def test_read_by_page_unicode_content(self, markdown_service_instance, mocker):
        """Test reading file with unicode content"""
        mock_storage = mocker.patch("services.markdown_service.storage_service")
        content = "# 标题\n\n这是中文内容\n\n## 二级标题\n\n更多内容"
        mock_storage.download.return_value = content.encode("utf-8")

        result = markdown_service_instance.read_by_page(
            s3_key="test/file.md",
            page=1,
            page_size=10,
        )

        assert "标题" in result.content
        assert "中文内容" in result.content

    def test_read_by_page_large_page_size(self, markdown_service_instance, mocker):
        """Test reading with page size larger than content"""
        mock_storage = mocker.patch("services.markdown_service.storage_service")
        content = "Line 1\nLine 2"
        mock_storage.download.return_value = content.encode("utf-8")

        result = markdown_service_instance.read_by_page(
            s3_key="test/file.md",
            page=1,
            page_size=1000,
        )

        assert result.metadata.total_lines == 2
        assert result.metadata.total_pages == 1
        assert result.end_line == 2

    def test_read_by_page_content_with_empty_lines(self, markdown_service_instance, mocker):
        """Test reading content with empty lines"""
        mock_storage = mocker.patch("services.markdown_service.storage_service")
        content = "Line 1\n\nLine 3\n\n\nLine 6"
        mock_storage.download.return_value = content.encode("utf-8")

        result = markdown_service_instance.read_by_page(
            s3_key="test/file.md",
            page=1,
            page_size=10,
        )

        assert result.metadata.total_lines == 6
        # Empty lines should be preserved
        assert "\n\n" in result.content or result.content.count("\n") >= 5
