"""
Document conversion API router

All mutation endpoints create async tasks and return 202 with task_id.
"""

import logging
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from lib.s3_key_generator import generate_pdf_key
from models.database import get_async_db
from models.document import (
    ConversionFormat,
    ConversionRequest,
    TaskAcceptedResponse,
)
from services import (
    get_conversion_service,
    get_file_service,
    get_s3_storage_service,
    get_task_service,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/conversion",
    tags=["document-conversion"],
)


# --- Mutation endpoints (return 202 + task_id) ---


@router.post(
    "/upload",
    status_code=202,
    response_model=TaskAcceptedResponse,
    summary="Upload and convert document",
)
async def upload_and_convert(
    file: UploadFile = File(..., description="PDF file to convert"),
    output_format: ConversionFormat = Form(
        ConversionFormat.MARKDOWN,
        description="Output format",
    ),
    enable_ocr: Optional[bool] = Form(None, description="Enable OCR"),
    db: AsyncSession = Depends(get_async_db),
):
    """Upload a PDF file, create a conversion task, return task_id immediately."""
    content = await file.read()
    filename = file.filename or "document.pdf"
    logger.info(f"Received file: {filename} ({len(content)} bytes)")

    file_service = get_file_service()
    file_id, file_path = await file_service.save_file(
        filename=filename,
        content=content,
        content_type=file.content_type or "application/pdf",
    )

    task_service = get_task_service()
    task = await task_service.create_task(
        db,
        task_type="conversion",
        input_params={
            "source": "file_path",
            "file_path": file_path,
            "output_format": output_format.value,
            "enable_ocr": enable_ocr,
            "store_in_s3": False,
            "filename": filename,
        },
    )
    task_service.submit_task(task.id)

    return TaskAcceptedResponse(
        task_id=task.id,
        task_type="conversion",
        message="Document uploaded and queued for conversion",
    )


@router.post(
    "/convert",
    status_code=202,
    response_model=TaskAcceptedResponse,
    summary="Convert uploaded document",
)
async def convert_document(
    request: ConversionRequest,
    db: AsyncSession = Depends(get_async_db),
):
    """Convert a previously uploaded document by file_id."""
    if not request.file_id:
        raise HTTPException(status_code=400, detail="file_id is required")

    task_service = get_task_service()
    task = await task_service.create_task(
        db,
        task_type="conversion",
        input_params={
            "source": "file_id",
            "file_id": request.file_id,
            "output_format": request.output_format.value,
            "enable_ocr": request.enable_ocr,
            "store_in_s3": False,
        },
    )
    task_service.submit_task(task.id)

    return TaskAcceptedResponse(
        task_id=task.id,
        task_type="conversion",
        message="Conversion task queued",
    )


@router.post(
    "/convert-s3",
    status_code=202,
    response_model=TaskAcceptedResponse,
    summary="Convert file from S3",
    description="Download a file from S3, convert it, and store the result back in S3",
)
async def convert_from_s3(
    s3_key: str = Form(..., description="S3 key of the source file"),
    output_format: ConversionFormat = Form(
        ConversionFormat.MARKDOWN,
        description="Output format",
    ),
    enable_ocr: Optional[bool] = Form(None, description="Enable OCR"),
    output_s3_key: Optional[str] = Form(None, description="Override output S3 key"),
    db: AsyncSession = Depends(get_async_db),
):
    """Convert a file stored in S3."""
    task_service = get_task_service()
    task = await task_service.create_task(
        db,
        task_type="conversion",
        input_params={
            "source": "s3_key",
            "s3_key": s3_key,
            "output_format": output_format.value,
            "enable_ocr": enable_ocr,
            "store_in_s3": True,
            "output_s3_key": output_s3_key,
        },
    )
    task_service.submit_task(task.id)

    return TaskAcceptedResponse(
        task_id=task.id,
        task_type="conversion",
        message="S3 conversion task queued",
    )


@router.post(
    "/upload-to-s3",
    status_code=202,
    response_model=TaskAcceptedResponse,
    summary="Upload, convert, and store in S3",
    description="Upload a file, convert it, and store both source and result in S3",
)
async def upload_convert_to_s3(
    file: UploadFile = File(..., description="PDF file to convert"),
    output_format: ConversionFormat = Form(
        ConversionFormat.MARKDOWN,
        description="Output format",
    ),
    enable_ocr: Optional[bool] = Form(None, description="Enable OCR"),
    db: AsyncSession = Depends(get_async_db),
):
    """Upload a file, convert it, and store both source and result in S3."""
    content = await file.read()
    filename = file.filename or "document.pdf"
    logger.info(f"Received file for S3 conversion: {filename} ({len(content)} bytes)")

    s3_service = get_s3_storage_service()
    source_key = generate_pdf_key(filename, prefix="files")
    s3_service.upload(
        data=content,
        key=source_key,
        content_type=file.content_type or "application/pdf",
    )

    task_service = get_task_service()
    task = await task_service.create_task(
        db,
        task_type="conversion",
        input_params={
            "source": "s3_key",
            "s3_key": source_key,
            "output_format": output_format.value,
            "enable_ocr": enable_ocr,
            "store_in_s3": True,
        },
    )
    task_service.submit_task(task.id)

    return TaskAcceptedResponse(
        task_id=task.id,
        task_type="conversion",
        message="Document uploaded to S3 and queued for conversion",
    )


# --- Read-only endpoints (no task needed) ---


@router.get(
    "/formats",
    summary="List supported formats",
)
async def list_formats():
    """List supported conversion formats"""
    return {
        "formats": [
            {"name": "text", "description": "Plain text", "mime_types": ["text/plain"]},
            {
                "name": "markdown",
                "description": "Markdown format",
                "mime_types": ["text/markdown", "text/x-markdown"],
            },
        ],
        "input_formats": ["pdf"],
        "features": {
            "ocr": True,
            "table_extraction": True,
            "layout_preservation": True,
        },
    }


@router.get(
    "/presigned-url",
    summary="Get presigned download URL",
)
async def get_presigned_url(s3_key: str, expires_in: int = 3600):
    """Generate a presigned download URL for an S3 object."""
    s3_service = get_s3_storage_service()
    if not s3_service.exists(s3_key):
        raise HTTPException(status_code=404, detail=f"Object not found in S3: {s3_key}")
    url = s3_service.get_presigned_url(s3_key, expires_in)
    return {"s3_key": s3_key, "presigned_url": url, "expires_in": expires_in}
