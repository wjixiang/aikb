"""
CSV API Router - CSV 文件创建
"""

import io

from fastapi import APIRouter

from models.create import FileCreateRequest, FileCreateResponse
from services.storage_service import storage_service

router = APIRouter(tags=["csv"])

CONTENT_TYPE = "text/csv"
FILE_TYPE = "csv"


def generate_s3_key(file_name: str) -> str:
    """生成 s3_key: csv/{filename}"""
    return f"{FILE_TYPE}/{file_name}"


@router.post("/create", response_model=FileCreateResponse)
async def create_csv_file(request: FileCreateRequest):
    """创建空 CSV 文件"""
    s3_key = generate_s3_key(request.fileName)

    try:
        empty_file = io.BytesIO(b"")
        storage_service.upload(
            data=empty_file.getvalue(),
            key=s3_key,
            content_type=CONTENT_TYPE
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
