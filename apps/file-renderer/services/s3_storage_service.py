"""
S3 Storage Service

Provides S3/MinIO storage operations for the document processing pipeline.
"""

import logging

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from config import settings

logger = logging.getLogger(__name__)


class S3StorageService:
    """S3 storage service for document processing"""

    def __init__(self):
        self._client = None

    @property
    def client(self):
        """Lazy-initialize boto3 S3 client"""
        if self._client is None:
            s3_config = Config(
                s3={
                    "addressing_style": "path" if settings.s3.force_path_style else "virtual",
                },
                signature_version="s3v4",
            )
            self._client = boto3.client(
                "s3",
                endpoint_url=f"http://{settings.s3.endpoint}",
                aws_access_key_id=settings.s3.access_key_id,
                aws_secret_access_key=settings.s3.access_key_secret,
                region_name=settings.s3.region,
                config=s3_config,
            )
        return self._client

    def upload(
        self,
        data: bytes | str,
        key: str,
        content_type: str = "application/octet-stream",
    ) -> str:
        """Upload data to S3, return the object URL"""
        if isinstance(data, str):
            data = data.encode("utf-8")

        key = self._normalize_key(key)

        self.client.put_object(
            Bucket=settings.s3.bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        logger.info(f"File uploaded: {key} ({len(data)} bytes)")
        return self._generate_url(key)

    def download(self, key: str) -> bytes:
        """Download file from S3 as bytes, raise FileNotFoundError if missing"""
        key = self._normalize_key(key)

        try:
            response = self.client.get_object(Bucket=settings.s3.bucket, Key=key)
            return response["Body"].read()
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            if error_code == "NoSuchKey":
                raise FileNotFoundError(f"S3 object not found: {key}")
            raise RuntimeError(f"Failed to download from S3: {e}") from e

    def download_to_file(self, key: str, file_path: str) -> None:
        """Download from S3 directly to a local file path (streaming, for large files)"""
        key = self._normalize_key(key)

        try:
            self.client.download_file(settings.s3.bucket, key, file_path)
            logger.debug(f"File downloaded to: {file_path}")
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            if error_code == "NoSuchKey":
                raise FileNotFoundError(f"S3 object not found: {key}")
            raise RuntimeError(f"Failed to download from S3: {e}") from e

    def delete(self, key: str) -> bool:
        """Delete object from S3"""
        key = self._normalize_key(key)
        self.client.delete_object(Bucket=settings.s3.bucket, Key=key)
        logger.info(f"File deleted: {key}")
        return True

    def exists(self, key: str) -> bool:
        """Check if object exists in S3"""
        key = self._normalize_key(key)
        try:
            self.client.head_object(Bucket=settings.s3.bucket, Key=key)
            return True
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            if error_code == "NoSuchKey" or error_code == "404":
                return False
            return False

    def get_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        """Generate a presigned download URL"""
        key = self._normalize_key(key)
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.s3.bucket, "Key": key},
            ExpiresIn=expires_in,
        )

    def get_file_size(self, key: str) -> int:
        """Get object size in bytes"""
        key = self._normalize_key(key)
        try:
            response = self.client.head_object(Bucket=settings.s3.bucket, Key=key)
            return response["ContentLength"]
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            if error_code == "NoSuchKey":
                raise FileNotFoundError(f"S3 object not found: {key}")
            raise RuntimeError(f"Failed to get file size: {e}") from e

    def bucket_exists(self) -> bool:
        """Check if the configured bucket is accessible"""
        try:
            self.client.head_bucket(Bucket=settings.s3.bucket)
            return True
        except ClientError:
            return False

    def _normalize_key(self, key: str) -> str:
        """Strip leading slashes from S3 key"""
        return key.lstrip("/")

    def _generate_url(self, key: str) -> str:
        """Generate direct access URL"""
        key = self._normalize_key(key)
        if settings.s3.force_path_style:
            return f"http://{settings.s3.endpoint}/{settings.s3.bucket}/{key}"
        return f"http://{settings.s3.bucket}.{settings.s3.endpoint}/{key}"


# Module-level singleton
_s3_storage_service: S3StorageService | None = None


def get_s3_storage_service() -> S3StorageService:
    """Get the S3 storage service singleton"""
    global _s3_storage_service
    if _s3_storage_service is None:
        _s3_storage_service = S3StorageService()
    return _s3_storage_service
