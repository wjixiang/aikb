"""
PDF API Router - PDF 文件创建和读取
"""

import io

from fastapi import APIRouter, HTTPException

from lib.s3_key_generator import generate_pdf_key
from models.create import FileCreateRequest, FileCreateResponse
from models.pdf_model import PdfReadRequest, PdfReadResponse
from services.storage_service import storage_service
from services.pdf_service import pdf_service

router = APIRouter(tags=["pdf"])

CONTENT_TYPE = "application/pdf"


@router.post("/create", response_model=FileCreateResponse)
async def create_pdf_file(request: FileCreateRequest):
    """创建空 PDF 文件"""
    s3_key = generate_pdf_key(request.fileName)

    try:
        empty_file = io.BytesIO(b"")
        storage_service.upload(
            data=empty_file.getvalue(), key=s3_key, content_type=CONTENT_TYPE
        )

        return FileCreateResponse(
            success=True,
            message="File created successfully",
            s3_key=s3_key,
            content_type=CONTENT_TYPE,
            file_size=0,
        )
    except Exception as e:
        return FileCreateResponse(
            success=False,
            message=f"Failed to create file: {str(e)}",
            s3_key=s3_key,
        )


@router.post("/read", response_model=PdfReadResponse)
async def read_pdf_file(request: PdfReadRequest):
    """
    读取 PDF 文件指定页内容

    使用 docling 解析 PDF，返回指定页的文本内容
    """
    try:
        return pdf_service.read_pdf(request.s3Key, request.page)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read PDF: {str(e)}")
