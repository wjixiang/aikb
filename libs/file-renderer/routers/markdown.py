"""
Markdown API Router - Markdown 文件创建和读取
"""

import io

from fastapi import APIRouter, HTTPException

from lib.s3_key_generator import generate_markdown_key
from models.create import FileCreateRequest, FileCreateResponse
from models.markdown_model import MarkdownReadByPageRequest, MarkdownReadByPageResponse
from services.markdown_service import markdown_service
from services.storage_service import storage_service

router = APIRouter(tags=["markdown"])

CONTENT_TYPE = "text/markdown"


@router.post("/create", response_model=FileCreateResponse)
async def create_markdown_file(request: FileCreateRequest):
    """创建空 Markdown 文件"""
    s3_key = generate_markdown_key(request.fileName)

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


@router.post("/read/bypage", response_model=MarkdownReadByPageResponse)
async def read_markdown_by_page(request: MarkdownReadByPageRequest):
    """
    分页读取 Markdown 文件

    按页码分页读取文件内容，支持大文件的分块加载。

    - **s3_key**: S3存储路径
    - **page**: 页码，从1开始
    - **page_size**: 每页行数，默认1000
    """
    try:
        return markdown_service.read_by_page(
            s3_key=request.s3_key,
            page=request.page,
            page_size=request.page_size,
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")
