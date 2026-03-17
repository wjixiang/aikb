"""
PDF API Router - PDF 文件创建和读取

提供 PDF 文件的创建和分页读取功能，使用 docling 进行 PDF 解析
"""

import io

from fastapi import APIRouter, status

from lib.exceptions import (
    FileNotFoundException,
    InvalidPageNumberException,
    PdfConversionException,
)
from lib.logging_config import get_logger
from lib.s3_key_generator import generate_pdf_key
from lib.schemas import COMMON_RESPONSES
from models.create import FileCreateRequest, FileCreateResponse
from models.pdf_model import PdfReadRequest, PdfReadResponse
from services.pdf_service import pdf_service
from services.storage_service import storage_service

router = APIRouter(tags=["pdf"])
logger = get_logger(__name__)

CONTENT_TYPE = "application/pdf"


@router.post(
    "/create",
    response_model=FileCreateResponse,
    summary="创建空 PDF 文件",
    description="""
    在 S3 存储中创建一个空的 PDF 文件。

    - 文件名为请求中指定的名称
    - 自动生成 S3 存储路径
    - 创建后文件大小为 0 字节
    """,
    operation_id="createPdfFile",
    responses={
        status.HTTP_200_OK: {
            "description": "文件创建成功",
            "model": FileCreateResponse,
        },
        status.HTTP_500_INTERNAL_SERVER_ERROR: {
            "description": "文件创建失败",
            "content": {
                "application/json": {
                    "example": {
                        "success": False,
                        "message": "Failed to create file: S3 connection error",
                        "s3_key": None,
                    }
                }
            },
        },
        **COMMON_RESPONSES,
    },
)
async def create_pdf_file(request: FileCreateRequest) -> FileCreateResponse:
    """
    创建空 PDF 文件

    Args:
        request: 文件创建请求，包含文件名

    Returns:
        FileCreateResponse: 创建结果，包含 S3 路径和状态
    """
    s3_key = generate_pdf_key(request.fileName)

    logger.info(
        f"Creating empty PDF file: {request.fileName}", extra={"s3_key": s3_key}
    )

    try:
        empty_file = io.BytesIO(b"")
        storage_service.upload(
            data=empty_file.getvalue(), key=s3_key, content_type=CONTENT_TYPE
        )

        logger.info(f"Empty PDF file created: {s3_key}", extra={"s3_key": s3_key})

        return FileCreateResponse(
            success=True,
            message="File created successfully",
            s3_key=s3_key,
            content_type=CONTENT_TYPE,
            file_size=0,
        )
    except Exception as e:
        logger.error(
            f"Failed to create PDF file: {e}",
            extra={"s3_key": s3_key, "file_name": request.fileName},
            exc_info=True,
        )
        return FileCreateResponse(
            success=False,
            message=f"Failed to create file: {str(e)}",
            s3_key=s3_key,
        )


@router.post(
    "/read",
    response_model=PdfReadResponse,
    summary="读取 PDF 文件指定页",
    description="""
    使用 docling 解析 PDF 文件，返回指定页的文本内容。

    - 支持分页读取，页码从 1 开始
    - 自动提取页面文本内容
    - 返回页面元数据和内容

    错误处理：
    - 404: 文件不存在
    - 400: 页码无效（超出范围或小于 1）
    - 500: PDF 解析失败
    """,
    operation_id="readPdfFile",
    responses={
        status.HTTP_200_OK: {
            "description": "成功读取 PDF 页面",
            "model": PdfReadResponse,
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "文件不存在",
            "content": {
                "application/json": {"example": {"detail": "File not found"}}
            },
        },
        status.HTTP_400_BAD_REQUEST: {
            "description": "页码无效",
            "content": {
                "application/json": {
                    "example": {"detail": "Invalid page number: 10 (total: 5)"}
                }
            },
        },
        status.HTTP_500_INTERNAL_SERVER_ERROR: {
            "description": "PDF 解析失败",
            "content": {
                "application/json": {
                    "example": {"detail": "Failed to parse PDF: invalid format"}
                }
            },
        },
        **COMMON_RESPONSES,
    },
)
async def read_pdf_file(request: PdfReadRequest) -> PdfReadResponse:
    """
    读取 PDF 文件指定页内容

    Args:
        request: PDF 读取请求，包含 S3 路径和页码

    Returns:
        PdfReadResponse: PDF 页面内容和元数据

    Raises:
        FileNotFoundException: 文件不存在
        InvalidPageNumberException: 页码无效
        PdfConversionException: PDF 解析失败
    """
    logger.debug(
        f"Reading PDF: {request.s3_key}, page {request.page}",
        extra={"s3_key": request.s3_key, "page": request.page},
    )

    try:
        result = pdf_service.read_pdf(request.s3_key, request.page)
        logger.info(
            f"PDF read successfully: {request.s3_key}, page {request.page}",
            extra={
                "s3_key": request.s3_key,
                "page": request.page,
                "total_pages": result.metadata.total_pages,
            },
        )
        return result
    except FileNotFoundException:
        raise
    except InvalidPageNumberException:
        raise
    except PdfConversionException:
        raise
    except Exception as e:
        logger.error(
            f"Unexpected error reading PDF: {e}",
            extra={"s3_key": request.s3_key, "page": request.page},
            exc_info=True,
        )
        raise PdfConversionException(
            message=f"Failed to read PDF: {str(e)}",
            details={"s3_key": request.s3_key, "page": request.page},
        )
