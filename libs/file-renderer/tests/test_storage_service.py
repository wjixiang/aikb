"""
Storage Service Unit Tests
"""

import io
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError

from services.storage_service import StorageService


class TestStorageServiceUnit:
    """StorageService unit tests with mocked S3"""

    def test_init(self):
        """Test StorageService initialization"""
        service = StorageService()
        assert service._client is None
        assert service._resource is None

    def test_client_property(self, mocker):
        """Test client property creates boto3 client"""
        mock_boto3 = mocker.patch("services.storage_service.boto3")
        mock_client = MagicMock()
        mock_boto3.client.return_value = mock_client

        service = StorageService()
        client = service.client

        assert client is mock_client
        mock_boto3.client.assert_called_once()

    def test_resource_property(self, mocker):
        """Test resource property creates boto3 resource"""
        mock_boto3 = mocker.patch("services.storage_service.boto3")
        mock_resource = MagicMock()
        mock_boto3.resource.return_value = mock_resource

        service = StorageService()
        resource = service.resource

        assert resource is mock_resource
        mock_boto3.resource.assert_called_once()

    def test_normalize_key(self, storage_service_instance):
        """Test key normalization"""
        # Remove leading slash
        assert storage_service_instance._normalize_key("/test/file.txt") == "test/file.txt"
        # Keep as-is if no leading slash
        assert storage_service_instance._normalize_key("test/file.txt") == "test/file.txt"
        # Handle multiple slashes
        assert storage_service_instance._normalize_key("///test/file.txt") == "test/file.txt"

    def test_upload_string(self, storage_service_instance, mock_s3_client, mocker):
        """Test uploading string content"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_settings.s3.force_path_style = True
        mock_settings.s3.endpoint = "example.com"

        url = storage_service_instance.upload("Hello, World!", "test/file.txt")

        mock_s3_client.put_object.assert_called_once_with(
            Bucket="test-bucket",
            Key="test/file.txt",
            Body=b"Hello, World!",
            ContentType="application/octet-stream",
        )
        assert "test/file.txt" in url

    def test_upload_bytes(self, storage_service_instance, mock_s3_client, mocker):
        """Test uploading bytes content"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_settings.s3.force_path_style = True
        mock_settings.s3.endpoint = "example.com"

        url = storage_service_instance.upload(b"Binary content", "test/file.bin", "application/octet-stream")

        mock_s3_client.put_object.assert_called_once_with(
            Bucket="test-bucket",
            Key="test/file.bin",
            Body=b"Binary content",
            ContentType="application/octet-stream",
        )

    def test_download(self, storage_service_instance, mock_s3_client, mocker):
        """Test downloading file"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"

        content = storage_service_instance.download("test/file.txt")

        mock_s3_client.get_object.assert_called_once_with(
            Bucket="test-bucket",
            Key="test/file.txt",
        )
        assert content == b"test content"

    def test_delete(self, storage_service_instance, mock_s3_client, mocker):
        """Test deleting file"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"

        result = storage_service_instance.delete("test/file.txt")

        mock_s3_client.delete_object.assert_called_once_with(
            Bucket="test-bucket",
            Key="test/file.txt",
        )
        assert result is True

    def test_exists_true(self, storage_service_instance, mock_s3_client, mocker):
        """Test checking file exists (file exists)"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"

        result = storage_service_instance.exists("test/file.txt")

        mock_s3_client.head_object.assert_called_once_with(
            Bucket="test-bucket",
            Key="test/file.txt",
        )
        assert result is True

    def test_exists_false(self, storage_service_instance, mock_s3_client, mocker):
        """Test checking file exists (file does not exist)"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_s3_client.head_object.side_effect = ClientError(
            {"Error": {"Code": "404", "Message": "Not Found"}}, "HeadObject"
        )

        result = storage_service_instance.exists("test/nonexistent.txt")

        assert result is False

    def test_get_presigned_url(self, storage_service_instance, mock_s3_client, mocker):
        """Test generating presigned download URL"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_s3_client.generate_presigned_url.return_value = "http://example.com/presigned?token=abc"

        url = storage_service_instance.get_presigned_url("test/file.txt", 3600)

        mock_s3_client.generate_presigned_url.assert_called_once_with(
            "get_object",
            Params={"Bucket": "test-bucket", "Key": "test/file.txt"},
            ExpiresIn=3600,
        )
        assert url == "http://example.com/presigned?token=abc"

    def test_get_presigned_upload_url(self, storage_service_instance, mock_s3_client, mocker):
        """Test generating presigned upload URL"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_s3_client.generate_presigned_url.return_value = "http://example.com/upload?token=abc"

        url = storage_service_instance.get_presigned_upload_url("test/file.txt", "text/plain", 3600)

        mock_s3_client.generate_presigned_url.assert_called_once_with(
            "put_object",
            Params={
                "Bucket": "test-bucket",
                "Key": "test/file.txt",
                "ContentType": "text/plain",
            },
            ExpiresIn=3600,
        )
        assert url == "http://example.com/upload?token=abc"

    def test_get_file_size(self, storage_service_instance, mock_s3_client, mocker):
        """Test getting file size"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_s3_client.head_object.return_value = {"ContentLength": 2048}

        size = storage_service_instance.get_file_size("test/file.txt")

        assert size == 2048

    def test_get_modified_time(self, storage_service_instance, mock_s3_client, mocker):
        """Test getting file modified time"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_time = datetime(2026, 3, 17, 12, 0, 0)
        mock_s3_client.head_object.return_value = {"LastModified": mock_time}

        timestamp = storage_service_instance.get_modified_time("test/file.txt")

        assert timestamp == int(mock_time.timestamp())

    def test_list_objects(self, storage_service_instance, mock_s3_client, mocker):
        """Test listing objects"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_s3_client.list_objects_v2.return_value = {
            "Contents": [
                {"Key": "test/file1.txt"},
                {"Key": "test/file2.txt"},
                {"Key": "test/file3.txt"},
            ]
        }

        objects = storage_service_instance.list_objects("test/")

        mock_s3_client.list_objects_v2.assert_called_once_with(
            Bucket="test-bucket",
            Prefix="test/",
        )
        assert objects == ["test/file1.txt", "test/file2.txt", "test/file3.txt"]

    def test_list_objects_empty(self, storage_service_instance, mock_s3_client, mocker):
        """Test listing objects (empty result)"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_s3_client.list_objects_v2.return_value = {}

        objects = storage_service_instance.list_objects("empty/")

        assert objects == []

    def test_bucket_exists_true(self, storage_service_instance, mock_s3_client, mocker):
        """Test checking bucket exists (exists)"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"

        result = storage_service_instance.bucket_exists()

        mock_s3_client.head_bucket.assert_called_once_with(Bucket="test-bucket")
        assert result is True

    def test_bucket_exists_false(self, storage_service_instance, mock_s3_client, mocker):
        """Test checking bucket exists (does not exist)"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_s3_client.head_bucket.side_effect = ClientError(
            {"Error": {"Code": "404", "Message": "Not Found"}}, "HeadBucket"
        )

        result = storage_service_instance.bucket_exists()

        assert result is False

    def test_generate_url_path_style(self, storage_service_instance, mocker):
        """Test generating URL with path style"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.force_path_style = True
        mock_settings.s3.endpoint = "oss.example.com"
        mock_settings.s3.bucket = "my-bucket"

        url = storage_service_instance._generate_url("test/file.txt")

        assert url == "http://oss.example.com/my-bucket/test/file.txt"

    def test_generate_url_virtual_style(self, storage_service_instance, mocker):
        """Test generating URL with virtual hosted style"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.force_path_style = False
        mock_settings.s3.endpoint = "oss.example.com"
        mock_settings.s3.bucket = "my-bucket"

        url = storage_service_instance._generate_url("test/file.txt")

        assert url == "http://my-bucket.oss.example.com/test/file.txt"


class TestStorageServiceErrorHandling:
    """StorageService error handling tests"""

    def test_download_error(self, storage_service_instance, mock_s3_client, mocker):
        """Test download with error"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_s3_client.get_object.side_effect = ClientError(
            {"Error": {"Code": "NoSuchKey", "Message": "The specified key does not exist"}},
            "GetObject",
        )

        with pytest.raises(ClientError):
            storage_service_instance.download("test/nonexistent.txt")

    def test_download_generic_error(self, storage_service_instance, mock_s3_client, mocker):
        """Test download with generic error"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_s3_client.get_object.side_effect = Exception("Network error")

        with pytest.raises(Exception):
            storage_service_instance.download("test/file.txt")

    def test_upload_error(self, storage_service_instance, mock_s3_client, mocker):
        """Test upload with error"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_s3_client.put_object.side_effect = ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "Access Denied"}},
            "PutObject",
        )

        with pytest.raises(ClientError):
            storage_service_instance.upload("content", "test/file.txt")

    def test_upload_generic_error(self, storage_service_instance, mock_s3_client, mocker):
        """Test upload with generic error"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_s3_client.put_object.side_effect = Exception("Network error")

        with pytest.raises(Exception):
            storage_service_instance.upload("content", "test/file.txt")

    def test_get_file_size_error(self, storage_service_instance, mock_s3_client, mocker):
        """Test get_file_size with error"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_s3_client.head_object.side_effect = ClientError(
            {"Error": {"Code": "NoSuchKey", "Message": "Not Found"}},
            "HeadObject",
        )

        with pytest.raises(ClientError):
            storage_service_instance.get_file_size("test/nonexistent.txt")

    def test_get_file_size_generic_error(self, storage_service_instance, mock_s3_client, mocker):
        """Test get_file_size with generic error"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_s3_client.head_object.side_effect = Exception("Network error")

        with pytest.raises(Exception):
            storage_service_instance.get_file_size("test/file.txt")

    def test_delete_error(self, storage_service_instance, mock_s3_client, mocker):
        """Test delete with error"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_s3_client.delete_object.side_effect = ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "Access Denied"}},
            "DeleteObject",
        )

        with pytest.raises(ClientError):
            storage_service_instance.delete("test/file.txt")

    def test_get_modified_time_error(self, storage_service_instance, mock_s3_client, mocker):
        """Test get_modified_time with error"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_s3_client.head_object.side_effect = ClientError(
            {"Error": {"Code": "NoSuchKey", "Message": "Not Found"}},
            "HeadObject",
        )

        with pytest.raises(ClientError):
            storage_service_instance.get_modified_time("test/nonexistent.txt")

    def test_list_objects_error(self, storage_service_instance, mock_s3_client, mocker):
        """Test list_objects with error"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_s3_client.list_objects_v2.side_effect = ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "Access Denied"}},
            "ListObjectsV2",
        )

        with pytest.raises(ClientError):
            storage_service_instance.list_objects("test/")

    def test_get_presigned_url_error(self, storage_service_instance, mock_s3_client, mocker):
        """Test get_presigned_url with error"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_s3_client.generate_presigned_url.side_effect = Exception("Configuration error")

        with pytest.raises(Exception):
            storage_service_instance.get_presigned_url("test/file.txt")

    def test_get_presigned_upload_url_error(self, storage_service_instance, mock_s3_client, mocker):
        """Test get_presigned_upload_url with error"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_s3_client.generate_presigned_url.side_effect = Exception("Configuration error")

        with pytest.raises(Exception):
            storage_service_instance.get_presigned_upload_url("test/file.txt")

    def test_exists_with_other_client_error(self, storage_service_instance, mock_s3_client, mocker):
        """Test exists with non-NoSuchKey client error"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_s3_client.head_object.side_effect = ClientError(
            {"Error": {"Code": "InternalError", "Message": "Internal Error"}},
            "HeadObject",
        )

        result = storage_service_instance.exists("test/file.txt")

        assert result is False

    def test_exists_with_generic_error(self, storage_service_instance, mock_s3_client, mocker):
        """Test exists with generic error"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_s3_client.head_object.side_effect = Exception("Network error")

        result = storage_service_instance.exists("test/file.txt")

        assert result is False

    def test_bucket_exists_with_generic_error(self, storage_service_instance, mock_s3_client, mocker):
        """Test bucket_exists with generic error"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_s3_client.head_bucket.side_effect = Exception("Network error")

        result = storage_service_instance.bucket_exists()

        assert result is False


class TestStorageServiceEdgeCases:
    """StorageService edge case tests"""

    def test_upload_empty_string(self, storage_service_instance, mock_s3_client, mocker):
        """Test uploading empty string"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_settings.s3.force_path_style = True
        mock_settings.s3.endpoint = "example.com"

        url = storage_service_instance.upload("", "test/empty.txt")

        mock_s3_client.put_object.assert_called_once()
        call_args = mock_s3_client.put_object.call_args
        assert call_args[1]["Body"] == b""

    def test_upload_empty_bytes(self, storage_service_instance, mock_s3_client, mocker):
        """Test uploading empty bytes"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_settings.s3.force_path_style = True
        mock_settings.s3.endpoint = "example.com"

        url = storage_service_instance.upload(b"", "test/empty.bin")

        mock_s3_client.put_object.assert_called_once()
        call_args = mock_s3_client.put_object.call_args
        assert call_args[1]["Body"] == b""

    def test_upload_large_file(self, storage_service_instance, mock_s3_client, mocker):
        """Test uploading large file"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_settings.s3.force_path_style = True
        mock_settings.s3.endpoint = "example.com"

        large_content = b"x" * (10 * 1024 * 1024)  # 10MB

        url = storage_service_instance.upload(large_content, "test/large.bin")

        mock_s3_client.put_object.assert_called_once()

    def test_upload_unicode_content(self, storage_service_instance, mock_s3_client, mocker):
        """Test uploading unicode content"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_settings.s3.force_path_style = True
        mock_settings.s3.endpoint = "example.com"

        url = storage_service_instance.upload("\u4e2d\u6587\u5185\u5bb9", "test/unicode.txt")

        mock_s3_client.put_object.assert_called_once()
        call_args = mock_s3_client.put_object.call_args
        assert call_args[1]["Body"] == "\u4e2d\u6587\u5185\u5bb9".encode("utf-8")

    def test_normalize_key_with_unicode(self, storage_service_instance):
        """Test key normalization with unicode"""
        result = storage_service_instance._normalize_key("/\u4e2d\u6587/\u6587\u4ef6.txt")
        assert result == "\u4e2d\u6587/\u6587\u4ef6.txt"

    def test_normalize_key_with_special_chars(self, storage_service_instance):
        """Test key normalization with special characters"""
        result = storage_service_instance._normalize_key("/path/file with spaces & symbols.txt")
        assert result == "path/file with spaces & symbols.txt"

    def test_list_objects_with_pagination(self, storage_service_instance, mock_s3_client, mocker):
        """Test listing objects with pagination"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"

        # Simulate paginated response
        mock_s3_client.list_objects_v2.return_value = {
            "Contents": [{"Key": f"test/file{i}.txt"} for i in range(1000)],
            "IsTruncated": False,
        }

        objects = storage_service_instance.list_objects("test/")

        assert len(objects) == 1000

    def test_get_presigned_url_custom_expiry(self, storage_service_instance, mock_s3_client, mocker):
        """Test generating presigned URL with custom expiry"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_s3_client.generate_presigned_url.return_value = "http://example.com/presigned"

        url = storage_service_instance.get_presigned_url("test/file.txt", expires_in=7200)

        mock_s3_client.generate_presigned_url.assert_called_once_with(
            "get_object",
            Params={"Bucket": "test-bucket", "Key": "test/file.txt"},
            ExpiresIn=7200,
        )

    def test_get_presigned_upload_url_custom_expiry(self, storage_service_instance, mock_s3_client, mocker):
        """Test generating presigned upload URL with custom expiry"""
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.bucket = "test-bucket"
        mock_s3_client.generate_presigned_url.return_value = "http://example.com/upload"

        url = storage_service_instance.get_presigned_upload_url(
            "test/file.txt", "text/plain", expires_in=7200
        )

        mock_s3_client.generate_presigned_url.assert_called_once_with(
            "put_object",
            Params={
                "Bucket": "test-bucket",
                "Key": "test/file.txt",
                "ContentType": "text/plain",
            },
            ExpiresIn=7200,
        )


class TestStorageServiceConcurrency:
    """StorageService concurrency tests"""

    def test_client_thread_safety(self, storage_service_instance, mocker):
        """Test that client property is thread-safe"""
        mock_boto3 = mocker.patch("services.storage_service.boto3")
        mock_client = MagicMock()
        mock_boto3.client.return_value = mock_client

        # First access
        client1 = storage_service_instance.client
        # Second access should return same instance
        client2 = storage_service_instance.client

        assert client1 is client2
        mock_boto3.client.assert_called_once()

    def test_resource_thread_safety(self, storage_service_instance, mocker):
        """Test that resource property is thread-safe"""
        mock_boto3 = mocker.patch("services.storage_service.boto3")
        mock_resource = MagicMock()
        mock_boto3.resource.return_value = mock_resource

        # First access
        resource1 = storage_service_instance.resource
        # Second access should return same instance
        resource2 = storage_service_instance.resource

        assert resource1 is resource2
        mock_boto3.resource.assert_called_once()


class TestStorageServiceClientInitialization:
    """StorageService client initialization tests"""

    def test_client_initialization_failure(self, mocker):
        """Test client initialization failure"""
        mock_boto3 = mocker.patch("services.storage_service.boto3")
        mock_boto3.client.side_effect = Exception("Invalid credentials")

        service = StorageService()

        with pytest.raises(Exception):
            _ = service.client

    def test_resource_initialization_failure(self, mocker):
        """Test resource initialization failure"""
        mock_boto3 = mocker.patch("services.storage_service.boto3")
        mock_boto3.resource.side_effect = Exception("Invalid credentials")

        service = StorageService()

        with pytest.raises(Exception):
            _ = service.resource

    def test_client_with_path_style_addressing(self, mocker):
        """Test client with path-style addressing"""
        mock_boto3 = mocker.patch("services.storage_service.boto3")
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.force_path_style = True
        mock_settings.s3.endpoint = "localhost:9000"
        mock_settings.s3.access_key_id = "test-key"
        mock_settings.s3.access_key_secret = "test-secret"
        mock_settings.s3.region = "us-east-1"

        service = StorageService()
        _ = service.client

        call_kwargs = mock_boto3.client.call_args[1]
        assert call_kwargs["endpoint_url"] == "http://localhost:9000"

    def test_client_with_virtual_style_addressing(self, mocker):
        """Test client with virtual-hosted style addressing"""
        mock_boto3 = mocker.patch("services.storage_service.boto3")
        mock_settings = mocker.patch("services.storage_service.settings")
        mock_settings.s3.force_path_style = False
        mock_settings.s3.endpoint = "oss.example.com"
        mock_settings.s3.access_key_id = "test-key"
        mock_settings.s3.access_key_secret = "test-secret"
        mock_settings.s3.region = "us-east-1"

        service = StorageService()
        _ = service.client

        call_kwargs = mock_boto3.client.call_args[1]
        assert call_kwargs["endpoint_url"] == "http://oss.example.com"
