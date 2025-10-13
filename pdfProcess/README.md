# Python PDF Splitting Worker

This Python-based PDF splitting worker replaces the TypeScript implementation to provide better performance and reliability for splitting large PDF files into smaller parts for parallel processing.

## Overview

The Python PDF Splitting Worker is part of the distributed PDF processing system. It listens for PDF splitting requests via RabbitMQ, downloads PDF files from S3/OSS storage, splits them into smaller parts, uploads the parts back to storage, and sends part conversion requests to continue the processing pipeline.

## Features

- **Asynchronous Processing**: Uses asyncio for efficient concurrent operations
- **RabbitMQ Integration**: Compatible with existing RabbitMQ message queues
- **S3/OSS Storage Support**: Works with both AWS S3 and Alibaba Cloud OSS
- **Error Handling & Retry Logic**: Robust error handling with configurable retry mechanisms
- **Configurable Splitting**: Flexible split size configuration
- **Progress Tracking**: Sends progress updates during processing
- **Docker Support**: Containerized deployment with Docker and Docker Compose

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ PDF Processing  │───▶│ RabbitMQ         │───▶│ Python PDF      │
│ Coordinator     │    │ Message Queue    │    │ Splitting Worker│
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ PDF Part        │◀───│ RabbitMQ         │◀───│ S3/OSS Storage  │
│ Conversion      │    │ Message Queue    │    │                 │
│ Workers         │    └──────────────────┘    └─────────────────┘
└─────────────────┘
```

## Installation

### Prerequisites

- Python 3.11 or higher
- RabbitMQ server
- S3/OSS storage (optional, can use mock storage for testing)

### Dependencies

Install the required Python packages:

```bash
pip install -r requirements.txt
```

### Environment Configuration

Create a `.env` file or set the following environment variables:

```bash
# RabbitMQ Configuration
RABBITMQ_HOSTNAME=localhost
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=admin
RABBITMQ_PASSWORD=admin123
RABBITMQ_VHOST=my_vhost

# S3/OSS Configuration
PDF_OSS_BUCKET_NAME=aikb-pdf
OSS_REGION=oss-cn-beijing
OSS_ACCESS_KEY_ID=your_access_key
OSS_SECRET_ACCESS_KEY=your_secret_key
S3_ENDPOINT=aliyuncs.com

# Worker Configuration
SYSTEM_LOG_LEVEL=INFO
MAX_RETRIES=3
TEMP_DIR=/tmp/pdf-processing
```

## Usage

### Running the Worker

#### Direct Execution

```bash
python start_pdf_splitting_worker.py
```

#### Using Docker

```bash
# Build the Docker image
docker build -f Dockerfile.pdf-splitter -t pdf-splitting-worker .

# Run with Docker Compose
docker-compose up pdf-splitting-worker

# Or run directly
docker run -d \
  --name pdf-splitting-worker \
  -e RABBITMQ_HOSTNAME=rabbitmq \
  -e RABBITMQ_USERNAME=admin \
  -e RABBITMQ_PASSWORD=admin123 \
  pdf-splitting-worker
```

#### Using Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f pdf-splitting-worker

# Stop services
docker-compose down
```

### Testing

#### Integration Tests

Run the integration tests to verify the worker is functioning correctly:

```bash
python test_pdf_splitting_integration.py
```

#### Unit Tests

```bash
python test_pdf_functionality.py
```

#### RabbitMQ Connection Test

```bash
python test_rabbitmq_connection.py
```

## Configuration

The worker can be configured through the `config.py` file or environment variables:

- `DEFAULT_SPLIT_SIZE`: Number of pages per split part (default: 25)
- `MAX_SPLIT_SIZE`: Maximum pages per part (default: 100)
- `MIN_SPLIT_SIZE`: Minimum pages per part (default: 10)
- `CONCURRENT_PART_PROCESSING`: Number of parts to process concurrently (default: 3)

## Message Flow

1. **Receive Splitting Request**: Worker listens to `pdf-splitting-request` queue
2. **Download PDF**: Downloads the original PDF from S3/OSS
3. **Update Status**: Sends progress update to `pdf-conversion-progress` queue
4. **Split PDF**: Splits the PDF into smaller parts using PyPDF2
5. **Upload Parts**: Uploads each part to S3/OSS storage
6. **Send Part Requests**: Sends part conversion requests to `pdf-part-conversion-request` queue
7. **Update Final Status**: Sends final progress update

## Error Handling

The worker implements comprehensive error handling:

- **Download Failures**: Retries with exponential backoff
- **Splitting Errors**: Validates PDF integrity before processing
- **Upload Failures**: Implements retry logic for storage operations
- **Message Processing**: Uses manual acknowledgments for reliable message processing

## Monitoring

### Logs

The worker provides detailed logging for monitoring and debugging:

```bash
# View logs in real-time
tail -f logs/pdf-splitting-worker.log

# Docker logs
docker logs -f pdf-splitting-worker
```

### RabbitMQ Management

Access the RabbitMQ management interface at `http://localhost:15672` (username/password: admin/admin123) to monitor:
- Queue depths
- Message rates
- Consumer connections

## Performance Considerations

- **Memory Usage**: The worker processes one PDF at a time to manage memory efficiently
- **Concurrent Processing**: Parts are uploaded concurrently (configurable limit)
- **Temporary Storage**: Uses system temp directory for intermediate files
- **Cleanup**: Automatically cleans up temporary files after processing

## Troubleshooting

### Common Issues

1. **RabbitMQ Connection Failures**
   - Check RabbitMQ is running and accessible
   - Verify connection parameters in configuration
   - Check network connectivity and firewall settings

2. **S3/OSS Upload Failures**
   - Verify storage credentials and permissions
   - Check bucket exists and is accessible
   - Ensure endpoint URL is correct

3. **PDF Processing Errors**
   - Verify PDF files are not corrupted
   - Check file permissions and disk space
   - Review error logs for specific issues

### Debug Mode

Enable debug logging for detailed troubleshooting:

```bash
export SYSTEM_LOG_LEVEL=DEBUG
python start_pdf_splitting_worker.py
```

## Migration from TypeScript

This Python worker is a drop-in replacement for the TypeScript PDF splitting worker. The migration process:

1. ✅ **Removed TypeScript Implementation**: Deleted `pdf-splitting.worker.ts` and related test files
2. ✅ **Updated References**: Modified test files to remove TypeScript worker imports
3. ✅ **Enhanced Python Implementation**: Added full feature parity with TypeScript version
4. ✅ **Maintained Compatibility**: Uses same message queues and formats
5. ✅ **Improved Performance**: Better memory management and concurrent processing

## Development

### Project Structure

```
pdfProcess/
├── pdf_splitting_worker.py    # Main worker implementation
├── config.py                  # Configuration management
├── start_pdf_splitting_worker.py  # Startup script
├── requirements.txt           # Python dependencies
├── Dockerfile.pdf-splitter    # Docker configuration
├── docker-compose.yml         # Docker Compose configuration
├── test_*.py                  # Test files
└── README.md                  # This file
```

### Contributing

1. Follow PEP 8 style guidelines
2. Add appropriate tests for new features
3. Update documentation as needed
4. Ensure all tests pass before submitting

## License

This project is part of the larger PDF processing system and follows the same license terms.