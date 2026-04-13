"""数据库领域模型。"""

from __future__ import annotations

from pydantic import BaseModel, Field


class DatabaseInfo(BaseModel):
    """DNAnexus database 基本信息。"""

    id: str = Field(description="database 对象 ID，如 database-xxxx。")
    name: str = Field(default="", description="名称。")
    state: str = Field(default="", description="状态，如 open / closed。")
    project: str = Field(default="", description="所属项目 ID。")
    created: int = Field(default=0, description="创建时间戳 (Unix epoch)。")
    modified: int = Field(default=0, description="修改时间戳 (Unix epoch)。")


class DatabaseTableInfo(BaseModel):
    """数据库中的数据表。"""

    name: str = Field(description="表名。")
    total: int = Field(default=0, description="总记录数（仅在分页响应中有效）。")


class PaginatedTablesResponse(BaseModel):
    """带分页的数据表列表响应。"""

    data: list[DatabaseTableInfo] = Field(description="数据表列表。")
    total: int = Field(description="总记录数。")
    limit: int = Field(description="每页条数。")
    offset: int = Field(description="偏移量。")


class DatabaseFieldInfo(BaseModel):
    """数据集中的可用字段（精简视图）。"""

    entity: str = Field(description="实体名，如 participant。")
    name: str = Field(description="字段名，如 p31。")
    type: str = Field(description="字段类型，如 Integer / Continuous。")
    title: str = Field(default="", description="字段标题。")


class PaginatedFieldsResponse(BaseModel):
    """带分页的字段列表响应。"""

    data: list[DatabaseFieldInfo] = Field(description="字段列表。")
    total: int = Field(description="总记录数。")
    limit: int = Field(description="每页条数。")
    offset: int = Field(description="偏移量。")


class DatabaseQueryRequest(BaseModel):
    """数据库查询请求。"""

    entity_fields: list[str] = Field(
        default_factory=list,
        description='"entity.field_name" 格式的字段列表，如 ["participant.eid", "participant.p31"]。',
    )
    dataset_ref: str | None = Field(
        default=None,
        description="数据集引用 (project-xxx:record-yyy)，为空则自动查找。",
    )
    refresh: bool = Field(default=False, description="强制刷新缓存。")
    limit: int = Field(default=100, ge=1, le=100, description="返回条数上限。")
    offset: int = Field(default=0, ge=0, description="偏移量。")


class DatabaseQueryResponse(BaseModel):
    """数据库查询响应。"""

    data: list[dict] = Field(description="查询结果行列表。")
    total: int = Field(description="总记录数。")
    limit: int = Field(description="每页条数。")
    offset: int = Field(description="偏移量。")
