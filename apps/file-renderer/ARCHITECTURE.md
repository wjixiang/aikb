# BibMax Document Processing Service Architecture

## Overview

This is a focused document processing service for the BibMax system. It provides PDF-to-text/markdown conversion and text chunking for embedding generation.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Applications                      │
│                  (BibMax, API consumers)                    │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/REST
┌────────────────────────▼────────────────────────────────────┐
│                    FastAPI Application                       │
│                      (main.py)                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   Middleware Layer                     │  │
│  │  CORS │ Logging │ Error Handling │ Timing            │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Health Router│  │Conversion    │  │  Chunking    │     │
│  │              │  │Router        │  │Router        │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                      Service Layer                           │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ ConversionService│  │ ChunkingService  │                │
│  │  (Docling)       │  │  (Text Splitter) │                │
│  └──────────────────┘  └──────────────────┘                │
│  ┌──────────────────┐                                        │
│  │  FileService     │                                        │
│  │  (Local Storage) │                                        │
│  └──────────────────┘                                        │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                      Storage Layer                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │        Local Filesystem                               │  │
│  │     /tmp/bibmax_documents/                            │  │
│  │       ├── ab/                                         │  │
│  │       │   └── <file-id>                               │  │
│  │       └── cd/                                         │  │
│  │           └── <file-id>                               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. FastAPI Application (`main.py`)
- Entry point for the service
- Configures middleware and routers
- Manages application lifecycle

### 2. Routers
- **Health Router** (`routers/health.py`): Health check endpoints
- **Conversion Router** (`routers/conversion.py`): PDF conversion endpoints
- **Chunking Router** (`routers/chunking.py`): Text chunking endpoints

### 3. Services
- **ConversionService** (`services/conversion_service.py`): PDF to text/markdown conversion using Docling
- **ChunkingService** (`services/chunking_service.py`): Text chunking for embeddings
- **FileService** (`services/file_service.py`): Local file storage management

### 4. Models
- **Document Models** (`models/document.py`): Request/response schemas
- **Database Models** (`models/database.py`): SQLAlchemy models (for future use)

### 5. Library
- **Logging** (`lib/logging_config.py`): Structured logging
- **Middleware** (`lib/middleware.py`): Custom middleware

## Data Flow

### PDF Conversion Flow

```
1. Client uploads PDF
   ↓
2. FileService saves file locally
   ↓
3. ConversionService converts PDF using Docling
   ↓
4. Return converted content to client
```

### Text Chunking Flow

```
1. Client sends text to chunk
   ↓
2. ChunkingService applies chunking strategy
   - Fixed: Fixed-size chunks with overlap
   - Semantic: Paragraph-based chunks
   ↓
3. Return chunks to client
```

## API Endpoints

### Health
- `GET /` - Service information
- `GET /health` - Health check
- `GET /health/ready` - Readiness check
- `GET /health/live` - Liveness check

### Conversion
- `POST /api/v1/conversion/upload` - Upload and convert PDF
- `POST /api/v1/conversion/convert` - Convert uploaded PDF
- `GET /api/v1/conversion/formats` - List supported formats

### Chunking
- `POST /api/v1/chunking/chunk` - Chunk text (default strategy)
- `POST /api/v1/chunking/chunk/fixed` - Chunk with fixed size
- `POST /api/v1/chunking/chunk/semantic` - Chunk semantically

## Configuration

Configuration is managed through environment variables:

```bash
# Server
SERVER_HOST=0.0.0.0
SERVER_PORT=8001

# Conversion
CONVERSION_ENABLE_OCR=true
CONVERSION_ENABLE_TABLE_EXTRACTION=true

# Chunking
CHUNKING_DEFAULT_CHUNK_SIZE=1000
CHUNKING_CHUNK_OVERLAP=200
```

## Dependencies

- **FastAPI**: Web framework
- **Docling**: PDF document conversion
- **Pydantic**: Data validation
- **Uvicorn**: ASGI server

## Future Enhancements

1. **Database Integration**: Add PostgreSQL for metadata caching
2. **Async Task Queue**: Add background job processing for large files
3. **Caching Layer**: Add Redis for conversion result caching
4. **Metrics**: Add Prometheus metrics
5. **Rate Limiting**: Add rate limiting for API endpoints
6. **Authentication**: Add API key authentication
