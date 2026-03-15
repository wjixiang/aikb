"""
Markdown API Router - Markdown 文件创建、读取和编辑
"""

import io

from fastapi import APIRouter, HTTPException

from lib.s3_key_generator import generate_markdown_key
from models.create import FileCreateRequest, FileCreateResponse
from models.markdown_edit import MarkdownDeleteRequest, MarkdownEditRequest, MarkdownInsertRequest
from models.markdown_model import MarkdownEditResponse, MarkdownPreviewResponse, MarkdownReadByPageRequest, MarkdownReadByPageResponse
from services.markdown_edit_service import markdown_edit_service
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


@router.post("/edit/replace", response_model=MarkdownEditResponse)
async def edit_replace(request: MarkdownEditRequest):
    """
    替换指定行范围的内容

    - **s3_key**: S3存储路径
    - **start_line**: 起始行号（从0开始）
    - **end_line**: 结束行号
    - **new_content**: 新内容
    """
    # 验证必需字段
    if request.start_line is None:
        raise HTTPException(status_code=400, detail="start_line is required for replace operation")
    if request.end_line is None:
        raise HTTPException(status_code=400, detail="end_line is required for replace operation")
    if request.new_content is None:
        raise HTTPException(status_code=400, detail="new_content is required for replace operation")

    try:
        return markdown_edit_service.replace(
            s3_key=request.s3_key,
            start_line=request.start_line,
            end_line=request.end_line,
            new_content=request.new_content,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to edit file: {str(e)}")


@router.post("/edit/insert", response_model=MarkdownEditResponse)
async def edit_insert(request: MarkdownInsertRequest):
    """
    插入内容

    - **s3_key**: S3存储路径
    - **content**: 插入的内容
    - **position**: 插入位置 (start/end/before_line/after_line)
    - **target_line**: 目标行号（before_line/after_line用）
    """
    try:
        return markdown_edit_service.insert(
            s3_key=request.s3_key,
            content=request.content,
            position=request.position,
            target_line=request.target_line,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to insert content: {str(e)}")


@router.post("/edit/delete", response_model=MarkdownEditResponse)
async def edit_delete(request: MarkdownDeleteRequest):
    """
    删除指定行范围的内容

    - **s3_key**: S3存储路径
    - **start_line**: 起始行号
    - **end_line**: 结束行号
    """
    try:
        return markdown_edit_service.delete(
            s3_key=request.s3_key,
            start_line=request.start_line,
            end_line=request.end_line,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete content: {str(e)}")


# ==================== 预览接口 ====================


@router.post("/preview/replace", response_model=MarkdownPreviewResponse)
async def preview_replace(request: MarkdownEditRequest):
    """
    预览替换操作（不实际修改文件）

    - **s3_key**: S3存储路径
    - **start_line**: 起始行号（从0开始）
    - **end_line**: 结束行号
    - **new_content**: 新内容
    """
    # 验证必需字段
    if request.start_line is None:
        raise HTTPException(status_code=400, detail="start_line is required for replace operation")
    if request.end_line is None:
        raise HTTPException(status_code=400, detail="end_line is required for replace operation")
    if request.new_content is None:
        raise HTTPException(status_code=400, detail="new_content is required for replace operation")

    try:
        return markdown_edit_service.preview_replace(
            s3_key=request.s3_key,
            start_line=request.start_line,
            end_line=request.end_line,
            new_content=request.new_content,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to preview: {str(e)}")


@router.post("/preview/insert", response_model=MarkdownPreviewResponse)
async def preview_insert(request: MarkdownInsertRequest):
    """
    预览插入操作（不实际修改文件）

    - **s3_key**: S3存储路径
    - **content**: 插入的内容
    - **position**: 插入位置 (start/end/before_line/after_line)
    - **target_line**: 目标行号
    """
    try:
        return markdown_edit_service.preview_insert(
            s3_key=request.s3_key,
            content=request.content,
            position=request.position,
            target_line=request.target_line,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to preview: {str(e)}")


@router.post("/preview/delete", response_model=MarkdownPreviewResponse)
async def preview_delete(request: MarkdownDeleteRequest):
    """
    预览删除操作（不实际修改文件）

    - **s3_key**: S3存储路径
    - **start_line**: 起始行号
    - **end_line**: 结束行号
    """
    try:
        return markdown_edit_service.preview_delete(
            s3_key=request.s3_key,
            start_line=request.start_line,
            end_line=request.end_line,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to preview: {str(e)}")
