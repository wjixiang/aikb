import boto3
import json
import logging
import os
from typing import Optional, TypedDict, Union
from botocore.exceptions import ClientError

class PDF_Chunk(TypedDict):
    """Type definition for PDF chunk data"""
    pass  # Actual fields should be defined based on usage

class ImageUploadData(TypedDict):
    """Data structure for image uploads"""
    image_data: bytes
    image_type: str

class S3StorageConfig(TypedDict, total=False):
    """Configuration for S3 storage"""
    region: str
    bucket_name: str
    access_key_id: str
    secret_access_key: str

class NotebookS3Storage:
    """S3 storage implementation for notebook chunks and images"""
    
    def __init__(self, config: Optional[S3StorageConfig] = None):
        """Initialize S3 client with config or environment variables"""
        config = config or {}
        self.region = config.get('region') or os.getenv('AWS_REGION')
        self.bucket_name = config.get('bucket_name') or os.getenv('AWS_S3_BUCKET_NAME_NOTEBOOK_CHUNK')
        access_key_id = config.get('access_key_id') or os.getenv('AWS_ACCESS_KEY_ID')
        secret_access_key = config.get('secret_access_key') or os.getenv('AWS_SECRET_ACCESS_KEY')

        if not self.region:
            raise ValueError('AWS_REGION environment variable is required')
        if not self.bucket_name:
            raise ValueError('AWS_S3_BUCKET_NAME environment variable is required')

        session_args = {
            'region_name': self.region,
            'endpoint_url': f'http://{self.region}.aliyuncs.com',
            'config': boto3.session.Config(
                signature_version='v4',
                s3={'addressing_style': 'virtual'},
                connect_timeout=30,
                retries={'max_attempts': 3}
            )
        }
        if access_key_id and secret_access_key:
            session_args['aws_access_key_id'] = access_key_id
            session_args['aws_secret_access_key'] = secret_access_key

        self.client = boto3.client('s3', **session_args)
        self.logger = logging.getLogger('notebook_s3_storage')

    async def upload_image(self, image: ImageUploadData, key: str) -> str:
        """Upload image to S3 and return its location"""
        try:
            self.client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=image['image_data'],
                ContentType=image['image_type']
            )
            self.logger.info(f'Successfully uploaded image: {key}')
            return f's3://{self.bucket_name}/{key}'
        except ClientError as e:
            self.logger.error(f'Failed to upload image {key}: {e}')
            raise

    async def get_chunk(self, key: str) -> PDF_Chunk:
        """Get PDF chunk from S3"""
        try:
            response = self.client.get_object(
                Bucket=self.bucket_name,
                Key=key
            )
            body = response['Body'].read().decode('utf-8')
            return json.loads(body)
        except ClientError as e:
            self.logger.error(f'Failed to get chunk {key}: {e}')
            raise
        except json.JSONDecodeError as e:
            self.logger.error(f'Failed to parse chunk {key}: {e}')
            raise

    async def delete_chunk(self, key: str) -> None:
        """Delete chunk from S3"""
        try:
            self.client.delete_object(
                Bucket=self.bucket_name,
                Key=key
            )
            self.logger.info(f'Successfully deleted chunk: {key}')
        except ClientError as e:
            self.logger.error(f'Failed to delete chunk {key}: {e}')
            raise

    async def get_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        """Generate presigned URL for S3 object"""
        try:
            url = self.client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': key
                },
                ExpiresIn=expires_in
            )
            self.logger.info(f'Generated presigned URL for {key} (expires in {expires_in}s)')
            return url
        except ClientError as e:
            self.logger.error(f'Failed to generate presigned URL for {key}: {e}')
            raise

    async def check_connection(self) -> bool:
        """Check if S3 connection is working"""
        try:
            # Simple operation to verify credentials and bucket access
            self.client.head_bucket(Bucket=self.bucket_name)
            return True
        except ClientError as e:
            self.logger.error(f'S3 connection check failed: {e}')
            return False
