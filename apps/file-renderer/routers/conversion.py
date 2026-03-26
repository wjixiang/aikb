"""
Document conversion API router

Handles PDF to text/markdown conversion endpoints.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse

from models.document import (
    ConversionRequest,
    ConversionResponse,
    ConversionTaskStatus,
    ConversionFormat,
)
from services import (
    get_conversion_service,
    get_file_service,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/conversion",
    tags=["document-conversion"],
)


@router.post(
    "/upload",
    response_model=ConversionResponse,
    summary="Upload and convert document",
    description="Upload a PDF file and convert it to text or markdown",
)
async def upload_and_convert(
    file: UploadFile = File(..., description="PDF file to convert"),
    output_format: ConversionFormat = Form(
        ConversionFormat.MARKDOWN,
        description="Output format",
    ),
    enable_ocr: Optional[bool] = Form(
        None,
        description="Enable OCR (default from config)",
    ),
):
    """
    Upload and convert a document

    - **file**: PDF file to convert
    - **output_format**: Target format (text, markdown, json)
    - **enable_ocr**: Override OCR setting
    """
    try:
        # Read file content
        content = await file.read()
        filename = file.filename or "document.pdf"

        logger.info(f"Received file: {filename} ({len(content)} bytes)")

        # Save file
        file_service = get_file_service()
        file_id, file_path = await file_service.save_file(
            filename=filename,
            content=content,
            content_type=file.content_type or "application/pdf",
        )

        # Convert document
        conversion_service = get_conversion_service()
        if output_format == ConversionFormat.TEXT:
            converted_text, metadata = await conversion_service.convert_pdf_to_text(
                file_path=file_path,
                enable_ocr=enable_ocr,
            )
        else:  # MARKDOWN or JSON
            converted_text, metadata = await conversion_service.convert_pdf_to_markdown(
                file_path=file_path,
                enable_ocr=enable_ocr,
            )

        return ConversionResponse(
            success=True,
            task_id=file_id,
            status=ConversionTaskStatus.COMPLETED,
            message="Document converted successfully",
            file_id=file_id,
            output_format=output_format,
            content=converted_text,
            metadata=metadata,
            pages_count=metadata.get("pages"),
        )

    except Exception as e:
        logger.error(f"Error converting document: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Conversion failed: {str(e)}",
        )


@router.post(
    "/convert",
    response_model=ConversionResponse,
    summary="Convert uploaded document",
    description="Convert a previously uploaded document to text or markdown",
)
async def convert_document(request: ConversionRequest):
    """
    Convert an uploaded document

    - **file_id**: ID of uploaded file
    - **output_format**: Target format
    - **enable_ocr**: Override OCR setting
    - **extract_tables**: Override table extraction setting
    """
    try:
        if not request.file_id:
            raise HTTPException(
                status_code=400,
                detail="file_id is required",
            )

        # Get file path
        file_service = get_file_service()
        file_path = await file_service.get_file_path(request.file_id)

        if not file_path:
            raise HTTPException(
                status_code=404,
                detail=f"File not found: {request.file_id}",
            )

        # Convert document
        conversion_service = get_conversion_service()
        content, metadata = await conversion_service.convert_document(
            file_path=file_path,
            output_format=request.output_format.value,
            enable_ocr=request.enable_ocr,
        )

        return ConversionResponse(
            success=True,
            task_id=request.file_id,
            status=ConversionTaskStatus.COMPLETED,
            message="Document converted successfully",
            file_id=request.file_id,
            output_format=request.output_format,
            content=content,
            metadata=metadata,
            pages_count=metadata.get("pages"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error converting document: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Conversion failed: {str(e)}",
        )


@router.get(
    "/formats",
    summary="List supported formats",
    description="Get list of supported document formats",
)
async def list_formats():
    """List supported conversion formats"""
    return {
        "formats": [
            {
                "name": "text",
                "description": "Plain text",
                "mime_types": ["text/plain"],
            },
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
