"""
Markdown Edit Service Unit Tests
"""

import pytest

from services.markdown_edit_service import MarkdownEditService
from models.markdown_model import MarkdownEditResponse, MarkdownPreviewResponse


class TestMarkdownEditServiceReplace:
    """MarkdownEditService replace operation tests"""

    def test_replace_success(self, markdown_edit_service_instance, mocker):
        """Test successful replace operation"""
        mock_storage = mocker.patch("services.markdown_edit_service.storage_service")
        original_content = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5"
        mock_storage.download.return_value = original_content.encode("utf-8")

        result = markdown_edit_service_instance.replace(
            s3_key="test/file.md",
            start_line=1,
            end_line=3,
            new_content="New Line 2\nNew Line 3",
        )

        assert isinstance(result, MarkdownEditResponse)
        assert result.success is True
        assert result.old_line_count == 5
        assert result.new_line_count == 4
        assert result.lines_changed == -1
        assert "replaced lines 1-3" in result.message

        # Verify upload was called
        mock_storage.upload.assert_called_once()
        call_args = mock_storage.upload.call_args
        assert call_args.kwargs["key"] == "test/file.md"
        assert call_args.kwargs["content_type"] == "text/markdown"

    def test_replace_at_start(self, markdown_edit_service_instance, mocker):
        """Test replace at start of file"""
        mock_storage = mocker.patch("services.markdown_edit_service.storage_service")
        original_content = "Line 1\nLine 2\nLine 3"
        mock_storage.download.return_value = original_content.encode("utf-8")

        result = markdown_edit_service_instance.replace(
            s3_key="test/file.md",
            start_line=0,
            end_line=1,
            new_content="New Line 1",
        )

        assert result.success is True
        assert result.new_line_count == 3

    def test_replace_at_end(self, markdown_edit_service_instance, mocker):
        """Test replace at end of file"""
        mock_storage = mocker.patch("services.markdown_edit_service.storage_service")
        original_content = "Line 1\nLine 2\nLine 3"
        mock_storage.download.return_value = original_content.encode("utf-8")

        result = markdown_edit_service_instance.replace(
            s3_key="test/file.md",
            start_line=2,
            end_line=3,
            new_content="New Line 3",
        )

        assert result.success is True
        assert result.new_line_count == 3

    def test_replace_invalid_start_line_negative(self, markdown_edit_service_instance, mocker):
        """Test replace with negative start_line"""
        mock_storage = mocker.patch("services.markdown_edit_service.storage_service")
        original_content = "Line 1\nLine 2\nLine 3"
        mock_storage.download.return_value = original_content.encode("utf-8")

        result = markdown_edit_service_instance.replace(
            s3_key="test/file.md",
            start_line=-1,
            end_line=1,
            new_content="New content",
        )

        assert result.success is False
        assert "Invalid start_line" in result.message

    def test_replace_invalid_start_line_too_large(self, markdown_edit_service_instance, mocker):
        """Test replace with start_line beyond file length"""
        mock_storage = mocker.patch("services.markdown_edit_service.storage_service")
        original_content = "Line 1\nLine 2\nLine 3"
        mock_storage.download.return_value = original_content.encode("utf-8")

        result = markdown_edit_service_instance.replace(
            s3_key="test/file.md",
            start_line=10,
            end_line=12,
            new_content="New content",
        )

        assert result.success is False
        assert "Invalid start_line" in result.message

    def test_replace_end_line_beyond_file(self, markdown_edit_service_instance, mocker):
        """Test replace with end_line beyond file length (should clamp)"""
        mock_storage = mocker.patch("services.markdown_edit_service.storage_service")
        original_content = "Line 1\nLine 2\nLine 3"
        mock_storage.download.return_value = original_content.encode("utf-8")

        result = markdown_edit_service_instance.replace(
            s3_key="test/file.md",
            start_line=1,
            end_line=100,
            new_content="New Line 2",
        )

        assert result.success is True
        assert result.new_line_count == 2


class TestMarkdownEditServiceInsert:
    """MarkdownEditService insert operation tests"""

    def test_insert_at_start(self, markdown_edit_service_instance, mocker):
        """Test insert at start of file"""
        mock_storage = mocker.patch("services.markdown_edit_service.storage_service")
        original_content = "Line 1\nLine 2"
        mock_storage.download.return_value = original_content.encode("utf-8")

        result = markdown_edit_service_instance.insert(
            s3_key="test/file.md",
            content="New Line 0",
            position="start",
        )

        assert result.success is True
        assert result.old_line_count == 2
        assert result.new_line_count == 3
        assert result.lines_changed == 1

    def test_insert_at_end(self, markdown_edit_service_instance, mocker):
        """Test insert at end of file (default)"""
        mock_storage = mocker.patch("services.markdown_edit_service.storage_service")
        original_content = "Line 1\nLine 2"
        mock_storage.download.return_value = original_content.encode("utf-8")

        result = markdown_edit_service_instance.insert(
            s3_key="test/file.md",
            content="New Line 3",
            position="end",
        )

        assert result.success is True
        assert result.new_line_count == 3

    def test_insert_before_line(self, markdown_edit_service_instance, mocker):
        """Test insert before specific line"""
        mock_storage = mocker.patch("services.markdown_edit_service.storage_service")
        original_content = "Line 1\nLine 2\nLine 3"
        mock_storage.download.return_value = original_content.encode("utf-8")

        result = markdown_edit_service_instance.insert(
            s3_key="test/file.md",
            content="New Line",
            position="before_line",
            target_line=1,
        )

        assert result.success is True
        assert result.new_line_count == 4

    def test_insert_after_line(self, markdown_edit_service_instance, mocker):
        """Test insert after specific line"""
        mock_storage = mocker.patch("services.markdown_edit_service.storage_service")
        original_content = "Line 1\nLine 2\nLine 3"
        mock_storage.download.return_value = original_content.encode("utf-8")

        result = markdown_edit_service_instance.insert(
            s3_key="test/file.md",
            content="New Line",
            position="after_line",
            target_line=1,
        )

        assert result.success is True
        assert result.new_line_count == 4

    def test_insert_invalid_target_line_before(self, markdown_edit_service_instance, mocker):
        """Test insert before_line with invalid target_line"""
        mock_storage = mocker.patch("services.markdown_edit_service.storage_service")
        original_content = "Line 1\nLine 2"
        mock_storage.download.return_value = original_content.encode("utf-8")

        result = markdown_edit_service_instance.insert(
            s3_key="test/file.md",
            content="New Line",
            position="before_line",
            target_line=10,  # Beyond file
        )

        assert result.success is False
        assert "Invalid target_line" in result.message

    def test_insert_invalid_target_line_after(self, markdown_edit_service_instance, mocker):
        """Test insert after_line with invalid target_line"""
        mock_storage = mocker.patch("services.markdown_edit_service.storage_service")
        original_content = "Line 1\nLine 2"
        mock_storage.download.return_value = original_content.encode("utf-8")

        result = markdown_edit_service_instance.insert(
            s3_key="test/file.md",
            content="New Line",
            position="after_line",
            target_line=10,  # Beyond file
        )

        assert result.success is False
        assert "Invalid target_line" in result.message

    def test_insert_invalid_position(self, markdown_edit_service_instance, mocker):
        """Test insert with invalid position"""
        mock_storage = mocker.patch("services.markdown_edit_service.storage_service")
        original_content = "Line 1\nLine 2"
        mock_storage.download.return_value = original_content.encode("utf-8")

        result = markdown_edit_service_instance.insert(
            s3_key="test/file.md",
            content="New Line",
            position="invalid_position",
        )

        assert result.success is False
        assert "Invalid position" in result.message

    def test_insert_multiple_lines(self, markdown_edit_service_instance, mocker):
        """Test inserting multiple lines"""
        mock_storage = mocker.patch("services.markdown_edit_service.storage_service")
        original_content = "Line 1\nLine 2"
        mock_storage.download.return_value = original_content.encode("utf-8")

        result = markdown_edit_service_instance.insert(
            s3_key="test/file.md",
            content="New Line A\nNew Line B\nNew Line C",
            position="end",
        )

        assert result.success is True
        assert result.lines_changed == 3
        assert result.new_line_count == 5


class TestMarkdownEditServiceDelete:
    """MarkdownEditService delete operation tests"""

    def test_delete_success(self, markdown_edit_service_instance, mocker):
        """Test successful delete operation"""
        mock_storage = mocker.patch("services.markdown_edit_service.storage_service")
        original_content = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5"
        mock_storage.download.return_value = original_content.encode("utf-8")

        result = markdown_edit_service_instance.delete(
            s3_key="test/file.md",
            start_line=1,
            end_line=3,
        )

        assert isinstance(result, MarkdownEditResponse)
        assert result.success is True
        assert result.old_line_count == 5
        assert result.new_line_count == 3
        assert result.lines_changed == -2
        assert "deleted lines 1-3" in result.message

    def test_delete_single_line(self, markdown_edit_service_instance, mocker):
        """Test deleting single line"""
        mock_storage = mocker.patch("services.markdown_edit_service.storage_service")
        original_content = "Line 1\nLine 2\nLine 3"
        mock_storage.download.return_value = original_content.encode("utf-8")

        result = markdown_edit_service_instance.delete(
            s3_key="test/file.md",
            start_line=1,
            end_line=2,
        )

        assert result.success is True
        assert result.new_line_count == 2
        assert result.lines_changed == -1

    def test_delete_all_lines(self, markdown_edit_service_instance, mocker):
        """Test deleting all lines"""
        mock_storage = mocker.patch("services.markdown_edit_service.storage_service")
        original_content = "Line 1\nLine 2\nLine 3"
        mock_storage.download.return_value = original_content.encode("utf-8")

        result = markdown_edit_service_instance.delete(
            s3_key="test/file.md",
            start_line=0,
            end_line=3,
        )

        assert result.success is True
        assert result.new_line_count == 0

    def test_delete_invalid_start_line_negative(self, markdown_edit_service_instance, mocker):
        """Test delete with negative start_line"""
        mock_storage = mocker.patch("services.markdown_edit_service.storage_service")
        original_content = "Line 1\nLine 2\nLine 3"
        mock_storage.download.return_value = original_content.encode("utf-8")

        result = markdown_edit_service_instance.delete(
            s3_key="test/file.md",
            start_line=-1,
            end_line=1,
        )

        assert result.success is False
        assert "Invalid start_line" in result.message

    def test_delete_invalid_start_line_too_large(self, markdown_edit_service_instance, mocker):
        """Test delete with start_line beyond file length"""
        mock_storage = mocker.patch("services.markdown_edit_service.storage_service")
        original_content = "Line 1\nLine 2\nLine 3"
        mock_storage.download.return_value = original_content.encode("utf-8")

        result = markdown_edit_service_instance.delete(
            s3_key="test/file.md",
            start_line=10,
            end_line=12,
        )

        assert result.success is False
        assert "Invalid start_line" in result.message

    def test_delete_end_line_beyond_file(self, markdown_edit_service_instance, mocker):
        """Test delete with end_line beyond file length (should clamp)"""
        mock_storage = mocker.patch("services.markdown_edit_service.storage_service")
        original_content = "Line 1\nLine 2\nLine 3"
        mock_storage.download.return_value = original_content.encode("utf-8")

        result = markdown_edit_service_instance.delete(
            s3_key="test/file.md",
            start_line=1,
            end_line=100,
        )

        assert result.success is True
        assert result.new_line_count == 1


class TestMarkdownEditServicePreviewReplace:
    """MarkdownEditService preview replace tests"""

    def test_preview_replace_success(self, markdown_edit_service_instance, mocker):
        """Test successful preview replace"""
        mock_storage = mocker.patch("services.markdown_edit_service.storage_service")
        original_content = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5"
        mock_storage.download.return_value = original_content.encode("utf-8")

        result = markdown_edit_service_instance.preview_replace(
            s3_key="test/file.md",
            start_line=1,
            end_line=3,
            new_content="New Line 2\nNew Line 3",
        )

        assert isinstance(result, MarkdownPreviewResponse)
        assert result.success is True
        assert len(result.diffs) == 1
        assert result.diffs[0].diff_type == "changed"
        assert result.diffs[0].old_content == "Line 2\nLine 3"
        assert result.diffs[0].new_content == "New Line 2\nNew Line 3"

    def test_preview_replace_invalid_start_line(self, markdown_edit_service_instance, mocker):
        """Test preview replace with invalid start_line"""
        mock_storage = mocker.patch("services.markdown_edit_service.storage_service")
        original_content = "Line 1\nLine 2\nLine 3"
        mock_storage.download.return_value = original_content.encode("utf-8")

        result = markdown_edit_service_instance.preview_replace(
            s3_key="test/file.md",
            start_line=10,
            end_line=12,
            new_content="New content",
        )

        assert result.success is False
        assert "Invalid start_line" in result.message


class TestMarkdownEditServicePreviewInsert:
    """MarkdownEditService preview insert tests"""

    def test_preview_insert_at_start(self, markdown_edit_service_instance, mocker):
        """Test preview insert at start"""
        mock_storage = mocker.patch("services.markdown_edit_service.storage_service")
        original_content = "Line 1\nLine 2"
        mock_storage.download.return_value = original_content.encode("utf-8")

        result = markdown_edit_service_instance.preview_insert(
            s3_key="test/file.md",
            content="New Line 0",
            position="start",
        )

        assert result.success is True
        assert len(result.diffs) == 1
        assert result.diffs[0].diff_type == "added"
        assert result.diffs[0].new_line_start == 0
        assert result.diffs[0].new_line_end == 1

    def test_preview_insert_at_end(self, markdown_edit_service_instance, mocker):
        """Test preview insert at end"""
        mock_storage = mocker.patch("services.markdown_edit_service.storage_service")
        original_content = "Line 1\nLine 2"
        mock_storage.download.return_value = original_content.encode("utf-8")

        result = markdown_edit_service_instance.preview_insert(
            s3_key="test/file.md",
            content="New Line 3",
            position="end",
        )

        assert result.success is True
        assert result.diffs[0].new_line_start == 2
        assert result.diffs[0].new_line_end == 3

    def test_preview_insert_invalid_position(self, markdown_edit_service_instance, mocker):
        """Test preview insert with invalid position"""
        mock_storage = mocker.patch("services.markdown_edit_service.storage_service")
        original_content = "Line 1\nLine 2"
        mock_storage.download.return_value = original_content.encode("utf-8")

        result = markdown_edit_service_instance.preview_insert(
            s3_key="test/file.md",
            content="New Line",
            position="invalid",
        )

        assert result.success is False
        assert "Invalid position" in result.message


class TestMarkdownEditServicePreviewDelete:
    """MarkdownEditService preview delete tests"""

    def test_preview_delete_success(self, markdown_edit_service_instance, mocker):
        """Test successful preview delete"""
        mock_storage = mocker.patch("services.markdown_edit_service.storage_service")
        original_content = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5"
        mock_storage.download.return_value = original_content.encode("utf-8")

        result = markdown_edit_service_instance.preview_delete(
            s3_key="test/file.md",
            start_line=1,
            end_line=3,
        )

        assert isinstance(result, MarkdownPreviewResponse)
        assert result.success is True
        assert len(result.diffs) == 1
        assert result.diffs[0].diff_type == "deleted"
        assert result.diffs[0].old_content == "Line 2\nLine 3"
        assert result.diffs[0].line_count == -2

    def test_preview_delete_invalid_start_line(self, markdown_edit_service_instance, mocker):
        """Test preview delete with invalid start_line"""
        mock_storage = mocker.patch("services.markdown_edit_service.storage_service")
        original_content = "Line 1\nLine 2\nLine 3"
        mock_storage.download.return_value = original_content.encode("utf-8")

        result = markdown_edit_service_instance.preview_delete(
            s3_key="test/file.md",
            start_line=10,
            end_line=12,
        )

        assert result.success is False
        assert "Invalid start_line" in result.message
