"""
Pytest configuration and fixtures for PDF splitting worker tests
"""

import asyncio
import json
import os
import tempfile
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
import pika
from PyPDF2 import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter


@pytest.fixture
def temp_dir():
    """Create a temporary directory for tests"""
    with tempfile.TemporaryDirectory() as temp_dir:
        yield temp_dir


@pytest.fixture
def sample_pdf(temp_dir):
    """Create a sample PDF file for testing"""
    pdf_path = os.path.join(temp_dir, 'sample.pdf')
    create_test_pdf(pdf_path, num_pages=10)
    return pdf_path


@pytest.fixture
def large_pdf(temp_dir):
    """Create a large PDF file for testing"""
    pdf_path = os.path.join(temp_dir, 'large.pdf')
    create_test_pdf(pdf_path, num_pages=100)
    return pdf_path


@pytest.fixture
def small_pdf(temp_dir):
    """Create a small PDF file for testing"""
    pdf_path = os.path.join(temp_dir, 'small.pdf')
    create_test_pdf(pdf_path, num_pages=2)
    return pdf_path


@pytest.fixture
def mock_rabbitmq_config():
    """Mock RabbitMQ configuration"""
    return {
        'host': 'localhost',
        'port': 5672,
        'username': 'guest',
        'password': 'guest',
        'virtual_host': '/',
        'url': 'amqp://guest:guest@localhost:5672/'
    }


@pytest.fixture
def mock_s3_config():
    """Mock S3/OSS configuration"""
    return {
        'bucket': 'test-bucket',
        'region': 'us-east-1',
        'access_key': 'test-key',
        'secret_key': 'test-secret',
        'endpoint': 's3.amazonaws.com'
    }


@pytest.fixture
def sample_splitting_message():
    """Sample PDF splitting request message"""
    return {
        'messageId': str(uuid.uuid4()),
        'timestamp': 1234567890,
        'eventType': 'PDF_SPLITTING_REQUEST',
        'itemId': 'test-item-123',
        's3Url': 'https://example.com/test.pdf',
        's3Key': 'test/test.pdf',
        'fileName': 'test.pdf',
        'pageCount': 10,
        'splitSize': 3,
        'priority': 'normal',
        'retryCount': 0,
        'maxRetries': 3
    }


@pytest.fixture
def mock_pika_connection():
    """Mock pika connection and channel"""
    mock_connection = MagicMock(spec=pika.BlockingConnection)
    mock_channel = MagicMock(spec=pika.channel.Channel)
    mock_connection.channel.return_value = mock_channel
    mock_connection.is_closed = False
    
    # Mock queue_declare to return a method with message_count
    mock_queue_result = MagicMock()
    mock_queue_result.method.message_count = 0
    mock_channel.queue_declare.return_value = mock_queue_result
    
    return mock_connection, mock_channel


@pytest.fixture
def mock_aiohttp_session():
    """Mock aiohttp ClientSession"""
    mock_session = MagicMock()
    mock_response = MagicMock()
    mock_response.status = 200
    mock_response.read = AsyncMock(return_value=b'mock pdf content')
    mock_session.get.return_value.__aenter__.return_value = mock_response
    return mock_session


@pytest.fixture
def mock_aiofiles():
    """Mock aiofiles for async file operations"""
    with patch('aiofiles.open') as mock_open:
        mock_file = MagicMock()
        mock_file.read = AsyncMock(return_value=b'mock pdf content')
        mock_file.write = AsyncMock()
        mock_open.return_value.__aenter__.return_value = mock_file
        yield mock_open


@pytest.fixture
def pdf_splitting_worker(mock_rabbitmq_config, mock_s3_config):
    """Create a PDF splitting worker instance with mocked dependencies"""
    from pdf_splitting_worker import PdfSplittingWorker
    
    with patch('pdf_splitting_worker.RabbitMQClient') as mock_rabbitmq_client_class:
        with patch('pdf_splitting_worker.S3StorageClient') as mock_s3_client_class:
            worker = PdfSplittingWorker(mock_rabbitmq_config, mock_s3_config)
            worker.rabbitmq_client = mock_rabbitmq_client_class.return_value
            worker.s3_client = mock_s3_client_class.return_value
            yield worker


@pytest.fixture
def event_loop():
    """Create an event loop for async tests"""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


def create_test_pdf(output_path: str, num_pages: int = 10):
    """Create a test PDF file with specified number of pages"""
    writer = PdfWriter()
    
    for i in range(num_pages):
        temp_pdf = tempfile.NamedTemporaryFile(suffix='.pdf', delete=False)
        try:
            c = canvas.Canvas(temp_pdf.name, pagesize=letter)
            c.drawString(100, 750, f"Test Page {i + 1}")
            c.drawString(100, 700, f"This is page {i + 1} of {num_pages}")
            c.drawString(100, 650, f"Content for page {i + 1}")
            c.save()
            
            with open(temp_pdf.name, 'rb') as f:
                temp_reader = PdfReader(f)
                if len(temp_reader.pages) > 0:
                    writer.add_page(temp_reader.pages[0])
        finally:
            os.unlink(temp_pdf.name)
    
    with open(output_path, 'wb') as f:
        writer.write(f)


@pytest.fixture
def mock_oss2():
    """Mock oss2 library for S3 operations"""
    mock_oss2 = MagicMock()
    mock_auth = MagicMock()
    mock_bucket = MagicMock()
    mock_oss2.Auth.return_value = mock_auth
    mock_oss2.Bucket.return_value = mock_bucket
    return mock_oss2


@pytest.fixture
def mock_environment():
    """Mock environment variables"""
    with patch.dict(os.environ, {
        'RABBITMQ_HOSTNAME': 'localhost',
        'RABBITMQ_PORT': '5672',
        'RABBITMQ_USERNAME': 'guest',
        'RABBITMQ_PASSWORD': 'guest',
        'RABBITMQ_VHOST': '/',
        'PYTHON_RABBITMQ_URL': 'amqp://guest:guest@localhost:5672/',
        'PDF_OSS_BUCKET_NAME': 'test-bucket',
        'OSS_REGION': 'us-east-1',
        'OSS_ACCESS_KEY_ID': 'test-key',
        'OSS_SECRET_ACCESS_KEY': 'test-secret',
        'S3_ENDPOINT': 's3.amazonaws.com',
        'SYSTEM_LOG_LEVEL': 'INFO',
        'MAX_RETRIES': '3',
        'TEMP_DIR': '/tmp/test'
    }):
        yield