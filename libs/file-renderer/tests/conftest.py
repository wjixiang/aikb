"""
Pytest Configuration and Fixtures
"""

import io
import json
import uuid
from datetime import datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from config import Settings
from main import app
from models.file import FileMetadata, FileStatus, PaginationMode
from repositories.file_repository import FileRepository
from services.docling_service import DoclingService, ConversionResultData, ConversionStatus
from services.markdown_edit_service import MarkdownEditService
from services.markdown_service import MarkdownService
from services.pdf_cache_service import PdfCacheService
from services.pdf_service import PdfService
from services.storage_service import StorageService


# =============================================================================
# FastAPI Application Fixtures
# =============================================================================

@pytest.fixture
def app_instance() -> FastAPI:
    """FastAPI application instance"""
    return app


@pytest.fixture
def client(app_instance: FastAPI) -> TestClient:
    """FastAPI test client"""
    return TestClient(app_instance)


# =============================================================================
# Mock Storage Service Fixtures
# =============================================================================

@pytest.fixture
def mock_storage_service(mocker):
    """Mock StorageService with all methods"""
    mock = mocker.patch("services.storage_service.storage_service")

    # Configure default return values
    mock.upload.return_value = "http://example.com/test-file.txt"
    mock.download.return_value = b"Test file content"
    mock.delete.return_value = True
    mock.exists.return_value = True
    mock.get_presigned_url.return_value = "http://example.com/presigned?token=xxx"
    mock.get_presigned_upload_url.return_value = "http://example.com/upload?token=xxx"
    mock.get_file_size.return_value = 1024
    mock.get_modified_time.return_value = int(datetime.now().timestamp())
    mock.list_objects.return_value = ["test/file1.txt", "test/file2.txt"]
    mock.bucket_exists.return_value = True
    mock._generate_url.return_value = "http://example.com/test-file.txt"
    mock._normalize_key.return_value = "test/file.txt"
    mock.client = MagicMock()
    mock.client.copy_object.return_value = {}
    mock.client.head_object.return_value = {"ContentType": "text/plain", "ContentLength": 1024}

    return mock


@pytest.fixture
def mock_storage_service_not_found(mocker):
    """Mock StorageService that returns not found for exists checks"""
    mock = mocker.patch("services.storage_service.storage_service")
    mock.exists.return_value = False
    mock.get_file_size.side_effect = Exception("File not found")
    mock.download.side_effect = Exception("File not found")
    return mock


@pytest.fixture
def mock_storage_service_error(mocker):
    """Mock StorageService that raises errors"""
    mock = mocker.patch("services.storage_service.storage_service")
    mock.upload.side_effect = Exception("S3 upload error")
    mock.download.side_effect = Exception("S3 download error")
    mock.delete.side_effect = Exception("S3 delete error")
    mock.exists.side_effect = Exception("S3 error")
    return mock


@pytest.fixture
def mock_s3_client(mocker):
    """Mock boto3 S3 client"""
    mock_client = MagicMock()
    mock_boto3 = mocker.patch("services.storage_service.boto3")
    mock_boto3.client.return_value = mock_client

    # Configure default responses
    mock_client.put_object.return_value = {}
    mock_client.get_object.return_value = {"Body": io.BytesIO(b"test content")}
    mock_client.delete_object.return_value = {}
    mock_client.head_object.return_value = {"ContentLength": 1024}
    mock_client.generate_presigned_url.return_value = "http://example.com/presigned?token=xxx"
    mock_client.head_bucket.return_value = {}
    mock_client.list_objects_v2.return_value = {
        "Contents": [{"Key": "test/file1.txt"}, {"Key": "test/file2.txt"}]
    }

    return mock_client


# =============================================================================
# Mock Database Fixtures
# =============================================================================

@pytest.fixture
def mock_db_session(mocker):
    """Mock SQLAlchemy database session"""
    mock_session = MagicMock()
    mock_session_factory = mocker.patch("models.database.SessionLocal")
    mock_session_factory.return_value = mock_session

    # Configure query mock
    mock_query = MagicMock()
    mock_session.query.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.first.return_value = None
    mock_query.all.return_value = []

    return mock_session


@pytest.fixture
def mock_db_session_with_result(mocker):
    """Mock SQLAlchemy database session with query result"""
    mock_session = MagicMock()
    mock_session_factory = mocker.patch("models.database.SessionLocal")
    mock_session_factory.return_value = mock_session

    # Configure query mock with result
    mock_query = MagicMock()
    mock_session.query.return_value = mock_query
    mock_query.filter.return_value = mock_query

    # Create a mock result
    mock_result = MagicMock()
    mock_result.s3_key = "test/file.pdf"
    mock_result.file_name = "file.pdf"
    mock_result.file_size = 1024
    mock_result.modified_time = int(datetime.now().timestamp())
    mock_result.total_page = 5
    mock_result.pages = {"1": "Page 1 content", "2": "Page 2 content"}

    mock_query.first.return_value = mock_result
    mock_query.all.return_value = [mock_result]

    return mock_session


@pytest.fixture
def mock_pdf_cache_service(mocker):
    """Mock PdfCacheService"""
    mock = mocker.patch("services.pdf_cache_service.pdf_cache_service")

    mock.get_doc.return_value = None  # Default: no cache
    mock.set_doc.return_value = None
    mock.invalidate.return_value = None

    return mock


@pytest.fixture
def mock_pdf_cache_service_with_data(mocker):
    """Mock PdfCacheService with cached data"""
    mock = mocker.patch("services.pdf_cache_service.pdf_cache_service")

    # Mock a cached PDF document
    mock_doc = MagicMock()
    mock_doc.num_pages.return_value = 5
    mock_doc.export_to_markdown.side_effect = lambda page_no=0: f"Page {page_no} content"

    mock.get_doc.return_value = mock_doc
    mock.set_doc.return_value = None
    mock.invalidate.return_value = None

    return mock


# =============================================================================
# Mock Repository Fixtures
# =============================================================================

@pytest.fixture
def mock_file_repository(mocker):
    """Mock FileRepository"""
    mock = mocker.patch("repositories.file_repository.file_repository")

    mock.create = AsyncMock(return_value=None)
    mock.get = AsyncMock(return_value=None)
    mock.update = AsyncMock(return_value=None)
    mock.delete = AsyncMock(return_value=True)
    mock.list = AsyncMock(return_value=[])
    mock.exists = AsyncMock(return_value=False)

    return mock


# =============================================================================
# Sample Data Fixtures
# =============================================================================

@pytest.fixture
def sample_file_metadata():
    """Sample file metadata"""
    return FileMetadata(
        file_id=str(uuid.uuid4()),
        original_name="test.pdf",
        s3_key="files/pdf/2026/03/15/test-uuid/test.pdf",
        content_type="application/pdf",
        file_size=1024,
        status=FileStatus.COMPLETED,
        page_count=10,
        page_size=4000,
        pagination_mode=PaginationMode.FIXED,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )


@pytest.fixture
def sample_text_file_metadata():
    """Sample text file metadata"""
    return FileMetadata(
        file_id=str(uuid.uuid4()),
        original_name="test.txt",
        s3_key="files/text/2026/03/15/test-uuid/test.txt",
        content_type="text/plain",
        file_size=256,
        status=FileStatus.COMPLETED,
        page_count=1,
        page_size=4000,
        pagination_mode=PaginationMode.FIXED,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )


@pytest.fixture
def sample_json_file_metadata():
    """Sample JSON file metadata"""
    return FileMetadata(
        file_id=str(uuid.uuid4()),
        original_name="test.json",
        s3_key="files/json/2026/03/15/test-uuid/test.json",
        content_type="application/json",
        file_size=512,
        status=FileStatus.COMPLETED,
        page_count=1,
        page_size=4000,
        pagination_mode=PaginationMode.FIXED,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )


@pytest.fixture
def sample_markdown_file_metadata():
    """Sample markdown file metadata"""
    return FileMetadata(
        file_id=str(uuid.uuid4()),
        original_name="test.md",
        s3_key="files/markdown/2026/03/15/test-uuid/test.md",
        content_type="text/markdown",
        file_size=2048,
        status=FileStatus.COMPLETED,
        page_count=3,
        page_size=4000,
        pagination_mode=PaginationMode.FIXED,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )


@pytest.fixture
def sample_file_metadatas():
    """Sample list of file metadata"""
    return [
        FileMetadata(
            file_id=str(uuid.uuid4()),
            original_name=f"test{i}.pdf",
            s3_key=f"files/pdf/2026/03/15/test-uuid/test{i}.pdf",
            content_type="application/pdf",
            file_size=1024 * i,
            status=FileStatus.COMPLETED,
            page_count=10,
            page_size=4000,
            pagination_mode=PaginationMode.FIXED,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        for i in range(1, 4)
    ]


@pytest.fixture
def sample_markdown_content():
    """Sample markdown content"""
    return """# Heading 1

This is paragraph 1.

## Heading 2

This is paragraph 2.
- List item 1
- List item 2
- List item 3

### Heading 3

This is paragraph 3.
"""


@pytest.fixture
def sample_large_markdown_content():
    """Sample large markdown content for pagination testing"""
    lines = []
    for i in range(100):
        lines.append(f"Line {i}: This is test content for pagination testing.")
    return "\n".join(lines)


@pytest.fixture
def sample_pdf_content():
    """Sample PDF binary content"""
    return b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\nxref\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF"


@pytest.fixture
def sample_text_content():
    """Sample text content"""
    return "This is sample text content for testing.\nIt has multiple lines.\n"


@pytest.fixture
def sample_json_content():
    """Sample JSON content"""
    return json.dumps({
        "name": "test",
        "value": 123,
        "nested": {"key": "value"},
        "array": [1, 2, 3]
    }, indent=2)


@pytest.fixture
def sample_csv_content():
    """Sample CSV content"""
    return "name,age,city\nAlice,30,New York\nBob,25,Los Angeles\nCharlie,35,Chicago\n"


@pytest.fixture
def sample_xml_content():
    """Sample XML content"""
    return """<?xml version="1.0" encoding="UTF-8"?>
<root>
    <item id="1">Content 1</item>
    <item id="2">Content 2</item>
</root>
"""


@pytest.fixture
def sample_html_content():
    """Sample HTML content"""
    return """<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
    <h1>Hello World</h1>
    <p>This is a test paragraph.</p>
</body>
</html>
"""


@pytest.fixture
def sample_binary_content():
    """Sample binary content"""
    return b"\x00\x01\x02\x03\xff\xfe\xfd\xfc"


@pytest.fixture
def sample_tex_content():
    """Sample TeX content"""
    return r"""\documentclass{article}
\begin{document}
\section{Introduction}
This is a test document.
\end{document}
"""


# =============================================================================
# Service Instance Fixtures
# =============================================================================

@pytest.fixture
def storage_service_instance():
    """Create a fresh StorageService instance"""
    return StorageService()


@pytest.fixture
def markdown_service_instance():
    """Create a fresh MarkdownService instance"""
    return MarkdownService()


@pytest.fixture
def markdown_edit_service_instance():
    """Create a fresh MarkdownEditService instance"""
    return MarkdownEditService()


@pytest.fixture
def pdf_service_instance():
    """Create a fresh PdfService instance"""
    return PdfService()


@pytest.fixture
def pdf_cache_service_instance():
    """Create a fresh PdfCacheService instance"""
    return PdfCacheService()


@pytest.fixture
def file_repository_instance():
    """Create a fresh FileRepository instance"""
    return FileRepository()


# =============================================================================
# Authentication Fixtures
# =============================================================================

@pytest.fixture
def auth_headers():
    """Sample authentication headers"""
    return {
        "Authorization": "Bearer test-token",
        "X-API-Key": "test-api-key",
    }


@pytest.fixture
def auth_headers_invalid():
    """Invalid authentication headers"""
    return {
        "Authorization": "Bearer invalid-token",
    }


# =============================================================================
# Settings Fixtures
# =============================================================================

@pytest.fixture
def mock_settings(mocker):
    """Mock application settings"""
    mock = mocker.patch("config.settings")
    mock.app_name = "File Renderer Test"
    mock.app_version = "0.0.1"
    mock.debug = True
    mock.s3.bucket = "test-bucket"
    mock.s3.endpoint = "localhost:9000"
    mock.s3.access_key_id = "test-key"
    mock.s3.access_key_secret = "test-secret"
    mock.s3.region = "us-east-1"
    mock.s3.force_path_style = True
    mock.pagination.default_page_size = 4000
    mock.pagination.max_page_size = 10000
    mock.conversion.max_file_size = 100 * 1024 * 1024  # 100MB
    return mock


# =============================================================================
# Helper Functions
# =============================================================================

def assert_success_response(data: dict, expected_keys: list[str] = None):
    """Assert that a response is successful and contains expected keys"""
    assert data.get("success") is True, f"Expected success=True, got: {data}"
    if expected_keys:
        for key in expected_keys:
            assert key in data, f"Expected key '{key}' in response: {data}"


def assert_error_response(data: dict, expected_status_code: int = None):
    """Assert that a response is an error"""
    if "success" in data:
        assert data.get("success") is False, f"Expected success=False, got: {data}"


def create_test_file_metadata(
    file_id: str = None,
    original_name: str = "test.txt",
    content_type: str = "text/plain",
    file_size: int = 1024,
    status: FileStatus = FileStatus.COMPLETED,
) -> FileMetadata:
    """Helper to create test file metadata"""
    return FileMetadata(
        file_id=file_id or str(uuid.uuid4()),
        original_name=original_name,
        s3_key=f"files/{content_type.split('/')[-1]}/2026/03/15/{file_id or str(uuid.uuid4())[:8]}/{original_name}",
        content_type=content_type,
        file_size=file_size,
        status=status,
        page_count=1,
        page_size=4000,
        pagination_mode=PaginationMode.FIXED,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )


# =============================================================================
# Mock External Libraries
# =============================================================================

@pytest.fixture
def mock_docling_converter(mocker):
    """Mock Docling DocumentConverter"""
    mock_converter_class = mocker.patch("services.pdf_service.DocumentConverter")
    mock_converter = MagicMock()
    mock_converter_class.return_value = mock_converter

    # Mock document result
    mock_result = MagicMock()
    mock_doc = MagicMock()
    mock_doc.num_pages.return_value = 5
    mock_doc.export_to_markdown.side_effect = lambda page_no: f"Page {page_no} content"

    mock_result.document = mock_doc
    mock_converter.convert.return_value = mock_result

    return mock_converter


@pytest.fixture
def mock_docling_document_stream(mocker):
    """Mock Docling DocumentStream"""
    mock_stream_class = mocker.patch("services.pdf_service.DocumentStream")
    mock_stream = MagicMock()
    mock_stream_class.return_value = mock_stream
    return mock_stream


# =============================================================================
# Docling Service Fixtures
# =============================================================================

@pytest.fixture
def mock_docling_service(mocker):
    """Mock DoclingService"""
    mock = mocker.patch("services.docling_service.docling_service")

    # Configure default return values
    mock.convert_file.return_value = ConversionResultData(
        s3_key="test/document.pdf",
        file_name="document.pdf",
        file_size=1024,
        file_type="pdf",
        status=ConversionStatus.SUCCESS,
        total_pages=5,
        pages={"1": "Page 1 content", "2": "Page 2 content"},
        full_text="Page 1 content\n\nPage 2 content",
    )
    mock.get_text_content.return_value = "Full document text content"
    mock.get_page_content.return_value = "Page content"
    mock.get_conversion_status.return_value = ConversionStatus.SUCCESS
    mock.get_all_pages.return_value = {"1": "Page 1", "2": "Page 2"}
    mock.invalidate_cache.return_value = True
    mock.get_supported_formats.return_value = {
        "pdf": [".pdf"],
        "microsoft_office": [".docx", ".pptx", ".xlsx"],
        "text": [".txt", ".md", ".csv", ".html"],
        "image": [".png", ".jpg"],
        "other": [".json"],
    }

    return mock


@pytest.fixture
def mock_docling_service_not_found(mocker):
    """Mock DoclingService that returns not found"""
    mock = mocker.patch("services.docling_service.docling_service")
    mock.convert_file.return_value = ConversionResultData(
        s3_key="test/missing.pdf",
        file_name="missing.pdf",
        file_size=0,
        file_type="pdf",
        status=ConversionStatus.NOT_FOUND,
        error_message="File not found",
    )
    mock.get_text_content.side_effect = ValueError("File not found")
    mock.get_page_content.side_effect = ValueError("File not found")
    mock.get_conversion_status.return_value = ConversionStatus.NOT_FOUND
    mock.get_all_pages.side_effect = ValueError("File not found")

    return mock


@pytest.fixture
def mock_docling_service_failed(mocker):
    """Mock DoclingService that returns failed conversion"""
    mock = mocker.patch("services.docling_service.docling_service")
    mock.convert_file.return_value = ConversionResultData(
        s3_key="test/corrupt.pdf",
        file_name="corrupt.pdf",
        file_size=1024,
        file_type="pdf",
        status=ConversionStatus.FAILED,
        error_message="Conversion failed",
    )
    mock.get_text_content.side_effect = ValueError("Failed to convert file: Conversion failed")
    mock.get_page_content.side_effect = ValueError("Failed to convert file: Conversion failed")

    return mock


@pytest.fixture
def docling_service_instance():
    """Create a fresh DoclingService instance"""
    return DoclingService()
