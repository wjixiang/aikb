"""
Storage Service Tests
"""

import uuid

import pytest

from config import settings
from services.storage_service import StorageService


class TestStorageService:
    """存储服务测试类"""

    @pytest.fixture
    def storage(self):
        """获取存储服务实例"""
        return StorageService()

    @pytest.fixture
    def test_key(self):
        """生成测试文件key"""
        return f"test/{uuid.uuid4()}.txt"

    def test_connection(self, storage):
        """测试S3连接"""
        assert storage.bucket_exists(), f"Bucket '{settings.s3.bucket}' does not exist"

    def test_upload_and_download(self, storage, test_key):
        """测试上传和下载"""
        content = "Hello, S3!"
        # 上传
        url = storage.upload(content, test_key)
        assert url is not None

        # 下载
        downloaded = storage.download(test_key)
        assert downloaded.decode("utf-8") == content

    def test_exists(self, storage, test_key):
        """测试文件存在检查"""
        content = "Test exists"
        storage.upload(content, test_key)

        assert storage.exists(test_key) is True
        assert storage.exists(f"nonexistent_{test_key}") is False

    def test_delete(self, storage, test_key):
        """测试删除文件"""
        content = "To be deleted"
        storage.upload(content, test_key)

        assert storage.exists(test_key) is True

        storage.delete(test_key)
        assert storage.exists(test_key) is False

    def test_presigned_url(self, storage, test_key):
        """测试预签名URL"""
        content = "Presigned URL test"
        storage.upload(content, test_key)

        url = storage.get_presigned_url(test_key, expires_in=3600)
        assert url is not None
        assert test_key in url

    def test_presigned_upload_url(self, storage, test_key):
        """测试预签名上传URL"""
        url = storage.get_presigned_upload_url(test_key, "text/plain", 3600)
        assert url is not None
        assert "Signature=" in url

    def test_list_objects(self, storage):
        """测试列出文件"""
        # 上传测试文件
        test_prefix = f"test/list_{uuid.uuid4()}"
        storage.upload("content1", f"{test_prefix}/file1.txt")
        storage.upload("content2", f"{test_prefix}/file2.txt")

        # 列出文件
        objects = storage.list_objects(test_prefix)
        assert len(objects) == 2

        # 清理
        for obj in objects:
            storage.delete(obj)
