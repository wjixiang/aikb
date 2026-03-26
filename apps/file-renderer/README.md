# BibMax Document Processing Service

A focused document processing service for the BibMax system. Converts PDFs to text/markdown and chunks documents for embedding generation.

## Features

- **PDF Conversion**: Convert PDFs to plain text or Markdown format
- **OCR Support**: Extract text from scanned PDFs using Tesseract OCR
- **Table Extraction**: Preserve table structures from PDFs
- **Text Chunking**: Split documents into chunks for embedding generation
- **Semantic Chunking**: Intelligent chunking based on document structure
- **REST API**: Clean RESTful API for integration

## Quick Start

### Installation

```bash
cd apps/file-renderer

# Using uv (recommended)
pip install uv
uv sync

# Or using pip
pip install -e .
```

### Configuration

```bash
cp .env.example .env
# Edit .env with your settings
```

### Run the Service

```bash
# Development mode with auto-reload
uv run python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001

# Production mode
uv run python -m uvicorn main:app --host 0.0.0.0 --port 8001 --workers 4
```

The service will be available at:
- API: http://localhost:8001
- Docs: http://localhost:8001/docs
- ReDoc: http://localhost:8001/redoc

## API Usage

### 1. Upload and Convert PDF

```bash
curl -X POST "http://localhost:8001/api/v1/conversion/upload" \
  -F "file=@document.pdf" \
  -F "output_format=markdown" \
  -F "enable_ocr=true"
```

Response:
```json
{
  "success": true,
  "task_id": "uuid",
  "status": "completed",
  "message": "Document converted successfully",
  "file_id": "uuid",
  "output_format": "markdown",
  "content": "# Document Title\n\nContent...",
  "metadata": {
    "pages": 10,
    "title": "Document Title"
  },
  "pages_count": 10
}
```

### 2. Convert Previously Uploaded File

```bash
curl -X POST "http://localhost:8001/api/v1/conversion/convert" \
  -H "Content-Type: application/json" \
  -d '{
    "file_id": "uuid",
    "output_format": "markdown"
  }'
```

### 3. Chunk Text for Embeddings

```bash
curl -X POST "http://localhost:8001/api/v1/chunking/chunk" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Long document text...",
    "chunking_strategy": "semantic",
    "chunk_size": 1000,
    "chunk_overlap": 200
  }'
```

Response:
```json
{
  "success": true,
  "chunks": ["Chunk 1...", "Chunk 2..."],
  "chunk_count": 2,
  "metadata": {
    "strategy": "semantic",
    "total_chars": 1800,
    "avg_chunk_size": 900
  }
}
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SERVER_HOST` | Server host | `0.0.0.0` |
| `SERVER_PORT` | Server port | `8001` |
| `CONVERSION_ENABLE_OCR` | Enable OCR | `true` |
| `CHUNKING_DEFAULT_CHUNK_SIZE` | Default chunk size | `1000` |
| `CHUNKING_CHUNK_OVERLAP` | Chunk overlap | `200` |

### Chunking Strategies

- **fixed**: Fixed-size chunks with overlap
- **semantic**: Semantic chunking based on paragraphs and sections

## Architecture

```
┌─────────────────┐
│   Client App    │
└────────┬────────┘
         │ HTTP/REST
┌────────▼────────┐
│  FastAPI App    │
│  (main.py)      │
└────────┬────────┘
         │
┌────────▼─────────────────────────────────┐
│            Routers                       │
│  ┌──────────────┐  ┌──────────────┐     │
│  │ Conversion   │  │  Chunking    │     │
│  │   Router     │  │   Router     │     │
│  └──────────────┘  └──────────────┘     │
└────────┬─────────────────────────────────┘
         │
┌────────▼─────────────────────────────────┐
│            Services                      │
│  ┌──────────────┐  ┌──────────────┐     │
│  │ Docling      │  │  Chunking    │     │
│  │ Service      │  │  Service     │     │
│  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐                        │
│  │ File Service │                        │
│  └──────────────┘                        │
└──────────────────────────────────────────┘
         │
┌────────▼────────┐
│ Local Storage   │
│ /tmp/bibmax_... │
└─────────────────┘
```

## Dependencies

- **FastAPI**: Web framework
- **Docling**: PDF document conversion
- **Pydantic**: Data validation
- **Uvicorn**: ASGI server

## Development

### Code Quality

```bash
# Format code
uv run black .

# Lint code
uv run ruff check .

# Run tests
uv run pytest
```

## Deployment

### Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY . .
RUN pip install uv
RUN uv sync
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
```

### Kubernetes

The service can be deployed as a Deployment with a Service:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bibmax-document-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: bibmax-document-service
  template:
    metadata:
      labels:
        app: bibmax-document-service
    spec:
      containers:
      - name: document-service
        image: bibmax-document-service:latest
        ports:
        - containerPort: 8001
```

## License

MIT

## Contact

- BibMax Team: dev@aikb.io
- Issues: https://github.com/aikb/bibmax/issues
