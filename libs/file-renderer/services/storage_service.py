"""
Storage Service - S3存储服务
"""

import io
from typing import Optional

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from config import settings
from lib.exceptions import (
    FileNotFoundException,
    StorageDeleteException,
    StorageDownloadException,
    StorageException,
    StorageUploadException,
)
from lib.logging_config import get_logger

logger = get_logger(__name__)


class StorageService:
    """S3存储服务"""

    def __init__(self):
        self._client = None
        self._resource = None

    @property
    def client(self):
        """获取S3客户端"""
        if self._client is None:
            config = Config(
                s3={
                    "addressing_style": "path" if settings.s3.force_path_style else "virtual"
                },
                signature_version="s3v4",
            )
            try:
                self._client = boto3.client(
                    "s3",
                    endpoint_url=f"http://{settings.s3.endpoint}",
                    aws_access_key_id=settings.s3.access_key_id,
                    aws_secret_access_key=settings.s3.access_key_secret,
                    region_name=settings.s3.region,
                    config=config,
                )
            except Exception as e:
                logger.error(f"Failed to create S3 client: {e}", exc_info=True)
                raise StorageException(
                    message=f"Failed to initialize S3 client: {str(e)}",
                    details={"endpoint": settings.s3.endpoint, "region": settings.s3.region},
                )
        return self._client

    @property
    def resource(self):
        """获取S3资源对象"""
        if self._resource is None:
            try:
                self._resource = boto3.resource(
                    "s3",
                    endpoint_url=f"http://{settings.s3.endpoint}",
                    aws_access_key_id=settings.s3.access_key_id,
                    aws_secret_access_key=settings.s3.access_key_secret,
                    region_name=settings.s3.region,
                )
            except Exception as e:
                logger.error(f"Failed to create S3 resource: {e}", exc_info=True)
                raise StorageException(
                    message=f"Failed to initialize S3 resource: {str(e)}",
                    details={"endpoint": settings.s3.endpoint},
                )
        return self._resource

    def upload(
        self,
        data: bytes | str,
        key: str,
        content_type: str = "application/octet-stream",
    ) -> str:
        """
        上传文件到S3

        Args:
            data: 文件内容
            key: S3存储路径
            content_type: 内容类型

        Returns:
            文件的公开访问URL

        Raises:
            StorageUploadException: 上传失败
        """
        if isinstance(data, str):
            data = data.encode("utf-8")

        key = self._normalize_key(key)

        try:
            self.client.put_object(
                Bucket=settings.s3.bucket,
                Key=key,
                Body=data,
                ContentType=content_type,
            )
            logger.info(f"File uploaded successfully: {key}", extra={"s3_key": key, "size": len(data)})
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            error_message = e.response.get("Error", {}).get("Message", str(e))
            logger.error(
                f"Failed to upload file: {error_code} - {error_message}",
                extra={"s3_key": key, "error_code": error_code},
                exc_info=True,
            )
            raise StorageUploadException(
                message=f"Failed to upload file: {error_message}",
                details={"s3_key": key, "error_code": error_code},
            )
        except Exception as e:
            logger.error(f"Unexpected error during upload: {e}", extra={"s3_key": key}, exc_info=True)
            raise StorageUploadException(
                message=f"Unexpected error during upload: {str(e)}",
                details={"s3_key": key},
            )

        return self._generate_url(key)

    def download(self, key: str) -> bytes:
        """
        从S3下载文件

        Args:
            key: S3存储路径

        Returns:
            文件内容

        Raises:
            FileNotFoundException: 文件不存在
            StorageDownloadException: 下载失败
        """
        key = self._normalize_key(key)

        try:
            response = self.client.get_object(
                Bucket=settings.s3.bucket,
                Key=key,
            )
            data = response["Body"].read()
            logger.debug(f"File downloaded successfully: {key}", extra={"s3_key": key, "size": len(data)})
            return data
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            error_message = e.response.get("Error", {}).get("Message", str(e))

            if error_code == "NoSuchKey":
                logger.warning(f"File not found in storage: {key}", extra={"s3_key": key})
                raise FileNotFoundException(s3_key=key)

            logger.error(
                f"Failed to download file: {error_code} - {error_message}",
                extra={"s3_key": key, "error_code": error_code},
                exc_info=True,
            )
            raise StorageDownloadException(
                message=f"Failed to download file: {error_message}",
                details={"s3_key": key, "error_code": error_code},
            )
        except Exception as e:
            logger.error(f"Unexpected error during download: {e}", extra={"s3_key": key}, exc_info=True)
            raise StorageDownloadException(
                message=f"Unexpected error during download: {str(e)}",
                details={"s3_key": key},
            )

    def delete(self, key: str) -> bool:
        """
        删除S3文件

        Args:
            key: S3存储路径

        Returns:
            是否删除成功

        Raises:
            StorageDeleteException: 删除失败
        """
        key = self._normalize_key(key)

        try:
            self.client.delete_object(
                Bucket=settings.s3.bucket,
                Key=key,
            )
            logger.info(f"File deleted successfully: {key}", extra={"s3_key": key})
            return True
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            error_message = e.response.get("Error", {}).get("Message", str(e))
            logger.error(
                f"Failed to delete file: {error_code} - {error_message}",
                extra={"s3_key": key, "error_code": error_code},
                exc_info=True,
            )
            raise StorageDeleteException(
                message=f"Failed to delete file: {error_message}",
                details={"s3_key": key, "error_code": error_code},
            )
        except Exception as e:
            logger.error(f"Unexpected error during delete: {e}", extra={"s3_key": key}, exc_info=True)
            raise StorageDeleteException(
                message=f"Unexpected error during delete: {str(e)}",
                details={"s3_key": key},
            )

    def get_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        """
        获取预签名下载URL

        Args:
            key: S3存储路径
            expires_in: 过期时间(秒)

        Returns:
            预签名URL

        Raises:
            StorageException: 生成失败
        """
        key = self._normalize_key(key)

        try:
            return self.client.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": settings.s3.bucket,
                    "Key": key,
                },
                ExpiresIn=expires_in,
            )
        except Exception as e:
            logger.error(
                f"Failed to generate presigned URL: {e}",
                extra={"s3_key": key, "expires_in": expires_in},
                exc_info=True,
            )
            raise StorageException(
                message=f"Failed to generate presigned URL: {str(e)}",
                details={"s3_key": key, "expires_in": expires_in},
            )

    def get_presigned_upload_url(
        self, key: str, content_type: str = "application/octet-stream", expires_in: int = 3600
    ) -> str:
        """
        获取预签名上传URL

        Args:
            key: S3存储路径
            content_type: 内容类型
            expires_in: 过期时间(秒)

        Returns:
            预签名上传URL

        Raises:
            StorageException: 生成失败
        """
        key = self._normalize_key(key)

        try:
            return self.client.generate_presigned_url(
                "put_object",
                Params={
                    "Bucket": settings.s3.bucket,
                    "Key": key,
                    "ContentType": content_type,
                },
                ExpiresIn=expires_in,
            )
        except Exception as e:
            logger.error(
                f"Failed to generate presigned upload URL: {e}",
                extra={"s3_key": key, "content_type": content_type, "expires_in": expires_in},
                exc_info=True,
            )
            raise StorageException(
                message=f"Failed to generate presigned upload URL: {str(e)}",
                details={"s3_key": key, "content_type": content_type, "expires_in": expires_in},
            )

    def exists(self, key: str) -> bool:
        """
        检查文件是否存在

        Args:
            key: S3存储路径

        Returns:
            文件是否存在
        """
        key = self._normalize_key(key)
        try:
            self.client.head_object(
                Bucket=settings.s3.bucket,
                Key=key,
            )
            return True
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            if error_code == "NoSuchKey":
                return False
            logger.warning(
                f"Error checking file existence: {error_code}",
                extra={"s3_key": key, "error_code": error_code},
            )
            return False
        except Exception as e:
            logger.error(f"Error checking file existence: {e}", extra={"s3_key": key})
            return False

    def _normalize_key(self, key: str) -> str:
        """规范化 S3 key，去除前导斜杠"""
        return key.lstrip("/")

    def get_file_size(self, key: str) -> int:
        """
        获取文件大小

        Args:
            key: S3存储路径

        Returns:
            文件大小（字节）

        Raises:
            FileNotFoundException: 文件不存在
            StorageException: 获取失败
        """
        key = self._normalize_key(key)

        try:
            response = self.client.head_object(
                Bucket=settings.s3.bucket,
                Key=key,
            )
            return response["ContentLength"]
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            if error_code == "NoSuchKey":
                raise FileNotFoundException(s3_key=key)

            error_message = e.response.get("Error", {}).get("Message", str(e))
            raise StorageException(
                message=f"Failed to get file size: {error_message}",
                details={"s3_key": key, "error_code": error_code},
            )

    def get_modified_time(self, key: str) -> int:
        """
        获取文件修改时间戳

        Args:
            key: S3存储路径

        Returns:
            文件修改时间戳（秒）

        Raises:
            FileNotFoundException: 文件不存在
            StorageException: 获取失败
        """
        key = self._normalize_key(key)

        try:
            response = self.client.head_object(
                Bucket=settings.s3.bucket,
                Key=key,
            )
            return int(response["LastModified"].timestamp())
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            if error_code == "NoSuchKey":
                raise FileNotFoundException(s3_key=key)

            error_message = e.response.get("Error", {}).get("Message", str(e))
            raise StorageException(
                message=f"Failed to get file modification time: {error_message}",
                details={"s3_key": key, "error_code": error_code},
            )

    def list_objects(self, prefix: str = "") -> list[str]:
        """
        列出指定前缀的文件

        Args:
            prefix: 文件前缀

        Returns:
            文件key列表

        Raises:
            StorageException: 列出失败
        """
        try:
            response = self.client.list_objects_v2(
                Bucket=settings.s3.bucket,
                Prefix=prefix,
            )
            return [obj["Key"] for obj in response.get("Contents", [])]
        except Exception as e:
            logger.error(
                f"Failed to list objects: {e}",
                extra={"prefix": prefix},
                exc_info=True,
            )
            raise StorageException(
                message=f"Failed to list objects: {str(e)}",
                details={"prefix": prefix},
            )

    def bucket_exists(self) -> bool:
        """检查存储桶是否存在"""
        try:
            self.client.head_bucket(Bucket=settings.s3.bucket)
            return True
        except ClientError:
            return False
        except Exception as e:
            logger.error(f"Error checking bucket existence: {e}")
            return False

    def _generate_url(self, key: str) -> str:
        """生成公开访问URL"""
        key = self._normalize_key(key)
        if settings.s3.force_path_style:
            return f"http://{settings.s3.endpoint}/{settings.s3.bucket}/{key}"
        else:
            return f"http://{settings.s3.bucket}.{settings.s3.endpoint}/{key}"


# 全局服务实例
storage_service = StorageService()
