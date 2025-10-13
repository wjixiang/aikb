# PDF Splitting Worker Test Suite

This directory contains a comprehensive pytest test suite for the Python PDF Splitting Worker.

## Files Overview

### Test Files
- [`test_pdf_splitting_comprehensive.py`](test_pdf_splitting_comprehensive.py) - Main comprehensive test suite covering all scenarios
- [`conftest.py`](conftest.py) - Pytest configuration with shared fixtures and mocks
- [`pytest.ini`](pytest.ini) - Pytest configuration file

### Test Runner
- [`run_tests.py`](run_tests.py) - Simple script to run the test suite

### Legacy Test Files
- [`test_pdf_functionality.py`](test_pdf_functionality.py) - Basic functionality tests
- [`test_pdf_splitting.py`](test_pdf_splitting.py) - PDF splitting tests
- [`test_rabbitmq_connection.py`](test_rabbitmq_connection.py) - RabbitMQ connection tests

## Test Coverage

The comprehensive test suite covers the following scenarios:

### 1. PDF Splitting Workflow
- **Normal case**: Standard PDF splitting with all components working
- **Large file handling**: Processing PDFs with many pages (100+ pages)
- **Small file handling**: Processing PDFs with few pages (1-5 pages)

### 2. S3/OSS Operations
- **Download failures**: Handling S3/OSS download errors
- **Partial upload failures**: Handling failures when uploading split parts
- **Mock uploads**: Testing with and without real S3/OSS credentials

### 3. RabbitMQ Operations
- **Connection failures**: Handling RabbitMQ connection errors
- **Message publish failures**: Handling message publishing errors
- **Message processing**: Testing various message formats and edge cases

### 4. Error Handling
- **Invalid JSON messages**: Handling malformed message payloads
- **Missing fields**: Handling incomplete message data
- **Retry mechanisms**: Testing automatic retry logic
- **Error recovery**: Testing recovery from temporary failures

### 5. Validation
- **Splitting results**: Validating PDF split parts are correct
- **Progress reporting**: Testing status update messages
- **Configuration loading**: Verifying all configuration options

### 6. Concurrency
- **Concurrent processing limits**: Testing batch processing of parts
- **Signal handling**: Testing graceful shutdown

## Running Tests

### Using the Test Runner (Recommended)
```bash
python run_tests.py
```

### Using pytest directly
```bash
# Run all tests
pytest test_pdf_splitting_comprehensive.py -v

# Run specific test class
pytest test_pdf_splitting_comprehensive.py::TestPDFSplittingWorkflow -v

# Run specific test method
pytest test_pdf_splitting_comprehensive.py::TestPDFSplittingWorkflow::test_normal_pdf_splitting_workflow -v

# Run with coverage (if pytest-cov is installed)
pytest test_pdf_splitting_comprehensive.py --cov=pdf_splitting_worker --cov-report=html
```

### Running from workspace root
```bash
# Make sure you're in the workspace root
cd /workspace

# Run tests with proper root directory
pnpm test pdfProcess/test_pdf_splitting_comprehensive.py
```

## Test Markers

The tests use the following pytest markers:
- `@pytest.mark.unit` - Unit tests that don't require external services
- `@pytest.mark.integration` - Integration tests (not used in this suite yet)
- `@pytest.mark.slow` - Tests that take longer to run
- `@pytest.mark.rabbitmq` - Tests that require RabbitMQ
- `@pytest.mark.s3` - Tests that require S3/OSS
- `@pytest.mark.network` - Tests that require network access
- `@pytest.mark.pdf` - Tests that work with PDF files

## Mocked Dependencies

The test suite mocks all external dependencies:
- **RabbitMQ**: Uses `unittest.mock.MagicMock` to simulate RabbitMQ connections and channels
- **S3/OSS**: Mocks both real OSS2 library operations and fallback mock uploads
- **aiohttp**: Mocks HTTP client for S3/OSS downloads
- **aiofiles**: Mocks async file operations

## Test Data

The tests create temporary PDF files with varying page counts:
- **Small PDF**: 2 pages
- **Normal PDF**: 10 pages
- **Large PDF**: 100 pages

These PDFs are created using ReportLab and are automatically cleaned up after each test.

## Requirements

Install the required test dependencies:
```bash
pip install pytest pytest-asyncio pytest-mock
```

For PDF creation in tests:
```bash
pip install reportlab PyPDF2
```

For coverage reporting (optional):
```bash
pip install pytest-cov
```

## Troubleshooting

### Tests fail with "ModuleNotFoundError"
Make sure you're running tests from the correct directory or that the `pdfProcess` directory is in your Python path.

### Tests fail with permission errors
Ensure the temporary directory is writable and that PDF files can be created.

### Tests fail with missing dependencies
Install all required dependencies listed above.

### Tests hang or timeout
Check that async tests are properly awaited and that no deadlocks occur in mocked components.