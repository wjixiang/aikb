"""
Markdown API Router - Markdown 文件创建、读取和编辑

提供 Markdown 文件（text/markdown）的完整生命周期管理：
- 创建空文件
- 分页读取（支持大文件）
- 行级编辑（替换、插入、删除）
- 编辑预览（不实际修改文件）
- 文件列表分页查询

## 功能模块

### 文件创建
- `POST /markdown/create` - 创建空 Markdown 文件

### 文件读取
- `POST /markdown/read/bypage` - 按页码分页读取文件内容

### 编辑操作
- `POST /markdown/edit/replace` - 替换指定行范围的内容
- `POST /markdown/edit/insert` - 在指定位置插入内容
- `POST /markdown/edit/delete` - 删除指定行范围的内容

### 编辑预览
- `POST /markdown/preview/replace` - 预览替换操作效果
- `POST /markdown/preview/insert` - 预览插入操作效果
- `POST /markdown/preview/delete` - 预览删除操作效果

### 文件列表
- `GET /markdown/list` - 分页列出 Markdown 文件

## 错误处理

所有接口遵循统一的错误响应格式：
- 400: 请求参数错误
- 404: 文件不存在
- 500: 服务器内部错误
"""

import io

from fastapi import APIRouter, HTTPException, Query, status

from lib.s3_key_generator import generate_markdown_key
from lib.schemas import COMMON_RESPONSES
from models.create import FileCreateRequest, FileCreateResponse
from models.markdown_edit import (
    MarkdownDeleteRequest,
    MarkdownEditRequest,
    MarkdownInsertRequest,
)
from models.markdown_model import (
    MarkdownEditResponse,
    MarkdownPreviewResponse,
    MarkdownReadByPageRequest,
    MarkdownReadByPageResponse,
)
from models.pagination import (
    PaginatedResponse,
    OffsetPaginationRequest,
)
from services.markdown_edit_service import markdown_edit_service
from services.markdown_service import markdown_service
from services.pagination_service import apply_pagination
from services.storage_service import storage_service

router = APIRouter(
    prefix="/markdown",
    tags=["markdown"],
    responses={
        401: {"description": "未认证"},
        403: {"description": "无权限访问"},
    },
)

CONTENT_TYPE = "text/markdown"

# 路由标签分类
TAG_CREATE = "Markdown - 文件创建"
TAG_READ = "Markdown - 文件读取"
TAG_EDIT = "Markdown - 编辑操作"
TAG_PREVIEW = "Markdown - 编辑预览"
TAG_LIST = "Markdown - 文件列表"


@router.post(
    "/create",
    response_model=FileCreateResponse,
    summary="创建空 Markdown 文件",
    description="""
    在 S3 存储中创建一个空的 Markdown 文件。

    - 文件名为请求中指定的名称
    - 自动生成 S3 存储路径
    - 创建后文件大小为 0 字节
    - 内容类型为 text/markdown

    创建成功后，可以使用 Editor API 或 Markdown 编辑接口进行内容编辑。
    """,
    operation_id="createMarkdownFile",
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
async def create_markdown_file(
    request: FileCreateRequest,
) -> FileCreateResponse:
    """
    创建空 Markdown 文件

    Args:
        request: 文件创建请求，包含文件名

    Returns:
        FileCreateResponse: 创建结果，包含 S3 路径和状态

    Example:
        ```python
        request = {
            "fileName": "notes.md",
            "fileType": "markdown"
        }
        ```
    """
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


@router.post(
    "/read/bypage",
    response_model=MarkdownReadByPageResponse,
    summary="分页读取 Markdown 文件",
    description="""
    按页码分页读取 Markdown 文件内容。

    适用于读取大文件，避免一次性加载全部内容：
    - 按行数分页，默认每页 1000 行
    - 返回当前页内容和分页信息
    - 支持向前/向后翻页

    错误处理：
    - 404: 文件不存在
    - 400: 页码无效
    """,
    operation_id="readMarkdownByPage",
    responses={
        status.HTTP_200_OK: {
            "description": "成功读取指定页",
            "model": MarkdownReadByPageResponse,
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
                "application/json": {"example": {"detail": "Invalid page number"}}
            },
        },
        **COMMON_RESPONSES,
    },
)
async def read_markdown_by_page(
    request: MarkdownReadByPageRequest,
) -> MarkdownReadByPageResponse:
    """
    分页读取 Markdown 文件

    Args:
        request: 分页读取请求，包含 S3 路径、页码和每页行数

    Returns:
        MarkdownReadByPageResponse: 页面内容和分页信息

    Example:
        ```python
        request = {
            "s3_key": "markdown/document.md",
            "page": 1,
            "page_size": 1000
        }
        ```
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


@router.post(
    "/edit/replace",
    response_model=MarkdownEditResponse,
    summary="替换指定行范围的内容",
    description="""
    替换 Markdown 文件中指定行范围的内容。

    - **s3_key**: S3存储路径
    - **start_line**: 起始行号（从0开始）
    - **end_line**: 结束行号（包含）
    - **new_content**: 新内容

    注意：此操作会直接修改文件内容，请谨慎使用。
    建议先使用预览接口查看效果。
    """,
    operation_id="replaceMarkdownContent",
    responses={
        status.HTTP_200_OK: {
            "description": "替换成功",
            "model": MarkdownEditResponse,
        },
        status.HTTP_400_BAD_REQUEST: {
            "description": "请求参数错误",
            "content": {
                "application/json": {
                    "example": {"detail": "start_line is required for replace operation"}
                }
            },
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "文件不存在",
            "content": {
                "application/json": {"example": {"detail": "File not found"}}
            },
        },
        **COMMON_RESPONSES,
    },
)
async def edit_replace(
    request: MarkdownEditRequest,
) -> MarkdownEditResponse:
    """
    替换指定行范围的内容

    Args:
        request: 编辑请求，包含 S3 路径、行范围和新内容

    Returns:
        MarkdownEditResponse: 编辑结果
    """
    # 验证必需字段
    if request.start_line is None:
        raise HTTPException(
            status_code=400, detail="start_line is required for replace operation"
        )
    if request.end_line is None:
        raise HTTPException(
            status_code=400, detail="end_line is required for replace operation"
        )
    if request.new_content is None:
        raise HTTPException(
            status_code=400, detail="new_content is required for replace operation"
        )

    try:
        return markdown_edit_service.replace(
            s3_key=request.s3_key,
            start_line=request.start_line,
            end_line=request.end_line,
            new_content=request.new_content,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to edit file: {str(e)}")


@router.post(
    "/edit/insert",
    response_model=MarkdownEditResponse,
    summary="插入内容",
    description="""
    在 Markdown 文件中插入内容。

    - **s3_key**: S3存储路径
    - **content**: 插入的内容
    - **position**: 插入位置
        - `start`: 文件开头
        - `end`: 文件末尾
        - `before_line`: 指定行之前
        - `after_line`: 指定行之后
    - **target_line**: 目标行号（position 为 before_line/after_line 时需要）

    注意：此操作会直接修改文件内容，请谨慎使用。
    """,
    operation_id="insertMarkdownContent",
    responses={
        status.HTTP_200_OK: {
            "description": "插入成功",
            "model": MarkdownEditResponse,
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "文件不存在",
            "content": {
                "application/json": {"example": {"detail": "File not found"}}
            },
        },
        **COMMON_RESPONSES,
    },
)
async def edit_insert(
    request: MarkdownInsertRequest,
) -> MarkdownEditResponse:
    """
    插入内容

    Args:
        request: 插入请求，包含 S3 路径、内容、位置和可选目标行号

    Returns:
        MarkdownEditResponse: 编辑结果
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


@router.post(
    "/edit/delete",
    response_model=MarkdownEditResponse,
    summary="删除指定行范围的内容",
    description="""
    删除 Markdown 文件中指定行范围的内容。

    - **s3_key**: S3存储路径
    - **start_line**: 起始行号（从0开始）
    - **end_line**: 结束行号（包含）

    注意：此操作会直接修改文件内容，请谨慎使用。
    建议先使用预览接口查看效果。
    """,
    operation_id="deleteMarkdownContent",
    responses={
        status.HTTP_200_OK: {
            "description": "删除成功",
            "model": MarkdownEditResponse,
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "文件不存在",
            "content": {
                "application/json": {"example": {"detail": "File not found"}}
            },
        },
        **COMMON_RESPONSES,
    },
)
async def edit_delete(
    request: MarkdownDeleteRequest,
) -> MarkdownEditResponse:
    """
    删除指定行范围的内容

    Args:
        request: 删除请求，包含 S3 路径和行范围

    Returns:
        MarkdownEditResponse: 编辑结果
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


@router.post(
    "/preview/replace",
    response_model=MarkdownPreviewResponse,
    summary="预览替换操作（不实际修改文件）",
    description="""
    预览替换操作的效果，不实际修改文件。

    - **s3_key**: S3存储路径
    - **start_line**: 起始行号（从0开始）
    - **end_line**: 结束行号（包含）
    - **new_content**: 新内容

    返回内容差异（diff）信息，可用于确认修改效果。
    """,
    operation_id="previewReplaceMarkdown",
    responses={
        status.HTTP_200_OK: {
            "description": "预览成功",
            "model": MarkdownPreviewResponse,
        },
        status.HTTP_400_BAD_REQUEST: {
            "description": "请求参数错误",
            "content": {
                "application/json": {
                    "example": {"detail": "start_line is required for replace operation"}
                }
            },
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "文件不存在",
            "content": {
                "application/json": {"example": {"detail": "File not found"}}
            },
        },
        **COMMON_RESPONSES,
    },
)
async def preview_replace(
    request: MarkdownEditRequest,
) -> MarkdownPreviewResponse:
    """
    预览替换操作（不实际修改文件）

    Args:
        request: 编辑请求，包含 S3 路径、行范围和新内容

    Returns:
        MarkdownPreviewResponse: 预览结果，包含差异信息
    """
    # 验证必需字段
    if request.start_line is None:
        raise HTTPException(
            status_code=400, detail="start_line is required for replace operation"
        )
    if request.end_line is None:
        raise HTTPException(
            status_code=400, detail="end_line is required for replace operation"
        )
    if request.new_content is None:
        raise HTTPException(
            status_code=400, detail="new_content is required for replace operation"
        )

    try:
        return markdown_edit_service.preview_replace(
            s3_key=request.s3_key,
            start_line=request.start_line,
            end_line=request.end_line,
            new_content=request.new_content,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to preview: {str(e)}")


@router.post(
    "/preview/insert",
    response_model=MarkdownPreviewResponse,
    summary="预览插入操作（不实际修改文件）",
    description="""
    预览插入操作的效果，不实际修改文件。

    - **s3_key**: S3存储路径
    - **content**: 插入的内容
    - **position**: 插入位置
    - **target_line**: 目标行号

    返回内容差异（diff）信息，可用于确认修改效果。
    """,
    operation_id="previewInsertMarkdown",
    responses={
        status.HTTP_200_OK: {
            "description": "预览成功",
            "model": MarkdownPreviewResponse,
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "文件不存在",
            "content": {
                "application/json": {"example": {"detail": "File not found"}}
            },
        },
        **COMMON_RESPONSES,
    },
)
async def preview_insert(
    request: MarkdownInsertRequest,
) -> MarkdownPreviewResponse:
    """
    预览插入操作（不实际修改文件）

    Args:
        request: 插入请求，包含 S3 路径、内容、位置和可选目标行号

    Returns:
        MarkdownPreviewResponse: 预览结果，包含差异信息
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


@router.post(
    "/preview/delete",
    response_model=MarkdownPreviewResponse,
    summary="预览删除操作（不实际修改文件）",
    description="""
    预览删除操作的效果，不实际修改文件。

    - **s3_key**: S3存储路径
    - **start_line**: 起始行号
    - **end_line**: 结束行号

    返回内容差异（diff）信息，可用于确认修改效果。
    """,
    operation_id="previewDeleteMarkdown",
    responses={
        status.HTTP_200_OK: {
            "description": "预览成功",
            "model": MarkdownPreviewResponse,
        },
        status.HTTP_404_NOT_FOUND: {
            "description": "文件不存在",
            "content": {
                "application/json": {"example": {"detail": "File not found"}}
            },
        },
        **COMMON_RESPONSES,
    },
)
async def preview_delete(
    request: MarkdownDeleteRequest,
) -> MarkdownPreviewResponse:
    """
    预览删除操作（不实际修改文件）

    Args:
        request: 删除请求，包含 S3 路径和行范围

    Returns:
        MarkdownPreviewResponse: 预览结果，包含差异信息
    """
    try:
        return markdown_edit_service.preview_delete(
            s3_key=request.s3_key,
            start_line=request.start_line,
            end_line=request.end_line,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to preview: {str(e)}")


# ==================== Markdown文件列表分页接口 ====================


@router.get(
    "/list",
    response_model=PaginatedResponse[dict],
    summary="列出Markdown文件",
    description="""
    分页列出所有Markdown文件。

    - 支持 Offset 分页
    - 支持按文件名、大小、修改时间排序
    - 自动过滤 .md 文件

    返回文件列表包含以下信息：
    - key: S3存储路径
    - name: 文件名
    - size: 文件大小（字节）
    - last_modified: 最后修改时间戳
    """,
    operation_id="listMarkdownFiles",
    responses={
        status.HTTP_200_OK: {
            "description": "成功获取Markdown文件列表",
            "model": PaginatedResponse[dict],
        },
        status.HTTP_500_INTERNAL_SERVER_ERROR: {
            "description": "服务器内部错误",
            "content": {
                "application/json": {"example": {"detail": "Failed to list markdown files"}}
            },
        },
        **COMMON_RESPONSES,
    },
)
async def list_markdown_files(
    page: int = Query(
        default=1,
        description="页码（从1开始）",
        ge=1,
        examples=[1, 2, 3],
    ),
    page_size: int = Query(
        default=20,
        description="每页数量",
        ge=1,
        le=1000,
        examples=[10, 20, 50],
    ),
    prefix: str = Query(
        default="markdown/",
        description="文件前缀",
        examples=["markdown/", "docs/"],
    ),
    sort_by: str = Query(
        default="last_modified",
        description="排序字段: key, size, last_modified",
        examples=["last_modified", "key", "size"],
    ),
    sort_order: str = Query(
        default="desc",
        description="排序方向: asc 或 desc",
        examples=["desc", "asc"],
    ),
) -> PaginatedResponse[dict]:
    """
    列出Markdown文件

    Args:
        page: 页码（从1开始）
        page_size: 每页数量
        prefix: 文件前缀
        sort_by: 排序字段（key/size/last_modified）
        sort_order: 排序方向（asc/desc）

    Returns:
        PaginatedResponse: 分页文件列表
    """
    try:
        # 获取所有对象
        all_keys = storage_service.list_objects(prefix)

        # 过滤Markdown文件
        md_keys = [k for k in all_keys if k.endswith(".md") or k.endswith(".markdown")]

        # 获取文件信息
        files = []
        for key in md_keys:
            try:
                size = storage_service.get_file_size(key)
                modified = storage_service.get_modified_time(key)
                files.append({
                    "key": key,
                    "size": size,
                    "last_modified": modified,
                    "name": key.split("/")[-1] if "/" in key else key,
                })
            except Exception:
                files.append({
                    "key": key,
                    "size": None,
                    "last_modified": None,
                    "name": key.split("/")[-1] if "/" in key else key,
                })

        # 应用排序
        if sort_by == "key":
            files.sort(key=lambda f: f["key"], reverse=(sort_order == "desc"))
        elif sort_by == "size":
            files.sort(key=lambda f: f["size"] or 0, reverse=(sort_order == "desc"))
        elif sort_by == "last_modified":
            files.sort(key=lambda f: f["last_modified"] or 0, reverse=(sort_order == "desc"))

        # 应用分页
        params = OffsetPaginationRequest(
            page=page,
            page_size=page_size,
        ).to_params()

        result = apply_pagination(files, params)
        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list markdown files: {str(e)}",
        )
