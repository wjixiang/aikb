"""
XML API Router - XML 文件创建
"""

import io

from fastapi import APIRouter

from lib.s3_key_generator import generate_xml_key
from models.create import FileCreateRequest, FileCreateResponse
from services.storage_service import storage_service

router = APIRouter(tags=["xml"])

CONTENT_TYPE = "application/xml"


@router.post("/create", response_model=FileCreateResponse)
async def create_xml_file(request: FileCreateRequest):
    """创建空 XML 文件"""
    s3_key = generate_xml_key(request.fileName)

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
