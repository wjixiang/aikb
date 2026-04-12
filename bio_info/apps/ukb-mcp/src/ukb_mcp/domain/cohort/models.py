"""队列领域模型。"""

from __future__ import annotations

from pydantic import BaseModel, Field


class CohortCreateRequest(BaseModel):
    """创建队列请求。"""

    name: str = Field(description="队列名称。")
    filters: dict = Field(description="原始 vizserver pheno_filters 结构。")
    dataset_ref: str | None = Field(default=None, description="Dataset 引用。")
    folder: str = Field(default="/", description="目标文件夹路径。")
    description: str = Field(default="", description="队列描述。")
    entity_fields: list[str] = Field(
        default_factory=list,
        description='关联字段列表（"entity.field_name" 格式）。',
    )


class CohortInfo(BaseModel):
    """队列信息（创建接口返回）。"""

    id: str = Field(description="队列 ID。")
    name: str = ""
    project: str = ""
    folder: str = ""
    state: str = ""
    description: str = ""
    created: int = 0
    modified: int = 0
    participant_count: int = Field(default=0, description="参与者数量。")
    entity_fields: list[str] = Field(default_factory=list, description="关联字段。")


class CohortListItem(BaseModel):
    """队列列表项。"""

    id: str = Field(description="队列 record ID。")
    name: str = ""
    project: str = ""
    state: str = ""
    created: int = 0
    modified: int = 0


class CohortDetail(BaseModel):
    """队列详情（含 record details）。"""

    id: str = Field(description="队列 record ID。")
    name: str = ""
    project: str = ""
    state: str = ""
    created: int = 0
    modified: int = 0
    details: dict = Field(default_factory=dict, description="record details。")


class ExtractFieldsRequest(BaseModel):
    """提取字段请求。"""

    entity_fields: list[str] = Field(description='要提取的字段列表（"entity.field_name" 格式）。')
    refresh: bool = Field(default=False, description="是否跳过缓存。")
    limit: int = Field(default=100, ge=1, le=100, description="返回条数上限。")
    offset: int = Field(default=0, ge=0, description="偏移量。")


class ExtractFieldsResponse(BaseModel):
    """提取字段响应。"""

    data: list[dict] = Field(description="提取的数据行列表。")
    total: int = Field(description="总记录数。")
    limit: int = Field(description="每页条数。")
    offset: int = Field(description="偏移量。")
