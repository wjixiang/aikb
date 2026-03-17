"""
Binary API Router - 二进制文件创建

提供二进制文件（application/octet-stream）的创建和管理功能
"""

import io

from fastapi import APIRouter, status

from lib.s3_key_generator import generate_binary_key
from lib.schemas import COMMON_RESPONSES
from models.create import FileCreateRequest, FileCreateResponse
from services.storage_service import storage_service

router = APIRouter(tags=["binary"])

CONTENT_TYPE = "application/octet-stream"


@router.post(
    "/create",
    response_model=FileCreateResponse,
    summary="创建空二进制文件",
    description="""
    在 S3 存储中创建一个空的二进制文件。

    - 文件名为请求中指定的名称
    - 自动生成 S3 存储路径
    - 创建后文件大小为 0 字节
    - 内容类型为 application/octet-stream

    创建成功后，可以使用 Editor API 进行内容编辑。
    适用于存储任意二进制数据。
    """,
    operation_id="createBinaryFile",
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
async def create_binary_file(
    request: FileCreateRequest,
) -> FileCreateResponse:
    """
    创建空二进制文件

    Args:
        request: 文件创建请求，包含文件名

    Returns:
        FileCreateResponse: 创建结果，包含 S3 路径和状态

    Example:
        ```python
        request = {
            "fileName": "data.bin",
            "fileType": "binary"
        }
        ```
    """
    s3_key = generate_binary_key(request.fileName)

    try:
        empty_file = io.BytesIO(b"")
        storage_service.upload(
            data=empty_file.getvalue(),
            key=s3_key,
            content_type=CONTENT_TYPE,
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
