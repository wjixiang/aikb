"""
Editor Router API Tests

Tests for the Editor API which provides unified CRUD operations for files.
"""

import pytest
from fastapi.testclient import TestClient


class TestEditorUnifiedCreate:
    """Tests for unified create action"""

    def test_create_file_success(self, client: TestClient, mock_storage_service):
        """Test creating a file via unified endpoint"""
        mock_storage_service.exists.return_value = False
        mock_storage_service.get_file_size.return_value = 26

        response = client.post("/api/v1/editor", json={
            "action": "create",
            "s3_key": "notes/test-note.md",
            "content": "# Hello World\n\nTest content.",
            "content_type": "text/markdown",
            "encoding": "utf-8"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["action"] == "create"
        assert data["s3_key"] == "notes/test-note.md"
        assert data["content_type"] == "text/markdown"
        mock_storage_service.upload.assert_called_once()

    def test_create_file_already_exists(self, client: TestClient, mock_storage_service):
        """Test creating a file that already exists"""
        mock_storage_service.exists.return_value = True

        response = client.post("/api/v1/editor", json={
            "action": "create",
            "s3_key": "notes/existing.md",
            "content": "# Content",
        })

        assert response.status_code == 409
        assert "already exists" in response.json()["detail"].lower()

    def test_create_file_missing_content(self, client: TestClient):
        """Test creating a file without content"""
        response = client.post("/api/v1/editor", json={
            "action": "create",
            "s3_key": "notes/empty.md",
        })

        assert response.status_code == 400
        assert "content is required" in response.json()["detail"].lower()

    def test_create_file_storage_error(self, client: TestClient, mock_storage_service):
        """Test creating a file when storage fails"""
        mock_storage_service.exists.return_value = False
        mock_storage_service.upload.side_effect = Exception("S3 error")

        response = client.post("/api/v1/editor", json={
            "action": "create",
            "s3_key": "notes/test.md",
            "content": "Content",
        })

        assert response.status_code == 500


class TestEditorUnifiedRead:
    """Tests for unified read action"""

    def test_read_file_success(self, client: TestClient, mock_storage_service):
        """Test reading a file via unified endpoint"""
        mock_storage_service.exists.return_value = True
        mock_storage_service.download.return_value = b"# Hello World\n\nTest content."
        mock_storage_service.get_file_size.return_value = 26

        response = client.post("/api/v1/editor", json={
            "action": "read",
            "s3_key": "notes/test-note.md",
            "encoding": "utf-8"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["action"] == "read"
        assert data["s3_key"] == "notes/test-note.md"
        assert data["content"] == "# Hello World\n\nTest content."
        assert data["file_size"] == 26

    def test_read_file_not_found(self, client: TestClient, mock_storage_service):
        """Test reading a non-existent file"""
        mock_storage_service.exists.return_value = False

        response = client.post("/api/v1/editor", json={
            "action": "read",
            "s3_key": "notes/missing.md",
        })

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_read_file_with_encoding(self, client: TestClient, mock_storage_service):
        """Test reading a file with specific encoding"""
        mock_storage_service.exists.return_value = True
        mock_storage_service.download.return_value = "中文内容".encode("utf-8")
        mock_storage_service.get_file_size.return_value = 12

        response = client.post("/api/v1/editor", json={
            "action": "read",
            "s3_key": "notes/chinese.md",
            "encoding": "utf-8"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["content"] == "中文内容"


class TestEditorUnifiedUpdate:
    """Tests for unified update action"""

    def test_update_file_overwrite(self, client: TestClient, mock_storage_service):
        """Test updating a file with overwrite mode"""
        mock_storage_service.exists.return_value = True
        mock_storage_service.download.return_value = b"Old content"
        mock_storage_service.get_file_size.return_value = 11

        response = client.post("/api/v1/editor", json={
            "action": "update",
            "s3_key": "notes/test.md",
            "content": "New content",
            "mode": "overwrite",
            "encoding": "utf-8"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["action"] == "update"
        assert "overwrite" in data["message"].lower()

    def test_update_file_append(self, client: TestClient, mock_storage_service):
        """Test updating a file with append mode"""
        mock_storage_service.exists.return_value = True
        mock_storage_service.download.return_value = b"Original"
        mock_storage_service.get_file_size.return_value = 14

        response = client.post("/api/v1/editor", json={
            "action": "update",
            "s3_key": "notes/test.md",
            "content": " appended",
            "mode": "append",
            "encoding": "utf-8"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "append" in data["message"].lower()

    def test_update_file_prepend(self, client: TestClient, mock_storage_service):
        """Test updating a file with prepend mode"""
        mock_storage_service.exists.return_value = True
        mock_storage_service.download.return_value = b"Original"
        mock_storage_service.get_file_size.return_value = 15

        response = client.post("/api/v1/editor", json={
            "action": "update",
            "s3_key": "notes/test.md",
            "content": "Prepended ",
            "mode": "prepend",
            "encoding": "utf-8"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "prepend" in data["message"].lower()

    def test_update_file_not_found(self, client: TestClient, mock_storage_service):
        """Test updating a non-existent file"""
        mock_storage_service.exists.return_value = False

        response = client.post("/api/v1/editor", json={
            "action": "update",
            "s3_key": "notes/missing.md",
            "content": "New content",
        })

        assert response.status_code == 404

    def test_update_file_missing_content(self, client: TestClient, mock_storage_service):
        """Test updating a file without content"""
        mock_storage_service.exists.return_value = True

        response = client.post("/api/v1/editor", json={
            "action": "update",
            "s3_key": "notes/test.md",
        })

        assert response.status_code == 400
        assert "content is required" in response.json()["detail"].lower()


class TestEditorUnifiedDelete:
    """Tests for unified delete action"""

    def test_delete_file_success(self, client: TestClient, mock_storage_service):
        """Test deleting a file via unified endpoint"""
        mock_storage_service.exists.return_value = True

        response = client.post("/api/v1/editor", json={
            "action": "delete",
            "s3_key": "notes/test.md",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["action"] == "delete"
        mock_storage_service.delete.assert_called_once_with("notes/test.md")

    def test_delete_file_not_found(self, client: TestClient, mock_storage_service):
        """Test deleting a non-existent file"""
        mock_storage_service.exists.return_value = False

        response = client.post("/api/v1/editor", json={
            "action": "delete",
            "s3_key": "notes/missing.md",
        })

        assert response.status_code == 404


class TestEditorUnifiedMove:
    """Tests for unified move action"""

    def test_move_file_success(self, client: TestClient, mock_storage_service):
        """Test moving a file via unified endpoint"""
        mock_storage_service.exists.side_effect = lambda key: key == "notes/old.md"

        response = client.post("/api/v1/editor", json={
            "action": "move",
            "s3_key": "notes/old.md",
            "new_s3_key": "notes/new.md",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["action"] == "move"
        assert data["s3_key"] == "notes/old.md"
        assert data["new_s3_key"] == "notes/new.md"

    def test_move_file_source_not_found(self, client: TestClient, mock_storage_service):
        """Test moving a non-existent file"""
        mock_storage_service.exists.return_value = False

        response = client.post("/api/v1/editor", json={
            "action": "move",
            "s3_key": "notes/missing.md",
            "new_s3_key": "notes/new.md",
        })

        assert response.status_code == 404

    def test_move_file_destination_exists(self, client: TestClient, mock_storage_service):
        """Test moving to an existing destination"""
        mock_storage_service.exists.return_value = True

        response = client.post("/api/v1/editor", json={
            "action": "move",
            "s3_key": "notes/old.md",
            "new_s3_key": "notes/existing.md",
        })

        assert response.status_code == 409

    def test_move_file_missing_new_key(self, client: TestClient, mock_storage_service):
        """Test moving without new_s3_key"""
        mock_storage_service.exists.return_value = True

        response = client.post("/api/v1/editor", json={
            "action": "move",
            "s3_key": "notes/old.md",
        })

        assert response.status_code == 400
        assert "new_s3_key is required" in response.json()["detail"].lower()


class TestEditorUnifiedCopy:
    """Tests for unified copy action"""

    def test_copy_file_success(self, client: TestClient, mock_storage_service):
        """Test copying a file via unified endpoint"""
        mock_storage_service.exists.side_effect = lambda key: key == "notes/source.md"

        response = client.post("/api/v1/editor", json={
            "action": "copy",
            "s3_key": "notes/source.md",
            "new_s3_key": "notes/backup.md",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["action"] == "copy"
        assert data["s3_key"] == "notes/source.md"
        assert data["new_s3_key"] == "notes/backup.md"

    def test_copy_file_source_not_found(self, client: TestClient, mock_storage_service):
        """Test copying a non-existent file"""
        mock_storage_service.exists.return_value = False

        response = client.post("/api/v1/editor", json={
            "action": "copy",
            "s3_key": "notes/missing.md",
            "new_s3_key": "notes/backup.md",
        })

        assert response.status_code == 404

    def test_copy_file_destination_exists(self, client: TestClient, mock_storage_service):
        """Test copying to an existing destination"""
        mock_storage_service.exists.return_value = True

        response = client.post("/api/v1/editor", json={
            "action": "copy",
            "s3_key": "notes/source.md",
            "new_s3_key": "notes/existing.md",
        })

        assert response.status_code == 409


class TestEditorUnifiedExists:
    """Tests for unified exists action"""

    def test_exists_file_true(self, client: TestClient, mock_storage_service):
        """Test checking existence of existing file"""
        mock_storage_service.exists.return_value = True

        response = client.post("/api/v1/editor", json={
            "action": "exists",
            "s3_key": "notes/test.md",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["action"] == "exists"
        assert data["exists"] is True

    def test_exists_file_false(self, client: TestClient, mock_storage_service):
        """Test checking existence of non-existent file"""
        mock_storage_service.exists.return_value = False

        response = client.post("/api/v1/editor", json={
            "action": "exists",
            "s3_key": "notes/missing.md",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["exists"] is False


class TestEditorStandaloneCreate:
    """Tests for standalone create endpoint"""

    def test_standalone_create_success(self, client: TestClient, mock_storage_service):
        """Test creating a file via standalone endpoint"""
        mock_storage_service.exists.return_value = False
        mock_storage_service.get_file_size.return_value = 26

        response = client.post("/api/v1/editor/create", json={
            "s3_key": "notes/test.md",
            "content": "# Hello World\n\nTest content.",
            "content_type": "text/markdown",
            "encoding": "utf-8"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["s3_key"] == "notes/test.md"


class TestEditorStandaloneRead:
    """Tests for standalone read endpoint"""

    def test_standalone_read_success(self, client: TestClient, mock_storage_service):
        """Test reading a file via standalone endpoint"""
        mock_storage_service.exists.return_value = True
        mock_storage_service.download.return_value = b"File content"
        mock_storage_service.get_file_size.return_value = 12

        response = client.get("/api/v1/editor/read?s3_key=notes/test.md")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["content"] == "File content"

    def test_standalone_read_with_encoding(self, client: TestClient, mock_storage_service):
        """Test reading a file with specific encoding"""
        mock_storage_service.exists.return_value = True
        mock_storage_service.download.return_value = "Content".encode("utf-8")
        mock_storage_service.get_file_size.return_value = 7

        response = client.get("/api/v1/editor/read?s3_key=notes/test.md&encoding=utf-8")

        assert response.status_code == 200
        assert response.json()["encoding"] == "utf-8"


class TestEditorStandaloneUpdate:
    """Tests for standalone update endpoint"""

    def test_standalone_update_success(self, client: TestClient, mock_storage_service):
        """Test updating a file via standalone endpoint"""
        mock_storage_service.exists.return_value = True
        mock_storage_service.download.return_value = b"Old"
        mock_storage_service.get_file_size.return_value = 11

        response = client.post("/api/v1/editor/update", json={
            "s3_key": "notes/test.md",
            "content": "New content",
            "mode": "overwrite",
            "encoding": "utf-8"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["mode"] == "overwrite"


class TestEditorStandaloneDelete:
    """Tests for standalone delete endpoint"""

    def test_standalone_delete_success(self, client: TestClient, mock_storage_service):
        """Test deleting a file via standalone endpoint"""
        mock_storage_service.exists.return_value = True

        response = client.delete("/api/v1/editor/delete?s3_key=notes/test.md")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "deleted" in data["message"].lower()


class TestEditorStandaloneMove:
    """Tests for standalone move endpoint"""

    def test_standalone_move_success(self, client: TestClient, mock_storage_service):
        """Test moving a file via standalone endpoint"""
        mock_storage_service.exists.side_effect = lambda key: key == "notes/old.md"

        response = client.post("/api/v1/editor/move", json={
            "s3_key": "notes/old.md",
            "new_s3_key": "notes/new.md",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["new_s3_key"] == "notes/new.md"


class TestEditorStandaloneCopy:
    """Tests for standalone copy endpoint"""

    def test_standalone_copy_success(self, client: TestClient, mock_storage_service):
        """Test copying a file via standalone endpoint"""
        mock_storage_service.exists.side_effect = lambda key: key == "notes/source.md"

        response = client.post("/api/v1/editor/copy", json={
            "s3_key": "notes/source.md",
            "new_s3_key": "notes/backup.md",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True


class TestEditorStandaloneExists:
    """Tests for standalone exists endpoint"""

    def test_standalone_exists_true(self, client: TestClient, mock_storage_service):
        """Test checking existence via standalone endpoint"""
        mock_storage_service.exists.return_value = True

        response = client.get("/api/v1/editor/exists?s3_key=notes/test.md")

        assert response.status_code == 200
        data = response.json()
        assert data["exists"] is True
        assert data["s3_key"] == "notes/test.md"

    def test_standalone_exists_false(self, client: TestClient, mock_storage_service):
        """Test checking non-existence via standalone endpoint"""
        mock_storage_service.exists.return_value = False

        response = client.get("/api/v1/editor/exists?s3_key=notes/missing.md")

        assert response.status_code == 200
        data = response.json()
        assert data["exists"] is False


class TestEditorEdgeCases:
    """Edge case tests for editor router"""

    def test_unsupported_action(self, client: TestClient):
        """Test with unsupported action"""
        response = client.post("/api/v1/editor", json={
            "action": "invalid_action",
            "s3_key": "notes/test.md",
        })

        assert response.status_code == 400
        assert "unsupported" in response.json()["detail"].lower()

    def test_missing_s3_key(self, client: TestClient):
        """Test request without s3_key"""
        response = client.post("/api/v1/editor", json={
            "action": "read",
        })

        assert response.status_code == 422  # Validation error

    def test_unicode_s3_key(self, client: TestClient, mock_storage_service):
        """Test with unicode characters in s3_key"""
        mock_storage_service.exists.return_value = True
        mock_storage_service.download.return_value = b"Content"
        mock_storage_service.get_file_size.return_value = 7

        response = client.post("/api/v1/editor", json={
            "action": "read",
            "s3_key": "notes/\u4e2d\u6587\u6587\u4ef6.md",
            "encoding": "utf-8"
        })

        assert response.status_code == 200
        assert response.json()["s3_key"] == "notes/\u4e2d\u6587\u6587\u4ef6.md"

    def test_special_chars_in_s3_key(self, client: TestClient, mock_storage_service):
        """Test with special characters in s3_key"""
        mock_storage_service.exists.return_value = True
        mock_storage_service.download.return_value = b"Content"
        mock_storage_service.get_file_size.return_value = 7

        response = client.post("/api/v1/editor", json={
            "action": "read",
            "s3_key": "notes/file-with-special_chars 123.md",
            "encoding": "utf-8"
        })

        assert response.status_code == 200

    def test_deeply_nested_path(self, client: TestClient, mock_storage_service):
        """Test with deeply nested path"""
        mock_storage_service.exists.return_value = True
        mock_storage_service.download.return_value = b"Content"
        mock_storage_service.get_file_size.return_value = 7

        response = client.post("/api/v1/editor", json={
            "action": "read",
            "s3_key": "a/b/c/d/e/f/g/deep-file.md",
        })

        assert response.status_code == 200
        assert response.json()["s3_key"] == "a/b/c/d/e/f/g/deep-file.md"

    def test_large_content_update(self, client: TestClient, mock_storage_service):
        """Test updating with large content"""
        mock_storage_service.exists.return_value = True
        mock_storage_service.download.return_value = b"Old"
        mock_storage_service.get_file_size.return_value = 10000

        large_content = "x" * 10000

        response = client.post("/api/v1/editor", json={
            "action": "update",
            "s3_key": "notes/large.md",
            "content": large_content,
            "mode": "overwrite",
        })

        assert response.status_code == 200
        assert response.json()["success"] is True
