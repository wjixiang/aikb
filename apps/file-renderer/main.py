"""
BibMax Document Processing Service

A focused service for converting PDFs to text/markdown and chunking for embeddings.
All conversion and chunking operations run as async background tasks.
"""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

# Load .env early so HF_ENDPOINT is available for huggingface_hub
load_dotenv()

# Propagate HuggingFace mirror setting to os.environ for huggingface_hub
_hf_endpoint = os.environ.get("HF_ENDPOINT")
if _hf_endpoint:
    os.environ["HF_ENDPOINT"] = _hf_endpoint

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from lib import setup_logging, get_logger
from lib.middleware import LoggingMiddleware, ErrorHandlingMiddleware, TimingMiddleware
from models import init_db, dispose_db
from routers import (
    conversion_router,
    chunking_router,
    health_router,
    tasks_router,
)

# Setup logging
setup_logging()
logger = get_logger(__name__)

# API metadata
TAGS_METADATA = [
    {
        "name": "tasks",
        "description": "Async task status and result queries",
    },
    {
        "name": "document-conversion",
        "description": "PDF to text/markdown conversion (async task-based)",
    },
    {
        "name": "text-chunking",
        "description": "Text chunking for embedding preparation (async task-based)",
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

    await init_db()
    logger.info("Database initialized")

    yield

    # Shutdown
    await dispose_db()
    logger.info(f"Shutting down {settings.app_name}")


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    description="""
    BibMax Document Processing Service

    A focused service for converting biomedical literature PDFs to searchable text
    and chunking documents for embedding generation. All operations are **async task-based**:
    submit a task, get a `task_id`, then poll for results.

    ## Workflow

    1. Submit a conversion/chunking task → receive `task_id` (HTTP 202)
    2. Poll task status: `GET /api/v1/tasks/{task_id}`
    3. When `status=completed`, the `result` field contains the output

    ## Quick Start

    ```bash
    # Upload and convert (S3)
    curl -X POST "http://localhost:8001/api/v1/conversion/upload-to-s3" \\
      -F "file=@document.pdf" -F "output_format=markdown"

    # Check task status
    curl http://localhost:8001/api/v1/tasks/{task_id}
    ```

    ## Configuration

    - `CONVERSION_ENABLE_OCR=true`: Enable OCR for scanned PDFs
    - `S3_ENDPOINT`: S3/MinIO endpoint
    - `TASK_MAX_WORKERS=4`: Thread pool size for background tasks
    - `DATABASE_URL`: PostgreSQL connection string
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
app.include_router(tasks_router, prefix="/api/v1")
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
