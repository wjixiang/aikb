"""DNAnexus 文件操作数据模型。"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class FileInfo(BaseModel):
    """文件元数据响应模型。"""

    model_config = ConfigDict(extra="allow")

    id: str = Field(description="文件 ID")
    name: str = Field(description="文件名")
    project: str = Field(description="所属项目 ID")
    folder: str = Field(description="所在文件夹路径")
    state: str = Field(description="文件状态")
    size: int = Field(description="文件大小（字节）")
    created: int = Field(description="创建时间戳")
    modified: int = Field(description="修改时间戳")
    description: str = Field(default="", description="描述")
    md5: str = Field(default="", description="MD5 校验和")
    sha256: str = Field(default="", description="SHA256 校验和")


class FileListItem(BaseModel):
    """文件列表项。"""

    id: str = Field(description="文件 ID")
    name: str = Field(description="文件名")
    project: str = Field(description="所属项目 ID")
    folder: str = Field(description="所在文件夹路径")
    state: str = Field(description="文件状态")
    size: int = Field(description="文件大小（字节）")
    created: int = Field(description="创建时间戳")
    modified: int = Field(description="修改时间戳")


class FileUploadRequest(BaseModel):
    """文件上传请求。"""

    name: str | None = Field(
        default=None, description="上传后的文件名。为 None 时使用本地文件名。"
    )
    folder: str = Field(default="/", description="目标文件夹路径。")
    project_id: str | None = Field(
        default=None, description="目标项目 ID。为 None 时使用当前项目上下文。"
    )


class FileDownloadRequest(BaseModel):
    """文件下载请求。"""

    project_id: str | None = Field(
        default=None, description="项目 ID。为 None 时使用当前项目上下文。"
    )
