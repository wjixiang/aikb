"""
File API Tests
"""

import io
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app
from models.file import FileMetadata, FileStatus
from repositories.file_repository import FileRepository


@pytest.fixture
def client():
    """获取测试客户端"""
    return TestClient(app)


@pytest.fixture
def mock_file_repository():
    """模拟文件仓库"""
    with patch("routers.file.file_repository") as mock_repo:
        yield mock_repo


@pytest.fixture
def mock_storage_service():
    """模拟存储服务"""
    with patch("routers.file.storage_service") as mock_storage:
        mock_storage.upload.return_value = "http://example.com/file.txt"
        mock_storage.get_presigned_url.return_value = "http://example.com/download?token=xxx"
        mock_storage.delete.return_value = True
        yield mock_storage


@pytest.fixture
def sample_metadata():
    """示例文件元数据"""
    return FileMetadata(
        file_id=str(uuid.uuid4()),
        original_name="test.pdf",
        s3_key="files/test/test.pdf",
        content_type="application/pdf",
        file_size=1024,
        status=FileStatus.COMPLETED,
    )


class TestFileUpload:
    """文件上传测试"""

    def test_upload_file(self, client, mock_storage_service, mock_file_repository):
        """测试文件上传"""
        mock_file_repository.create = AsyncMock(return_value=None)

        # 创建测试文件
        file_content = b"Hello, World!"
        files = {"file": ("test.txt", io.BytesIO(file_content), "text/plain")}

        response = client.post("/files/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert "file_id" in data
        assert data["original_name"] == "test.txt"
        assert data["content_type"] == "text/plain"

        # 验证存储服务被调用
        mock_storage_service.upload.assert_called_once()


class TestFileDetail:
    """文件详情测试"""

    def test_get_file(self, client, mock_file_repository, sample_metadata):
        """测试获取文件"""
        mock_file_repository.get = AsyncMock(return_value=sample_metadata)

        response = client.get(f"/files/{sample_metadata.file_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["file_id"] == sample_metadata.file_id
        assert data["original_name"] == "test.pdf"

    def test_get_file_not_found(self, client, mock_file_repository):
        """测试文件不存在"""
        mock_file_repository.get = AsyncMock(return_value=None)

        response = client.get(f"/files/{uuid.uuid4()}")

        assert response.status_code == 404


class TestFileDownload:
    """文件下载测试"""

    def test_download_file(self, client, mock_file_repository, mock_storage_service, sample_metadata):
        """测试获取下载链接"""
        mock_file_repository.get = AsyncMock(return_value=sample_metadata)

        response = client.get(f"/files/{sample_metadata.file_id}/download")

        assert response.status_code == 200
        data = response.json()
        assert "download_url" in data
        assert data["expires_in"] == 3600

    def test_download_not_found(self, client, mock_file_repository):
        """测试下载文件不存在"""
        mock_file_repository.get = AsyncMock(return_value=None)

        response = client.get(f"/files/{uuid.uuid4()}/download")

        assert response.status_code == 404


class TestFileDelete:
    """文件删除测试"""

    def test_delete_file(self, client, mock_file_repository, mock_storage_service, sample_metadata):
        """测试删除文件"""
        mock_file_repository.get = AsyncMock(return_value=sample_metadata)
        mock_file_repository.delete = AsyncMock(return_value=True)

        response = client.delete(f"/files/{sample_metadata.file_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["file_id"] == sample_metadata.file_id

        # 验证存储服务删除被调用
        mock_storage_service.delete.assert_called_once_with(sample_metadata.s3_key)

    def test_delete_not_found(self, client, mock_file_repository):
        """测试删除不存在的文件"""
        mock_file_repository.get = AsyncMock(return_value=None)

        response = client.delete(f"/files/{uuid.uuid4()}")

        assert response.status_code == 404


class TestFileList:
    """文件列表测试"""

    def test_list_files(self, client, mock_file_repository):
        """测试列出文件"""
        mock_file_repository.list = AsyncMock(return_value=[])

        response = client.get("/files/")

        assert response.status_code == 200
        data = response.json()
        assert "files" in data
        assert "total" in data
