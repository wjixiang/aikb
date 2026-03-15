"""
XML API Router - XML 文件创建
"""

import io

from fastapi import APIRouter

from models.create import FileCreateRequest, FileCreateResponse
from services.storage_service import storage_service

router = APIRouter(tags=["xml"])

CONTENT_TYPE = "application/xml"
FILE_TYPE = "xml"


def generate_s3_key(file_name: str) -> str:
    """生成 s3_key: xml/{filename}"""
    return f"{FILE_TYPE}/{file_name}"


@router.post("/create", response_model=FileCreateResponse)
async def create_xml_file(request: FileCreateRequest):
    """创建空 XML 文件"""
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
