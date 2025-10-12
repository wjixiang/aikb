# PDF Processing Workers

This directory contains Python-based workers for processing PDF files in a distributed RabbitMQ-based system.

## Components

### 1. PDF Splitting Worker (`pdf_splitting_worker.py`)

A Python implementation of the PDF splitting worker that can replace or complement the existing TypeScript version. This worker:

- Consumes PDF splitting requests from RabbitMQ
- Downloads PDF files from S3
- Splits large PDFs into smaller parts using PyPDF2
- Uploads split parts back to S3
- Sends part conversion requests for further processing
- Handles retries and error cases

### 2. Configuration (`config.py`)

Centralized configuration management for all PDF processing workers. Supports environment variables for:

- RabbitMQ connection settings
- S3 storage configuration
- PDF processing parameters
- Worker settings

### 3. Startup Script (`start_pdf_splitting_worker.py`)

A production-ready startup script that:

- Sets up proper logging
- Handles graceful shutdown signals
- Manages worker lifecycle
- Provides error handling and recovery

## Installation

1. Install dependencies using uv:

```bash
uv sync
```

2. Set up environment variables (see Configuration section below)

3. Run the worker:

```bash
python pdfProcess/start_pdf_splitting_worker.py
```

## Configuration

The worker can be configured using environment variables:

### RabbitMQ Configuration

- `RABBITMQ_HOST`: RabbitMQ server host (default: localhost)
- `RABBITMQ_PORT`: RabbitMQ server port (default: 5672)
- `RABBITMQ_USERNAME`: RabbitMQ username (default: guest)
- `RABBITMQ_PASSWORD`: RabbitMQ password (default: guest)
- `RABBITMQ_VHOST`: RabbitMQ virtual host (default: /)

### S3 Configuration

- `S3_BUCKET`: S3 bucket name (default: pdf-processing-bucket)
- `S3_REGION`: S3 region (default: us-east-1)
- `S3_ACCESS_KEY`: S3 access key (optional)
- `S3_SECRET_KEY`: S3 secret key (optional)
- `S3_ENDPOINT`: S3 endpoint URL (optional, for S3-compatible services)

### PDF Processing Configuration

- `PDF_SPLIT_SIZE`: Default number of pages per split (default: 25)
- `PDF_MAX_SPLIT_SIZE`: Maximum pages per part (default: 100)
- `PDF_MIN_SPLIT_SIZE`: Minimum pages per part (default: 10)
- `PDF_CONCURRENT_PART_PROCESSING`: Number of parts to process concurrently (default: 3)

### Worker Configuration

- `WORKER_ID`: Unique worker identifier (default: auto-generated)
- `LOG_LEVEL`: Logging level (default: INFO)
- `MAX_RETRIES`: Maximum retry attempts (default: 3)
- `TEMP_DIR`: Temporary directory for processing (default: /tmp/pdf-processing)

## Integration with Existing System

This Python worker is designed to be compatible with the existing TypeScript-based system:

1. **Message Format**: Uses the same message format as the TypeScript workers
2. **Queue Names**: Consumes from the same RabbitMQ queues
3. **Status Updates**: Sends status updates to the same progress queues
4. **Error Handling**: Implements the same retry logic and error reporting

## Usage Examples

### Running the Worker

```bash
# Basic usage
python pdfProcess/start_pdf_splitting_worker.py

# With custom configuration
RABBITMQ_HOST=rabbitmq.example.com \
S3_BUCKET=my-pdf-bucket \
LOG_LEVEL=DEBUG \
python pdfProcess/start_pdf_splitting_worker.py
```

### Docker Deployment

```dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY . .

RUN pip install uv && uv sync

ENV RABBITMQ_HOST=rabbitmq
ENV S3_BUCKET=pdf-processing

CMD ["python", "pdfProcess/start_pdf_splitting_worker.py"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  pdf-splitting-worker:
    build: .
    environment:
      - RABBITMQ_HOST=rabbitmq
      - S3_BUCKET=pdf-processing
      - LOG_LEVEL=INFO
    depends_on:
      - rabbitmq
    restart: unless-stopped
```

## Monitoring and Logging

- Logs are written to both stdout and a file in `/tmp/{worker_id}.log`
- Worker status and progress are reported through RabbitMQ messages
- Errors are logged and sent to the appropriate error queues

## Development

### Running Tests

```bash
# Install test dependencies
uv sync --dev

# Run tests
python -m pytest tests/
```

### Code Style

This project follows PEP 8 style guidelines. Use the following tools:

```bash
# Format code
black pdfProcess/

# Lint code
flake8 pdfProcess/

# Type checking
mypy pdfProcess/
```

## Troubleshooting

### Common Issues

1. **RabbitMQ Connection Failed**
   - Check RabbitMQ server is running
   - Verify connection parameters
   - Ensure network connectivity

2. **S3 Upload Failed**
   - Check S3 credentials
   - Verify bucket exists and has proper permissions
   - Check network connectivity to S3 endpoint

3. **PDF Processing Failed**
   - Verify PDF file is not corrupted
   - Check file permissions
   - Ensure sufficient disk space in temp directory

### Debug Mode

Run the worker with debug logging:

```bash
LOG_LEVEL=DEBUG python pdfProcess/start_pdf_splitting_worker.py
```

## License

This project is part of the larger knowledge base system and follows the same licensing terms.