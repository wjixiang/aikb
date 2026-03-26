"""
BibMax Document Processing Service

A focused service for converting PDFs to text/markdown and chunking for embeddings.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from lib import setup_logging, get_logger
from lib.middleware import LoggingMiddleware, ErrorHandlingMiddleware, TimingMiddleware
from routers import (
    conversion_router,
    chunking_router,
    health_router,
)

# Setup logging
setup_logging()
logger = get_logger(__name__)


# API metadata
TAGS_METADATA = [
    {
        "name": "document-conversion",
        "description": "PDF to text/markdown conversion endpoints",
    },
    {
        "name": "text-chunking",
        "description": "Text chunking for embedding preparation",
    },
    {
        "name": "health",
        "description": "Health check and service status endpoints",
    },
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    # Startup
    logger.info(
        f"Starting {settings.app_name} v{settings.app_version}",
        extra={
            "app_name": settings.app_name,
            "app_version": settings.app_version,
            "debug": settings.debug,
        },
    )

    yield

    # Shutdown
    logger.info(f"Shutting down {settings.app_name}")


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    description="""
    BibMax Document Processing Service

    A focused service for converting biomedical literature PDFs to searchable text
    and chunking documents for embedding generation.

    ## Features

    - **PDF Conversion**: Convert PDFs to plain text or Markdown format
    - **OCR Support**: Extract text from scanned PDFs
    - **Table Extraction**: Preserve table structures
    - **Text Chunking**: Split documents into chunks for embedding generation
    - **Semantic Chunking**: Intelligent chunking based on document structure

    ## Quick Start

    1. Upload and convert:
    ```bash
    curl -X POST "http://localhost:8001/api/v1/conversion/upload" \\
      -F "file=@document.pdf" \\
      -F "output_format=markdown"
    ```

    2. Chunk text:
    ```bash
    curl -X POST "http://localhost:8001/api/v1/chunking/chunk" \\
      -H "Content-Type: application/json" \\
      -d '{"text": "...", "chunking_strategy": "semantic"}'
    ```

    ## Configuration

    Configure via environment variables:
    - `CONVERSION_ENABLE_OCR=true`: Enable OCR for scanned PDFs
    - `CHUNKING_DEFAULT_CHUNK_SIZE=1000`: Default chunk size
    - `SERVER_PORT=8001`: Service port
    """,
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
    openapi_tags=TAGS_METADATA,
    contact={
        "name": "BibMax Team",
        "email": "dev@aikb.io",
    },
    license_info={
        "name": "MIT",
    },
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Response-Time", "X-Process-Time"],
)

# Add custom middleware
app.add_middleware(ErrorHandlingMiddleware, include_traceback=settings.debug)
app.add_middleware(TimingMiddleware)
app.add_middleware(LoggingMiddleware, exclude_paths=["/health", "/", "/docs"])

# Include routers
app.include_router(conversion_router, prefix="/api/v1")
app.include_router(chunking_router, prefix="/api/v1")
app.include_router(health_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.server.host,
        port=settings.server.port,
        reload=settings.server.reload,
        log_level=settings.server.log_level.lower(),
    )
