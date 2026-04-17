"""DNAnexus 平台 Pydantic 数据模型。"""

from __future__ import annotations

from typing import Any, Literal, Union

from pydantic import BaseModel, ConfigDict, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class DXClientConfig(BaseSettings):
    """DXClient 连接配置。

    优先级：构造参数 > 环境变量 > 默认值。
    """

    model_config = SettingsConfigDict(env_prefix="", extra="ignore")

    auth_token: str = Field(
        default="",
        validation_alias="DX_AUTH_TOKEN",
        description="DNAnexus auth token，对应环境变量 DX_AUTH_TOKEN。",
    )
    project_context_id: str = Field(
        default="",
        validation_alias="DX_PROJECT_CONTEXT_ID",
        description="默认项目上下文 ID，对应环境变量 DX_PROJECT_CONTEXT_ID。",
    )
    api_server_host: str = Field(
        default="api.dnanexus.com",
        description="DNAnexus API 服务器主机名。",
    )
    api_server_port: int = Field(
        default=443,
        description="DNAnexus API 服务器端口。",
    )
    api_server_protocol: str = Field(
        default="https",
        description="DNAnexus API 协议 (http / https)。",
    )


class DXProject(BaseModel):
    """DNAnexus 项目描述。"""

    model_config = ConfigDict(extra="allow")

    id: str = ""
    name: str = ""
    description: str = ""
    created: int = 0
    modified: int = 0
    data_usage: dict[str, Any] = Field(default_factory=dict)
    region: str = ""
    total_size: int = 0
    billable: bool = True
    permission_level: str = ""


class DXFileInfo(BaseModel):
    """DNAnexus 文件元数据。"""

    model_config = ConfigDict(extra="allow")

    id: str = ""
    name: str = ""
    project: str = ""
    folder: str = ""
    state: str = ""
    size: int = 0
    created: int = 0
    modified: int = 0
    description: str = ""
    properties: dict[str, Any] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    types: list[str] = Field(default_factory=list)
    md5: str = ""
    sha256: str = ""


class DXRecordInfo(BaseModel):
    """DNAnexus 记录元数据。"""

    model_config = ConfigDict(extra="allow")

    id: str = ""
    name: str = ""
    project: str = ""
    folder: str = ""
    created: int = 0
    modified: int = 0
    state: str = ""
    description: str = ""
    properties: dict[str, Any] = Field(default_factory=dict)
    types: list[str] = Field(default_factory=list)
    details: dict[str, Any] = Field(default_factory=dict)


class DXDatabaseInfo(BaseModel):
    """DNAnexus database 数据对象描述。"""

    model_config = ConfigDict(extra="allow")

    id: str = ""
    project: str = ""
    name: str = ""
    folder: str = ""
    state: str = ""
    created: int = 0
    modified: int = 0
    description: str = ""
    properties: dict[str, Any] = Field(default_factory=dict)
    visibility: str = "visible"
    database_name: str = ""
    db_schema: dict[str, Any] = Field(default_factory=dict, alias="schema")
    record_count: int = 0


class DXDatabaseColumn(BaseModel):
    """数据库列描述。"""

    model_config = ConfigDict(extra="allow")

    name: str = ""
    type: str = ""
    description: str = ""
    nullable: bool = True


class DXDatabaseTable(BaseModel):
    """数据库表描述，包含所有列信息。"""

    model_config = ConfigDict(extra="allow")

    name: str = ""
    description: str = ""
    columns: list[DXDatabaseColumn] = Field(default_factory=list)


class DXDataObject(BaseModel):
    """DNAnexus 通用数据对象描述。"""

    model_config = ConfigDict(extra="allow")

    id: str = ""
    project: str = ""
    name: str = ""
    folder: str = ""
    classname: str = ""
    state: str = ""
    created: int = 0
    modified: int = 0
    size: int = 0
    description: str = ""
    properties: dict[str, Any] = Field(default_factory=dict)


class DXCohortInfo(BaseModel):
    """DNAnexus cohort record 描述。"""

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    id: str = ""
    name: str = ""
    project: str = ""
    folder: str = ""
    state: str = ""
    description: str = ""
    created: int = 0
    modified: int = 0
    participant_count: int = 0
    entity_fields: list[str] = Field(default_factory=list)


class DXDatabaseClusterInfo(BaseModel):
    """DNAnexus database 对象完整描述（来自 database_describe API）。"""

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    id: str = ""
    project: str = ""
    name: str = ""
    class_name: str = Field(default="", alias="class")
    state: str = ""
    created: int = 0
    modified: int = 0
    folder: str = ""
    description: str = ""
    database_name: str = Field(default="", alias="databaseName")
    unique_database_name: str = Field(default="", alias="uniqueDatabaseName")
    visibility: str = "visible"
    sponsored: bool = False
    hidden: bool = False


class DXJobInfo(BaseModel):
    """DNAnexus job 描述。"""

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    id: str = ""
    name: str = ""
    state: str = ""
    project: str = ""
    folder: str = ""
    created: int = 0
    modified: int = 0
    started_running: int = Field(default=0, alias="startedRunning")
    stopped_running: int = Field(default=0, alias="stoppedRunning")
    executable_name: str = Field(default="", alias="executableName")
    launched_by: str = Field(default="", alias="launchedBy")
    root_execution: str = Field(default="", alias="rootExecution")
    parent_job: str = Field(default="", alias="parentJob")
    origin_job: str = Field(default="", alias="originJob")
    function: str = ""
    region: str = ""
    tags: list[str] = Field(default_factory=list)
    properties: dict[str, Any] = Field(default_factory=dict)
    run_input: dict[str, Any] = Field(default_factory=dict, alias="runInput")
    input: dict[str, Any] = Field(default_factory=dict)
    output: dict[str, Any] = Field(default_factory=dict)
    failure_reason: str = Field(default="", alias="failureReason")
    failure_message: str = Field(default="", alias="failureMessage")
    state_transitions: list[dict[str, Any]] = Field(
        default_factory=list,
        alias="stateTransitions",
    )
    app: str = ""
    applet: str = ""
    analysis: str = ""
    bill_to: str = Field(default="", alias="billTo")
    total_price: float = Field(default=0.0, alias="totalPrice")


class VizInfo(BaseModel):
    """Vizserver 可视化端点响应。

    通过 ``GET /{record_id}/visualize`` 获取，包含 vizserver 连接信息和数据集元数据。
    """

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    url: str = Field(description="Vizserver 基础 URL")
    dataset: str = Field(description="Dataset record ID")
    dataset_version: str = Field(
        "", alias="datasetVersion", description="数据集版本，应为 3.0"
    )
    dataset_record_project: str = Field("", alias="datasetRecordProject")
    record_types: list[str] = Field(default_factory=list, alias="recordTypes")
    record_name: str = Field("", alias="recordName")
    databases: list[Any] = Field(default_factory=list)
    dataset_schema: dict[str, Any] | str = Field(default_factory=dict, alias="schema")
    base_sql: str | None = Field(None, alias="baseSql")
    filters: dict[str, Any] = Field(default_factory=dict)
    combined: dict[str, Any] = Field(default_factory=dict)


# ── Vizserver Payload Models ──────────────────────────────────────────────────


class VizFieldMapping(BaseModel):
    """Vizserver 字段映射。

    Key = 输出列别名，Value = entity$field 格式的完整路径。
    例如：VizFieldMapping(eid="participant$eid")
    """

    model_config = ConfigDict(extra="allow")


VizCondition = Literal[
    "is",
    "is-not",
    "in",
    "not-in",
    "contains",
    "greater-than",
    "greater-than-eq",
    "less-than",
    "less-than-eq",
    "between",
    "is-empty",
    "exists",
]
"""Vizserver 支持的固定条件类型。

- ``is`` / ``is-not``: 等于 / 不等于（需提供 values）
- ``in`` / ``not-in``: 属于 / 不属于列表（需提供 values）
- ``contains``: 文本包含（需提供 values）
- ``greater-than`` / ``greater-than-eq`` / ``less-than`` / ``less-than-eq``: 比较（需提供 values）
- ``between``: 区间（需提供两个 values）
- ``is-empty``: 字段为空/不存在（无 values）
- ``exists``: 字段存在/非空（无 values）
"""


class VizFilterCondition(BaseModel):
    """Vizserver 叶级过滤条件。"""

    model_config = ConfigDict(populate_by_name=True)

    condition: VizCondition = Field(
        description="条件类型",
    )
    values: list[Any] | Any = Field(default_factory=list, description="条件值或值列表")


class VizCompoundFilterEntry(BaseModel):
    """pheno_filters.compound 中的单条条目。"""

    name: str = Field(description='分组名称，通常为 "phenotype"')
    logic: Literal["and", "or"] = Field(description="组内逻辑组合")
    filters: dict[str, list[VizFilterCondition]] = Field(
        description='字段过滤条件，key 为 "entity$field" 格式',
    )


class VizPhenoFiltersInner(BaseModel):
    """pheno_filters 内层结构。"""

    logic: Literal["and", "or"]
    compound: list[VizCompoundFilterEntry]


class VizPhenoFilters(BaseModel):
    """Vizserver 原生 cohort filter 格式。

    示例::

        {
            "logic": "and",
            "pheno_filters": {
                "logic": "and",
                "compound": [{
                    "name": "phenotype",
                    "logic": "and",
                    "filters": {
                        "participant$p131286": [{"condition": "exists", "values": []}]
                    }
                }]
            }
        }
    """

    logic: Literal["and", "or"]
    pheno_filters: VizPhenoFiltersInner


# ── LLM-friendly filter formats ─────────────────────────────────────────────


class FilterRule(BaseModel):
    """单条筛选规则（LLM 常用格式）。

    兼容 ``operator`` / ``type`` 两种键名表示条件操作符。

    支持的 operator：

    - **空值检查**（无需 value）：``is_null``, ``is_not_null``, ``is_empty``, ``not_empty``
    - **等于/不等于**（需 value）：``eq``, ``neq``, ``is``, ``is_not``, ``equals``, ``not_equals``
    - **列表**（需 values）：``in``, ``not_in``
    - **文本**（需 value）：``contains``
    - **比较**（需 value）：``gt``, ``gte``, ``lt``, ``lte``
    - **区间**（需 2 个 values）：``between``
    """

    field: str = Field(description='字段名，"entity.field_name" 格式')
    operator: str = Field(
        default="is",
        description="操作符：is_null, is_not_null, eq, neq, in, not_in, gt, gte, lt, lte, between, contains 等",
    )
    type: str | None = Field(
        default=None, description="操作符别名（与 operator 二选一）"
    )
    value: Any = Field(default=None, description="条件值（单值）")
    values: list[Any] | None = Field(default=None, description="条件值（列表）")


class RulesFilter(BaseModel):
    """LLM 常用的 logical/rules 格式。

    支持 ``logic`` / ``logical`` 两种键名，大小写不敏感。
    ``rules`` 支持嵌套（子 group 同样为 RulesFilter）。
    """

    model_config = ConfigDict(extra="ignore")

    logic: Literal["and", "or", "AND", "OR"] | None = None
    logical: Literal["and", "or", "AND", "OR"] | None = None
    rules: list[Union[FilterRule, "RulesFilter"]] = Field(
        description="筛选规则列表，支持嵌套 RulesFilter",
    )


CohortFilters = Union[VizPhenoFilters, RulesFilter, FilterRule]
"""Cohort 筛选条件联合类型。

支持三种输入格式：
- ``VizPhenoFilters`` — vizserver 原生格式
- ``RulesFilter`` — LLM 常用的 logical/rules 格式
- ``FilterRule`` — 单条规则快捷格式
"""

RulesFilter.model_rebuild()


class VizRawDataPayload(BaseModel):
    """``/data/3.0/{dataset}/raw`` 请求体。"""

    project_context: str = Field(description="项目 ID")
    fields: list[VizFieldMapping] = Field(
        default_factory=list,
        description="字段映射列表，如 [VizFieldMapping(eid='participant$eid')]",
    )
    limit: int | None = Field(None, description="最大返回行数")
    offset: int | None = Field(None, description="结果偏移量（部分 vizserver 支持）")
    order_by: list[dict[str, str]] | None = Field(
        None, description="排序，如 [{'column': 'asc'}]"
    )
    base_sql: str | None = Field(None, description="Dataset base SQL")
    filters: VizPhenoFilters | None = Field(None, description="pheno_filters 结构")
    raw_filters: dict[str, Any] | None = Field(
        None, description="assay_filters 结构（变异/表达）"
    )
    return_query: bool = Field(False, description="若为 True，返回 SQL 而非执行结果")


class VizQueryPayload(BaseModel):
    """``/viz-query/3.0/{dataset}/raw-query`` 请求体。"""

    project_context: str = Field(description="项目 ID")
    fields: list[VizFieldMapping] = Field(default_factory=list)
    return_query: bool = Field(True, description="固定为 True，返回 SQL")
    base_sql: str | None = Field(None)
    filters: VizPhenoFilters | None = Field(None)
    raw_filters: dict[str, Any] | None = Field(None)
    order_by: list[dict[str, str]] | None = Field(None)


class VizCohortQueryPayload(BaseModel):
    """``/viz-query/3.0/{dataset}/raw-cohort-query`` 请求体。"""

    project_context: str = Field(description="项目 ID")
    filters: VizPhenoFilters | None = Field(None)
    base_sql: str | None = Field(None)
    fields: list[VizFieldMapping] | None = Field(None)


# ── Vizserver Response Models ─────────────────────────────────────────────────


class VizQueryResult(BaseModel):
    """``/data/3.0/{dataset}/raw`` 查询结果。

    Attributes:
        results: 查询结果行列表。每行是一个 dict，key 为请求时指定的字段别名，
            value 为该字段的值。值类型取决于字段定义（字符串、数值、列表等）。
        sql: 如果 payload 中 ``return_query=True``，还会返回生成的 SQL 字符串。
    """

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    results: list[dict[str, Any]] = Field(
        default_factory=list,
        description="查询结果行列表，每行 dict 的 key = 字段别名，value = 字段值",
    )
    sql: str | None = Field(None, description="生成的 SQL（return_query=True 时返回）")


class CohortDownloadResult(BaseModel):
    namespace: str
    table_name: str
