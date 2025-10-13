"""
Configuration module for PDF processing workers
"""

import os
from typing import Dict, Any
from pathlib import Path

# Load environment variables from .env file
env_file = Path(__file__).parent.parent / '.env'
if env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(env_file)


class Config:
    """Configuration class for PDF processing workers"""
    
    # RabbitMQ configuration (matching existing project env variables)
    RABBITMQ_HOST = os.getenv('RABBITMQ_HOSTNAME', 'rabbitmq')  # Use RABBITMQ_HOSTNAME from existing .env
    RABBITMQ_PORT = int(os.getenv('RABBITMQ_PORT', 5672))
    RABBITMQ_USERNAME = os.getenv('RABBITMQ_USERNAME', 'admin')  # Match TypeScript default
    RABBITMQ_PASSWORD = os.getenv('RABBITMQ_PASSWORD', 'admin123')  # Match TypeScript default
    RABBITMQ_VHOST = os.getenv('RABBITMQ_VHOST', 'my_vhost')  # Match TypeScript default
    RABBITMQ_URL = os.getenv('PYTHON_RABBITMQ_URL', f'amqp://{RABBITMQ_USERNAME}:{RABBITMQ_PASSWORD}@{RABBITMQ_HOST}:{RABBITMQ_PORT}/{RABBITMQ_VHOST}')
    
    # S3/OSS configuration (matching existing project env variables)
    S3_BUCKET = os.getenv('PDF_OSS_BUCKET_NAME', 'aikb-pdf')  # Use PDF_OSS_BUCKET_NAME from existing .env
    S3_REGION = os.getenv('OSS_REGION', 'oss-cn-beijing')  # Use OSS_REGION from existing .env
    S3_ACCESS_KEY = os.getenv('OSS_ACCESS_KEY_ID', '')  # Use OSS_ACCESS_KEY_ID from existing .env
    S3_SECRET_KEY = os.getenv('OSS_SECRET_ACCESS_KEY', '')  # Use OSS_SECRET_ACCESS_KEY from existing .env
    S3_ENDPOINT = os.getenv('S3_ENDPOINT', 'aliyuncs.com')  # Use S3_ENDPOINT from existing .env
    
    # PDF processing configuration (matching existing project constants)
    DEFAULT_SPLIT_SIZE = 25  # Matches PDF_PROCESSING_CONFIG.DEFAULT_SPLIT_SIZE in TypeScript
    MAX_SPLIT_SIZE = 100     # Matches PDF_PROCESSING_CONFIG.MAX_SPLIT_SIZE in TypeScript
    MIN_SPLIT_SIZE = 10      # Matches PDF_PROCESSING_CONFIG.MIN_SPLIT_SIZE in TypeScript
    CONCURRENT_PART_PROCESSING = 3  # Matches PDF_PROCESSING_CONFIG.CONCURRENT_PART_PROCESSING in TypeScript
    
    # Worker configuration
    WORKER_ID = os.getenv('WORKER_ID', f'pdf-splitting-worker-{os.getpid()}')
    LOG_LEVEL = os.getenv('SYSTEM_LOG_LEVEL', 'INFO')  # Use SYSTEM_LOG_LEVEL from existing .env
    MAX_RETRIES = int(os.getenv('MAX_RETRIES', 3))
    
    # Temporary directory configuration
    TEMP_DIR = os.getenv('TEMP_DIR', '/tmp/pdf-processing')
    
    # Elasticsearch configuration
    ELASTICSEARCH_LOGGING_ENABLED = os.getenv('ELASTICSEARCH_LOGGING_ENABLED', 'false').lower() == 'true'
    ELASTICSEARCH_LOG_LEVEL = os.getenv('ELASTICSEARCH_LOG_LEVEL', LOG_LEVEL.lower())
    ELASTICSEARCH_URL = os.getenv('ELASTICSEARCH_URL', 'http://localhost:9200')
    ELASTICSEARCH_USERNAME = os.getenv('ELASTICSEARCH_USERNAME', 'elastic')
    ELASTICSEARCH_PASSWORD = os.getenv('ELASTICSEARCH_PASSWORD', 'changeme')
    ELASTICSEARCH_API_KEY = os.getenv('ELASTICSEARCH_API_KEY', '')
    ELASTICSEARCH_VERIFY_SSL = os.getenv('ELASTICSEARCH_VERIFY_SSL', 'true').lower() == 'true'
    ELASTICSEARCH_LOG_INDEX = os.getenv('ELASTICSEARCH_LOG_INDEX', 'logs')
    ELASTICSEARCH_LOG_INDEX_PATTERN = os.getenv('ELASTICSEARCH_LOG_INDEX_PATTERN', 'logs-YYYY.MM.DD')
    SERVICE_NAME = os.getenv('SERVICE_NAME', 'pdf-splitting-worker')
    ENVIRONMENT = os.getenv('NODE_ENV', 'development')
    
    @classmethod
    def get_rabbitmq_config(cls) -> Dict[str, Any]:
        """Get RabbitMQ configuration as a dictionary"""
        return {
            'host': cls.RABBITMQ_HOST,
            'port': cls.RABBITMQ_PORT,
            'username': cls.RABBITMQ_USERNAME,
            'password': cls.RABBITMQ_PASSWORD,
            'virtual_host': cls.RABBITMQ_VHOST,
            'url': cls.RABBITMQ_URL,
        }
    
    @classmethod
    def get_s3_config(cls) -> Dict[str, Any]:
        """Get S3/OSS configuration as a dictionary"""
        return {
            'bucket': cls.S3_BUCKET,
            'region': cls.S3_REGION,
            'access_key': cls.S3_ACCESS_KEY,
            'secret_key': cls.S3_SECRET_KEY,
            'endpoint': cls.S3_ENDPOINT,
        }
    
    @classmethod
    def get_pdf_processing_config(cls) -> Dict[str, Any]:
        """Get PDF processing configuration as a dictionary"""
        return {
            'default_split_size': cls.DEFAULT_SPLIT_SIZE,
            'max_split_size': cls.MAX_SPLIT_SIZE,
            'min_split_size': cls.MIN_SPLIT_SIZE,
            'concurrent_part_processing': cls.CONCURRENT_PART_PROCESSING,
        }
    
    @classmethod
    def get_worker_config(cls) -> Dict[str, Any]:
        """Get worker configuration as a dictionary"""
        return {
            'worker_id': cls.WORKER_ID,
            'log_level': cls.LOG_LEVEL,
            'max_retries': cls.MAX_RETRIES,
            'temp_dir': cls.TEMP_DIR,
        }
    
    @classmethod
    def get_elasticsearch_config(cls) -> Dict[str, Any]:
        """Get Elasticsearch configuration as a dictionary"""
        return {
            'enabled': cls.ELASTICSEARCH_LOGGING_ENABLED,
            'log_level': cls.ELASTICSEARCH_LOG_LEVEL,
            'url': cls.ELASTICSEARCH_URL,
            'username': cls.ELASTICSEARCH_USERNAME,
            'password': cls.ELASTICSEARCH_PASSWORD,
            'api_key': cls.ELASTICSEARCH_API_KEY,
            'verify_ssl': cls.ELASTICSEARCH_VERIFY_SSL,
            'index_name': cls.ELASTICSEARCH_LOG_INDEX,
            'index_pattern': cls.ELASTICSEARCH_LOG_INDEX_PATTERN,
            'service_name': cls.SERVICE_NAME,
            'environment': cls.ENVIRONMENT,
        }