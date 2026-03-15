"""
Storage Service - S3存储服务
"""

import io
from typing import Optional

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from config import settings


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
            self._client = boto3.client(
                "s3",
                endpoint_url=f"http://{settings.s3.endpoint}",
                aws_access_key_id=settings.s3.access_key_id,
                aws_secret_access_key=settings.s3.access_key_secret,
                region_name=settings.s3.region,
                config=config,
            )
        return self._client

    @property
    def resource(self):
        """获取S3资源对象"""
        if self._resource is None:
            self._resource = boto3.resource(
                "s3",
                endpoint_url=f"http://{settings.s3.endpoint}",
                aws_access_key_id=settings.s3.access_key_id,
                aws_secret_access_key=settings.s3.access_key_secret,
                region_name=settings.s3.region,
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
        """
        if isinstance(data, str):
            data = data.encode("utf-8")

        key = self._normalize_key(key)
        self.client.put_object(
            Bucket=settings.s3.bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )

        return self._generate_url(key)

    def download(self, key: str) -> bytes:
        """
        从S3下载文件

        Args:
            key: S3存储路径

        Returns:
            文件内容
        """
        key = self._normalize_key(key)
        response = self.client.get_object(
            Bucket=settings.s3.bucket,
            Key=key,
        )
        return response["Body"].read()

    def delete(self, key: str) -> bool:
        """
        删除S3文件

        Args:
            key: S3存储路径

        Returns:
            是否删除成功
        """
        key = self._normalize_key(key)
        self.client.delete_object(
            Bucket=settings.s3.bucket,
            Key=key,
        )
        return True

    def get_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        """
        获取预签名下载URL

        Args:
            key: S3存储路径
            expires_in: 过期时间(秒)

        Returns:
            预签名URL
        """
        return self.client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": settings.s3.bucket,
                "Key": key,
            },
            ExpiresIn=expires_in,
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
        """
        return self.client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": settings.s3.bucket,
                "Key": key,
                "ContentType": content_type,
            },
            ExpiresIn=expires_in,
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
        except ClientError:
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
        """
        key = self._normalize_key(key)
        response = self.client.head_object(
            Bucket=settings.s3.bucket,
            Key=key,
        )
        return response["ContentLength"]

    def get_modified_time(self, key: str) -> int:
        """
        获取文件修改时间戳

        Args:
            key: S3存储路径

        Returns:
            文件修改时间戳（秒）
        """
        key = self._normalize_key(key)
        response = self.client.head_object(
            Bucket=settings.s3.bucket,
            Key=key,
        )
        # 转换为时间戳
        return int(response["LastModified"].timestamp())

    def list_objects(self, prefix: str = "") -> list[str]:
        """
        列出指定前缀的文件

        Args:
            prefix: 文件前缀

        Returns:
            文件key列表
        """
        response = self.client.list_objects_v2(
            Bucket=settings.s3.bucket,
            Prefix=prefix,
        )
        return [obj["Key"] for obj in response.get("Contents", [])]

    def bucket_exists(self) -> bool:
        """检查存储桶是否存在"""
        try:
            self.client.head_bucket(Bucket=settings.s3.bucket)
            return True
        except ClientError:
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
