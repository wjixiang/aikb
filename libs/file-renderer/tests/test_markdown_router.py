"""
Markdown Router API Tests
"""

import pytest
from fastapi.testclient import TestClient

from models.markdown_model import (
    MarkdownMetadata,
    MarkdownReadByPageResponse,
    MarkdownEditResponse,
    MarkdownPreviewResponse,
    ContentDiff,
)


class TestMarkdownCreate:
    """Markdown create endpoint tests"""

    def test_create_markdown_success(self, client, mock_storage_service):
        """Test creating markdown file"""
        mock_storage_service.upload.return_value = "http://example.com/files/markdown/2026/03/17/test.md"

        response = client.post("/markdown/create", json={
            "fileName": "test.md"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "s3_key" in data
        assert data["content_type"] == "text/markdown"
        assert data["file_size"] == 0

        # Verify storage upload was called
        mock_storage_service.upload.assert_called_once()

    def test_create_markdown_storage_error(self, client, mock_storage_service):
        """Test creating markdown file with storage error"""
        mock_storage_service.upload.side_effect = Exception("S3 error")

        response = client.post("/markdown/create", json={
            "fileName": "test.md"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "S3 error" in data["message"]


class TestMarkdownReadByPage:
    """Markdown read by page endpoint tests"""

    def test_read_by_page_success(self, client, mocker):
        """Test reading markdown by page"""
        mock_service = mocker.patch("routers.markdown.markdown_service")
        mock_service.read_by_page.return_value = MarkdownReadByPageResponse(
            metadata=MarkdownMetadata(
                s3_key="test/file.md",
                file_name="file.md",
                total_lines=100,
                total_pages=10,
            ),
            page=1,
            content="Line 1\nLine 2\n...",
            start_line=0,
            end_line=10,
            has_next=True,
            has_previous=False,
        )

        response = client.post("/markdown/read/bypage", json={
            "s3_key": "test/file.md",
            "page": 1,
            "page_size": 10,
        })

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["has_next"] is True
        assert data["has_previous"] is False
        assert "metadata" in data

    def test_read_by_page_file_not_found(self, client, mocker):
        """Test reading non-existent file"""
        mock_service = mocker.patch("routers.markdown.markdown_service")
        mock_service.read_by_page.side_effect = FileNotFoundError("File not found")

        response = client.post("/markdown/read/bypage", json={
            "s3_key": "test/nonexistent.md",
            "page": 1,
        })

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_read_by_page_default_values(self, client, mocker):
        """Test reading with default values"""
        mock_service = mocker.patch("routers.markdown.markdown_service")
        mock_service.read_by_page.return_value = MarkdownReadByPageResponse(
            metadata=MarkdownMetadata(
                s3_key="test/file.md",
                file_name="file.md",
                total_lines=500,
                total_pages=1,
            ),
            page=1,
            content="Content",
            start_line=0,
            end_line=500,
            has_next=False,
            has_previous=False,
        )

        response = client.post("/markdown/read/bypage", json={
            "s3_key": "test/file.md",
        })

        assert response.status_code == 200
        # Verify service was called with default page=1, page_size=1000
        mock_service.read_by_page.assert_called_once_with(
            s3_key="test/file.md",
            page=1,
            page_size=1000,
        )


class TestMarkdownEditReplace:
    """Markdown edit replace endpoint tests"""

    def test_edit_replace_success(self, client, mocker):
        """Test successful replace operation"""
        mock_service = mocker.patch("routers.markdown.markdown_edit_service")
        mock_service.replace.return_value = MarkdownEditResponse(
            success=True,
            message="Successfully replaced lines 1-3",
            s3_key="test/file.md",
            old_line_count=5,
            new_line_count=4,
            lines_changed=-1,
        )

        response = client.post("/markdown/edit/replace", json={
            "s3_key": "test/file.md",
            "start_line": 1,
            "end_line": 3,
            "new_content": "New content",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["lines_changed"] == -1

    def test_edit_replace_missing_start_line(self, client):
        """Test replace without start_line"""
        response = client.post("/markdown/edit/replace", json={
            "s3_key": "test/file.md",
            "end_line": 3,
            "new_content": "New content",
        })

        assert response.status_code == 400
        assert "start_line is required" in response.json()["detail"]

    def test_edit_replace_missing_end_line(self, client):
        """Test replace without end_line"""
        response = client.post("/markdown/edit/replace", json={
            "s3_key": "test/file.md",
            "start_line": 1,
            "new_content": "New content",
        })

        assert response.status_code == 400
        assert "end_line is required" in response.json()["detail"]

    def test_edit_replace_missing_new_content(self, client):
        """Test replace without new_content"""
        response = client.post("/markdown/edit/replace", json={
            "s3_key": "test/file.md",
            "start_line": 1,
            "end_line": 3,
        })

        assert response.status_code == 400
        assert "new_content is required" in response.json()["detail"]


class TestMarkdownEditInsert:
    """Markdown edit insert endpoint tests"""

    def test_edit_insert_success(self, client, mocker):
        """Test successful insert operation"""
        mock_service = mocker.patch("routers.markdown.markdown_edit_service")
        mock_service.insert.return_value = MarkdownEditResponse(
            success=True,
            message="Successfully inserted content at end",
            s3_key="test/file.md",
            old_line_count=5,
            new_line_count=7,
            lines_changed=2,
        )

        response = client.post("/markdown/edit/insert", json={
            "s3_key": "test/file.md",
            "content": "New lines",
            "position": "end",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["lines_changed"] == 2

    def test_edit_insert_at_start(self, client, mocker):
        """Test insert at start"""
        mock_service = mocker.patch("routers.markdown.markdown_edit_service")
        mock_service.insert.return_value = MarkdownEditResponse(
            success=True,
            message="Successfully inserted content at start",
            s3_key="test/file.md",
            old_line_count=5,
            new_line_count=6,
            lines_changed=1,
        )

        response = client.post("/markdown/edit/insert", json={
            "s3_key": "test/file.md",
            "content": "New line",
            "position": "start",
        })

        assert response.status_code == 200

    def test_edit_insert_before_line(self, client, mocker):
        """Test insert before specific line"""
        mock_service = mocker.patch("routers.markdown.markdown_edit_service")
        mock_service.insert.return_value = MarkdownEditResponse(
            success=True,
            message="Successfully inserted content at before_line",
            s3_key="test/file.md",
            old_line_count=5,
            new_line_count=6,
            lines_changed=1,
        )

        response = client.post("/markdown/edit/insert", json={
            "s3_key": "test/file.md",
            "content": "New line",
            "position": "before_line",
            "target_line": 2,
        })

        assert response.status_code == 200


class TestMarkdownEditDelete:
    """Markdown edit delete endpoint tests"""

    def test_edit_delete_success(self, client, mocker):
        """Test successful delete operation"""
        mock_service = mocker.patch("routers.markdown.markdown_edit_service")
        mock_service.delete.return_value = MarkdownEditResponse(
            success=True,
            message="Successfully deleted lines 1-3",
            s3_key="test/file.md",
            old_line_count=5,
            new_line_count=3,
            lines_changed=-2,
        )

        response = client.post("/markdown/edit/delete", json={
            "s3_key": "test/file.md",
            "start_line": 1,
            "end_line": 3,
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["lines_changed"] == -2


class TestMarkdownPreviewReplace:
    """Markdown preview replace endpoint tests"""

    def test_preview_replace_success(self, client, mocker):
        """Test successful preview replace"""
        mock_service = mocker.patch("routers.markdown.markdown_edit_service")
        mock_service.preview_replace.return_value = MarkdownPreviewResponse(
            success=True,
            message="Preview: will replace lines 1-3",
            s3_key="test/file.md",
            diffs=[
                ContentDiff(
                    diff_type="changed",
                    old_content="Old lines",
                    new_content="New content",
                    old_line_start=1,
                    old_line_end=3,
                    new_line_start=1,
                    new_line_end=2,
                    line_count=-1,
                )
            ],
            old_line_count=5,
            new_line_count=4,
        )

        response = client.post("/markdown/preview/replace", json={
            "s3_key": "test/file.md",
            "start_line": 1,
            "end_line": 3,
            "new_content": "New content",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["diffs"]) == 1
        assert data["diffs"][0]["diff_type"] == "changed"

    def test_preview_replace_missing_params(self, client):
        """Test preview replace with missing params"""
        response = client.post("/markdown/preview/replace", json={
            "s3_key": "test/file.md",
        })

        assert response.status_code == 400


class TestMarkdownPreviewInsert:
    """Markdown preview insert endpoint tests"""

    def test_preview_insert_success(self, client, mocker):
        """Test successful preview insert"""
        mock_service = mocker.patch("routers.markdown.markdown_edit_service")
        mock_service.preview_insert.return_value = MarkdownPreviewResponse(
            success=True,
            message="Preview: will insert 2 lines at end",
            s3_key="test/file.md",
            diffs=[
                ContentDiff(
                    diff_type="added",
                    old_content=None,
                    new_content="New lines",
                    old_line_start=None,
                    old_line_end=None,
                    new_line_start=5,
                    new_line_end=7,
                    line_count=2,
                )
            ],
            old_line_count=5,
            new_line_count=7,
        )

        response = client.post("/markdown/preview/insert", json={
            "s3_key": "test/file.md",
            "content": "New lines",
            "position": "end",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["diffs"][0]["diff_type"] == "added"


class TestMarkdownPreviewDelete:
    """Markdown preview delete endpoint tests"""

    def test_preview_delete_success(self, client, mocker):
        """Test successful preview delete"""
        mock_service = mocker.patch("routers.markdown.markdown_edit_service")
        mock_service.preview_delete.return_value = MarkdownPreviewResponse(
            success=True,
            message="Preview: will delete lines 1-3",
            s3_key="test/file.md",
            diffs=[
                ContentDiff(
                    diff_type="deleted",
                    old_content="Lines to delete",
                    new_content=None,
                    old_line_start=1,
                    old_line_end=3,
                    new_line_start=None,
                    new_line_end=None,
                    line_count=-2,
                )
            ],
            old_line_count=5,
            new_line_count=3,
        )

        response = client.post("/markdown/preview/delete", json={
            "s3_key": "test/file.md",
            "start_line": 1,
            "end_line": 3,
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["diffs"][0]["diff_type"] == "deleted"


class TestMarkdownRouterEdgeCases:
    """Markdown router edge case tests"""

    def test_create_markdown_invalid_filename(self, client):
        """Test creating markdown with invalid filename"""
        response = client.post("/markdown/create", json={
            "fileName": "",  # Empty filename
        })

        # Should still create with empty filename
        assert response.status_code == 200

    def test_read_by_page_invalid_page(self, client, mocker):
        """Test reading with invalid page number"""
        mock_service = mocker.patch("routers.markdown.markdown_service")
        mock_service.read_by_page.side_effect = Exception("Invalid page")

        response = client.post("/markdown/read/bypage", json={
            "s3_key": "test/file.md",
            "page": -1,
        })

        assert response.status_code == 500

    def test_edit_insert_invalid_position(self, client, mocker):
        """Test insert with invalid position"""
        mock_service = mocker.patch("routers.markdown.markdown_edit_service")
        mock_service.insert.return_value = MarkdownEditResponse(
            success=False,
            message="Invalid position: invalid",
            s3_key="test/file.md",
            old_line_count=5,
            new_line_count=5,
            lines_changed=0,
        )

        response = client.post("/markdown/edit/insert", json={
            "s3_key": "test/file.md",
            "content": "New line",
            "position": "invalid",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
