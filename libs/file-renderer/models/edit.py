"""
File Edit API Models - Editor API 请求/响应模型

基于 S3 Key 的扁平化管理，不依赖 file_id
提供统一的文件编辑操作接口
"""

from datetime import datetime
from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class EditorAction(str, Enum):
    """编辑器操作类型枚举"""

    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    MOVE = "move"
    COPY = "copy"
    EXISTS = "exists"


class UpdateMode(str, Enum):
    """文件更新模式枚举

    - OVERWRITE: 完全覆盖原有内容
    - APPEND: 在文件末尾追加内容
    - PREPEND: 在文件开头前置内容
    """

    OVERWRITE = "overwrite"
    APPEND = "append"
    PREPEND = "prepend"


# ==================== 请求模型 ====================

class FileCreateRequest(BaseModel):
    """文件创建请求模型"""

    s3_key: str = Field(
        ...,
        description="S3存储路径(key)",
        examples=["notes/my-note.md", "config/app.json"],
        min_length=1
    )
    content: str = Field(
        ...,
        description="文件内容",
        examples=["# Hello World\n\nThis is my note."]
    )
    content_type: str = Field(
        default="text/plain",
        description="内容类型 (MIME type)",
        examples=["text/plain", "text/markdown", "application/json"]
    )
    encoding: str = Field(
        default="utf-8",
        description="编码格式",
        examples=["utf-8", "gbk"]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "s3_key": "notes/my-note.md",
                    "content": "# Hello World\n\nThis is my note.",
                    "content_type": "text/markdown",
                    "encoding": "utf-8"
                }
            ]
        }
    }


class FileReadRequest(BaseModel):
    """文件读取请求模型"""

    s3_key: str = Field(
        ...,
        description="S3存储路径(key)",
        examples=["notes/my-note.md"],
        min_length=1
    )
    encoding: str = Field(
        default="utf-8",
        description="编码格式",
        examples=["utf-8", "gbk"]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "s3_key": "notes/my-note.md",
                    "encoding": "utf-8"
                }
            ]
        }
    }


class FileUpdateRequest(BaseModel):
    """文件更新请求模型"""

    s3_key: str = Field(
        ...,
        description="S3存储路径(key)",
        examples=["notes/my-note.md"],
        min_length=1
    )
    content: str = Field(
        ...,
        description="新内容",
        examples=["更新的内容"]
    )
    mode: UpdateMode = Field(
        default=UpdateMode.OVERWRITE,
        description="更新模式: overwrite(覆盖)/append(追加)/prepend(前置)"
    )
    encoding: str = Field(
        default="utf-8",
        description="编码格式",
        examples=["utf-8"]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "s3_key": "notes/my-note.md",
                    "content": "新内容",
                    "mode": "overwrite",
                    "encoding": "utf-8"
                }
            ]
        }
    }


class FileDeleteRequest(BaseModel):
    """文件删除请求模型"""

    s3_key: str = Field(
        ...,
        description="S3存储路径(key)",
        examples=["notes/my-note.md"],
        min_length=1
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "s3_key": "notes/my-note.md"
                }
            ]
        }
    }


class FileMoveRequest(BaseModel):
    """文件移动/重命名请求模型"""

    s3_key: str = Field(
        ...,
        description="当前S3路径",
        examples=["notes/old-name.md"],
        min_length=1
    )
    new_s3_key: str = Field(
        ...,
        description="新S3路径",
        examples=["notes/new-name.md"],
        min_length=1
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "s3_key": "notes/old-name.md",
                    "new_s3_key": "notes/new-name.md"
                }
            ]
        }
    }


class FileCopyRequest(BaseModel):
    """文件复制请求模型"""

    s3_key: str = Field(
        ...,
        description="源S3路径",
        examples=["notes/source.md"],
        min_length=1
    )
    new_s3_key: str = Field(
        ...,
        description="目标S3路径",
        examples=["notes/backup.md"],
        min_length=1
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "s3_key": "notes/source.md",
                    "new_s3_key": "notes/backup.md"
                }
            ]
        }
    }


class FileExistsRequest(BaseModel):
    """文件存在性检查请求模型"""

    s3_key: str = Field(
        ...,
        description="S3存储路径(key)",
        examples=["notes/my-note.md"],
        min_length=1
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "s3_key": "notes/my-note.md"
                }
            ]
        }
    }


class EditorUnifiedRequest(BaseModel):
    """统一编辑器请求模型

    支持所有操作类型: create/read/update/delete/move/copy/exists
    """

    action: EditorAction = Field(
        ...,
        description="操作类型",
        examples=["create", "read", "update", "delete", "move", "copy", "exists"]
    )
    s3_key: str = Field(
        ...,
        description="S3存储路径(key)",
        examples=["notes/my-note.md"],
        min_length=1
    )
    content: Optional[str] = Field(
        default=None,
        description="文件内容 (create/update 操作需要)"
    )
    content_type: Optional[str] = Field(
        default=None,
        description="内容类型 (create/update 操作需要)",
        examples=["text/markdown", "application/json"]
    )
    mode: Optional[UpdateMode] = Field(
        default=None,
        description="更新模式 (update 操作需要): overwrite/append/prepend"
    )
    new_s3_key: Optional[str] = Field(
        default=None,
        description="新S3路径 (move/copy 操作需要)",
        examples=["notes/new-name.md"]
    )
    encoding: str = Field(
        default="utf-8",
        description="编码格式",
        examples=["utf-8"]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "action": "create",
                    "s3_key": "notes/my-note.md",
                    "content": "# Hello World",
                    "content_type": "text/markdown",
                    "encoding": "utf-8"
                },
                {
                    "action": "read",
                    "s3_key": "notes/my-note.md",
                    "encoding": "utf-8"
                },
                {
                    "action": "move",
                    "s3_key": "notes/old-name.md",
                    "new_s3_key": "notes/new-name.md"
                }
            ]
        }
    }


# ==================== 响应模型 ====================

class FileEditResponse(BaseModel):
    """文件编辑操作通用响应模型"""

    success: bool = Field(
        ...,
        description="操作是否成功",
        examples=[True, False]
    )
    message: str = Field(
        ...,
        description="操作结果消息",
        examples=["操作成功", "文件不存在"]
    )
    action: str = Field(
        ...,
        description="执行的操作类型",
        examples=["create", "read", "update", "delete", "move", "copy", "exists"]
    )
    s3_key: Optional[str] = Field(
        default=None,
        description="S3存储路径",
        examples=["notes/my-note.md"]
    )
    new_s3_key: Optional[str] = Field(
        default=None,
        description="新S3路径 (move/copy 操作返回)",
        examples=["notes/new-name.md"]
    )
    content: Optional[str] = Field(
        default=None,
        description="文件内容 (read 操作返回)"
    )
    content_type: Optional[str] = Field(
        default=None,
        description="内容类型",
        examples=["text/markdown"]
    )
    file_size: Optional[int] = Field(
        default=None,
        description="文件大小(字节)",
        ge=0,
        examples=[1024]
    )
    exists: Optional[bool] = Field(
        default=None,
        description="文件是否存在 (exists 操作返回)",
        examples=[True, False]
    )
    encoding: Optional[str] = Field(
        default=None,
        description="编码格式",
        examples=["utf-8"]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": True,
                    "message": "操作成功",
                    "action": "create",
                    "s3_key": "notes/my-note.md",
                    "content_type": "text/markdown",
                    "file_size": 1024
                }
            ]
        }
    }


class FileCreateResponse(BaseModel):
    """文件创建响应模型"""

    success: bool = Field(default=True, description="操作是否成功")
    message: str = Field(default="File created successfully", description="响应消息")
    s3_key: str = Field(..., description="S3存储路径", examples=["notes/my-note.md"])
    content_type: str = Field(..., description="内容类型", examples=["text/markdown"])
    file_size: int = Field(..., description="文件大小(字节)", ge=0, examples=[1024])

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": True,
                    "message": "File created successfully",
                    "s3_key": "notes/my-note.md",
                    "content_type": "text/markdown",
                    "file_size": 1024
                }
            ]
        }
    }


class FileReadResponse(BaseModel):
    """文件读取响应模型"""

    success: bool = Field(default=True, description="操作是否成功")
    s3_key: str = Field(..., description="S3存储路径", examples=["notes/my-note.md"])
    content: str = Field(..., description="文件内容")
    content_type: Optional[str] = Field(
        default=None,
        description="内容类型",
        examples=["text/markdown"]
    )
    file_size: int = Field(..., description="文件大小(字节)", ge=0, examples=[1024])
    encoding: str = Field(default="utf-8", description="编码格式", examples=["utf-8"])

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": True,
                    "s3_key": "notes/my-note.md",
                    "content": "# Hello World\n\nThis is my note.",
                    "content_type": "text/markdown",
                    "file_size": 1024,
                    "encoding": "utf-8"
                }
            ]
        }
    }


class FileUpdateResponse(BaseModel):
    """文件更新响应模型"""

    success: bool = Field(default=True, description="操作是否成功")
    message: str = Field(default="File updated successfully", description="响应消息")
    s3_key: str = Field(..., description="S3存储路径", examples=["notes/my-note.md"])
    mode: UpdateMode = Field(..., description="更新模式")
    file_size: int = Field(..., description="更新后文件大小(字节)", ge=0, examples=[2048])

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": True,
                    "message": "File updated successfully",
                    "s3_key": "notes/my-note.md",
                    "mode": "overwrite",
                    "file_size": 2048
                }
            ]
        }
    }


class FileDeleteResponse(BaseModel):
    """文件删除响应模型"""

    success: bool = Field(default=True, description="操作是否成功")
    message: str = Field(default="File deleted successfully", description="响应消息")
    s3_key: str = Field(..., description="S3存储路径", examples=["notes/my-note.md"])

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": True,
                    "message": "File deleted successfully",
                    "s3_key": "notes/my-note.md"
                }
            ]
        }
    }


class FileMoveResponse(BaseModel):
    """文件移动响应模型"""

    success: bool = Field(default=True, description="操作是否成功")
    message: str = Field(default="File moved successfully", description="响应消息")
    s3_key: str = Field(..., description="原S3存储路径", examples=["notes/old-name.md"])
    new_s3_key: str = Field(..., description="新S3存储路径", examples=["notes/new-name.md"])

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": True,
                    "message": "File moved successfully",
                    "s3_key": "notes/old-name.md",
                    "new_s3_key": "notes/new-name.md"
                }
            ]
        }
    }


class FileCopyResponse(BaseModel):
    """文件复制响应模型"""

    success: bool = Field(default=True, description="操作是否成功")
    message: str = Field(default="File copied successfully", description="响应消息")
    s3_key: str = Field(..., description="源S3存储路径", examples=["notes/source.md"])
    new_s3_key: str = Field(..., description="目标S3存储路径", examples=["notes/backup.md"])

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": True,
                    "message": "File copied successfully",
                    "s3_key": "notes/source.md",
                    "new_s3_key": "notes/backup.md"
                }
            ]
        }
    }


class FileExistsResponse(BaseModel):
    """文件存在性检查响应模型"""

    exists: bool = Field(..., description="文件是否存在", examples=[True, False])
    s3_key: str = Field(..., description="S3存储路径", examples=["notes/my-note.md"])

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "exists": True,
                    "s3_key": "notes/my-note.md"
                }
            ]
        }
    }


# ==================== 错误响应模型 ====================

class EditorErrorResponse(BaseModel):
    """编辑器错误响应模型"""

    success: bool = Field(default=False, description="操作是否成功")
    message: str = Field(..., description="错误消息", examples=["文件不存在"])
    action: Optional[str] = Field(
        default=None,
        description="操作类型",
        examples=["read", "write"]
    )
    s3_key: Optional[str] = Field(
        default=None,
        description="S3存储路径",
        examples=["notes/my-note.md"]
    )
    error_code: Optional[str] = Field(
        default=None,
        description="错误代码",
        examples=["FILE_NOT_FOUND", "PERMISSION_DENIED"]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": False,
                    "message": "文件不存在",
                    "action": "read",
                    "s3_key": "notes/my-note.md",
                    "error_code": "FILE_NOT_FOUND"
                }
            ]
        }
    }


# ==================== 文件元数据模型 ====================

class FileMetadata(BaseModel):
    """文件元数据模型"""

    s3_key: str = Field(
        ...,
        description="S3存储路径",
        examples=["notes/my-note.md"]
    )
    file_name: str = Field(
        ...,
        description="文件名",
        examples=["my-note.md"]
    )
    content_type: str = Field(
        ...,
        description="内容类型 (MIME type)",
        examples=["text/markdown", "application/json"]
    )
    file_size: int = Field(
        ...,
        description="文件大小(字节)",
        ge=0,
        examples=[1024]
    )
    created_at: Optional[datetime] = Field(
        default=None,
        description="创建时间",
        examples=["2024-01-15T08:30:00Z"]
    )
    modified_at: Optional[datetime] = Field(
        default=None,
        description="修改时间",
        examples=["2024-01-15T08:35:00Z"]
    )
    etag: Optional[str] = Field(
        default=None,
        description="文件ETag",
        examples=["\"d41d8cd98f00b204e9800998ecf8427e\""]
    )
    custom_metadata: dict[str, str] = Field(
        default_factory=dict,
        description="自定义元数据",
        examples=[{"author": "user", "project": "notes"}]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "s3_key": "notes/my-note.md",
                    "file_name": "my-note.md",
                    "content_type": "text/markdown",
                    "file_size": 1024,
                    "created_at": "2024-01-15T08:30:00Z",
                    "modified_at": "2024-01-15T08:35:00Z",
                    "etag": "\"d41d8cd98f00b204e9800998ecf8427e\"",
                    "custom_metadata": {"author": "user"}
                }
            ]
        }
    }


class FileMetadataUpdateRequest(BaseModel):
    """文件元数据更新请求"""

    s3_key: str = Field(
        ...,
        description="S3存储路径",
        examples=["notes/my-note.md"]
    )
    custom_metadata: dict[str, str] = Field(
        ...,
        description="自定义元数据（会合并到现有元数据）",
        examples=[{"author": "user", "tags": "important"}]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "s3_key": "notes/my-note.md",
                    "custom_metadata": {"author": "user", "tags": "important"}
                }
            ]
        }
    }


class FileMetadataResponse(BaseModel):
    """文件元数据响应"""

    success: bool = Field(default=True, description="操作是否成功")
    message: str = Field(default="Metadata updated successfully", description="响应消息")
    s3_key: str = Field(..., description="S3存储路径")
    metadata: FileMetadata = Field(..., description="更新后的文件元数据")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": True,
                    "message": "Metadata updated successfully",
                    "s3_key": "notes/my-note.md",
                    "metadata": {
                        "s3_key": "notes/my-note.md",
                        "file_name": "my-note.md",
                        "content_type": "text/markdown",
                        "file_size": 1024,
                        "custom_metadata": {"author": "user"}
                    }
                }
            ]
        }
    }


# ==================== 文件列表模型 ====================

class FileListFilter(str, Enum):
    """文件列表过滤类型"""

    ALL = "all"
    TEXT = "text"
    MARKDOWN = "markdown"
    JSON = "json"
    PDF = "pdf"
    IMAGE = "image"


class FileListRequest(BaseModel):
    """文件列表请求"""

    prefix: str = Field(
        default="",
        description="文件路径前缀",
        examples=["notes/", "projects/2024/"]
    )
    filter_type: FileListFilter = Field(
        default=FileListFilter.ALL,
        description="文件类型过滤"
    )
    limit: int = Field(
        default=20,
        ge=1,
        le=100,
        description="每页数量",
        examples=[20]
    )
    offset: int = Field(
        default=0,
        ge=0,
        description="偏移量",
        examples=[0]
    )
    include_metadata: bool = Field(
        default=False,
        description="是否包含完整元数据"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "prefix": "notes/",
                    "filter_type": "markdown",
                    "limit": 20,
                    "offset": 0,
                    "include_metadata": True
                }
            ]
        }
    }


class FileListItem(BaseModel):
    """文件列表项"""

    s3_key: str = Field(..., description="S3存储路径")
    file_name: str = Field(..., description="文件名")
    content_type: str = Field(..., description="内容类型")
    file_size: int = Field(..., description="文件大小(字节)")
    modified_at: Optional[datetime] = Field(default=None, description="修改时间")


class FileListResponse(BaseModel):
    """文件列表响应"""

    success: bool = Field(default=True, description="操作是否成功")
    message: str = Field(default="Files retrieved successfully", description="响应消息")
    files: list[FileListItem | FileMetadata] = Field(
        default_factory=list,
        description="文件列表"
    )
    total: int = Field(..., description="总文件数")
    limit: int = Field(..., description="每页数量")
    offset: int = Field(..., description="当前偏移量")
    has_more: bool = Field(..., description="是否有更多结果")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": True,
                    "message": "Files retrieved successfully",
                    "files": [
                        {
                            "s3_key": "notes/doc1.md",
                            "file_name": "doc1.md",
                            "content_type": "text/markdown",
                            "file_size": 1024,
                            "modified_at": "2024-01-15T08:30:00Z"
                        }
                    ],
                    "total": 100,
                    "limit": 20,
                    "offset": 0,
                    "has_more": True
                }
            ]
        }
    }


# ==================== 文件版本控制模型 ====================

class FileVersion(BaseModel):
    """文件版本信息"""

    version_id: str = Field(
        ...,
        description="版本ID",
        examples=["v1", "v2", "20240115_083000"]
    )
    s3_key: str = Field(..., description="S3存储路径")
    file_size: int = Field(..., description="文件大小(字节)")
    created_at: datetime = Field(..., description="版本创建时间")
    comment: Optional[str] = Field(
        default=None,
        description="版本备注",
        examples=["Initial version", "Added section 3"]
    )
    created_by: Optional[str] = Field(
        default=None,
        description="创建者",
        examples=["user@example.com"]
    )


class FileVersionHistoryResponse(BaseModel):
    """文件版本历史响应"""

    success: bool = Field(default=True, description="操作是否成功")
    message: str = Field(default="Version history retrieved", description="响应消息")
    s3_key: str = Field(..., description="S3存储路径")
    versions: list[FileVersion] = Field(default_factory=list, description="版本列表")
    total_versions: int = Field(..., description="总版本数")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": True,
                    "message": "Version history retrieved",
                    "s3_key": "notes/my-note.md",
                    "versions": [
                        {
                            "version_id": "v1",
                            "s3_key": "notes/my-note.md",
                            "file_size": 1024,
                            "created_at": "2024-01-15T08:30:00Z",
                            "comment": "Initial version"
                        }
                    ],
                    "total_versions": 1
                }
            ]
        }
    }


class CreateVersionRequest(BaseModel):
    """创建版本请求"""

    s3_key: str = Field(..., description="S3存储路径")
    comment: Optional[str] = Field(
        default=None,
        description="版本备注",
        examples=["Checkpoint before major edit"]
    )


class RestoreVersionRequest(BaseModel):
    """恢复版本请求"""

    s3_key: str = Field(..., description="S3存储路径")
    version_id: str = Field(..., description="要恢复的版本ID")


class RestoreVersionResponse(BaseModel):
    """恢复版本响应"""

    success: bool = Field(default=True, description="操作是否成功")
    message: str = Field(default="Version restored successfully", description="响应消息")
    s3_key: str = Field(..., description="S3存储路径")
    restored_version: str = Field(..., description="恢复的版本ID")
    new_version_id: str = Field(..., description="新版本ID")


# ==================== 批量操作模型 ====================

class BatchOperationType(str, Enum):
    """批量操作类型"""

    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    COPY = "copy"
    MOVE = "move"


class BatchOperationItem(BaseModel):
    """批量操作单项"""

    s3_key: str = Field(..., description="目标S3路径")
    content: Optional[str] = Field(
        default=None,
        description="文件内容 (create/update 需要)"
    )
    content_type: Optional[str] = Field(
        default="text/plain",
        description="内容类型"
    )
    source_key: Optional[str] = Field(
        default=None,
        description="源S3路径 (copy/move 需要)"
    )
    custom_metadata: Optional[dict[str, str]] = Field(
        default=None,
        description="自定义元数据"
    )


class BatchOperationRequest(BaseModel):
    """批量操作请求"""

    operation: BatchOperationType = Field(..., description="操作类型")
    items: list[BatchOperationItem] = Field(
        ...,
        description="操作项列表",
        min_length=1,
        max_length=100
    )
    continue_on_error: bool = Field(
        default=True,
        description="遇到错误时是否继续处理后续项"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "operation": "create",
                    "items": [
                        {
                            "s3_key": "notes/file1.md",
                            "content": "# File 1",
                            "content_type": "text/markdown"
                        },
                        {
                            "s3_key": "notes/file2.md",
                            "content": "# File 2",
                            "content_type": "text/markdown"
                        }
                    ],
                    "continue_on_error": True
                }
            ]
        }
    }


class BatchOperationResult(BaseModel):
    """批量操作单项结果"""

    s3_key: str = Field(..., description="S3存储路径")
    success: bool = Field(..., description="操作是否成功")
    message: str = Field(..., description="结果消息")
    error_code: Optional[str] = Field(default=None, description="错误代码")


class BatchOperationResponse(BaseModel):
    """批量操作响应"""

    success: bool = Field(default=True, description="总体是否成功")
    message: str = Field(default="Batch operation completed", description="响应消息")
    operation: BatchOperationType = Field(..., description="操作类型")
    total: int = Field(..., description="总操作数")
    succeeded: int = Field(..., description="成功数")
    failed: int = Field(..., description="失败数")
    results: list[BatchOperationResult] = Field(default_factory=list, description="详细结果")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": True,
                    "message": "Batch operation completed",
                    "operation": "create",
                    "total": 2,
                    "succeeded": 2,
                    "failed": 0,
                    "results": [
                        {
                            "s3_key": "notes/file1.md",
                            "success": True,
                            "message": "File created successfully"
                        },
                        {
                            "s3_key": "notes/file2.md",
                            "success": True,
                            "message": "File created successfully"
                        }
                    ]
                }
            ]
        }
    }


# ==================== 文件转换模型 ====================

class ConvertFormat(str, Enum):
    """目标转换格式"""

    MARKDOWN = "markdown"
    TEXT = "text"
    HTML = "html"
    JSON = "json"


class FileConvertRequest(BaseModel):
    """文件转换请求"""

    target_format: ConvertFormat = Field(
        ...,
        description="目标格式",
        examples=["markdown", "text"]
    )
    target_s3_key: Optional[str] = Field(
        default=None,
        description="转换后文件存储路径（不指定则自动生成）"
    )
    options: dict[str, Any] = Field(
        default_factory=dict,
        description="转换选项",
        examples=[{"preserve_images": True, "extract_tables": True}]
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "target_format": "markdown",
                    "target_s3_key": "output/document.md",
                    "options": {"preserve_images": True}
                }
            ]
        }
    }


class FileConvertResponse(BaseModel):
    """文件转换响应"""

    success: bool = Field(default=True, description="操作是否成功")
    message: str = Field(default="File converted successfully", description="响应消息")
    source_s3_key: str = Field(..., description="源文件S3路径")
    target_s3_key: str = Field(..., description="目标文件S3路径")
    source_format: str = Field(..., description="源文件格式")
    target_format: str = Field(..., description="目标文件格式")
    file_size: int = Field(..., description="转换后文件大小(字节)")
    pages: Optional[int] = Field(
        default=None,
        description="转换后页数（如果适用）"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": True,
                    "message": "File converted successfully",
                    "source_s3_key": "input/document.pdf",
                    "target_s3_key": "output/document.md",
                    "source_format": "pdf",
                    "target_format": "markdown",
                    "file_size": 5120,
                    "pages": 10
                }
            ]
        }
    }


# ==================== 统一文件操作模型 (RESTful风格) ====================

class FileCreateRESTRequest(BaseModel):
    """RESTful 文件创建请求"""

    content: str = Field(..., description="文件内容")
    content_type: str = Field(
        default="text/plain",
        description="内容类型 (MIME type)"
    )
    encoding: str = Field(default="utf-8", description="编码格式")
    custom_metadata: dict[str, str] = Field(
        default_factory=dict,
        description="自定义元数据"
    )


class FileUpdateRESTRequest(BaseModel):
    """RESTful 文件更新请求"""

    content: str = Field(..., description="文件内容")
    mode: UpdateMode = Field(default=UpdateMode.OVERWRITE, description="更新模式")
    encoding: str = Field(default="utf-8", description="编码格式")
    create_version: bool = Field(
        default=True,
        description="更新前是否创建版本"
    )
    version_comment: Optional[str] = Field(
        default=None,
        description="版本备注"
    )


class FileRESTResponse(BaseModel):
    """RESTful 文件操作响应"""

    success: bool = Field(default=True, description="操作是否成功")
    message: str = Field(..., description="响应消息")
    s3_key: str = Field(..., description="S3存储路径")
    content_type: str = Field(..., description="内容类型")
    file_size: int = Field(..., description="文件大小(字节)")
    version_id: Optional[str] = Field(default=None, description="版本ID（如果创建了版本）")
    metadata: Optional[FileMetadata] = Field(default=None, description="文件元数据")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "success": True,
                    "message": "File created successfully",
                    "s3_key": "notes/my-note.md",
                    "content_type": "text/markdown",
                    "file_size": 1024,
                    "version_id": "v1"
                }
            ]
        }
    }
