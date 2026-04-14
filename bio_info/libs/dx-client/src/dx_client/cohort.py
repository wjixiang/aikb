"""Cohort 创建纯 Python 实现。

从 dxpy CLI (dataset_utilities.py / cohort_filter_payload.py) 中提取的核心逻辑，
去掉 CLI 依赖，改为纯函数 + 异常抛出。
"""

from __future__ import annotations

import gzip
import io
import json
import logging
from collections import OrderedDict
from typing import Any, Literal

import dxpy
from pydantic import ValidationError

from .dx_exceptions import DXCohortError
from .dx_models import (
    CohortFilters,
    FilterRule,
    RulesFilter,
    VizCompoundFilterEntry,
    VizCondition,
    VizFilterCondition,
    VizPhenoFilters,
    VizPhenoFiltersInner,
)

logger = logging.getLogger(__name__)

# ── Operator → VizCondition 映射 ────────────────────────────────────────
#
# LLM / 调用方传入的 operator 会映射到固定的 VizCondition 类型。
# 不再使用 "exists" / "not-exists"，统一为 is-empty / not-empty。
# 对于需要 values 的条件（is, is-not, in, not-in 等），values 必须非空。

_NO_VALUE_CONDITIONS: set[str] = {"is-empty", "exists"}
_CONDITIONS_REQUIRING_VALUES: set[str] = {
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
}

_OP_TO_CONDITION: dict[str, VizCondition] = {
    "is_null": "is-empty",
    "is_not_null": "exists",
    "is_empty": "is-empty",
    "not_empty": "exists",
    "empty": "is-empty",
    "eq": "is",
    "equals": "is",
    "is": "is",
    "neq": "is-not",
    "not_equals": "is-not",
    "is_not": "is-not",
    "in": "in",
    "not_in": "not-in",
    "contains": "contains",
    "gt": "greater-than",
    "gte": "greater-than-eq",
    "lt": "less-than",
    "lte": "less-than-eq",
    "between": "between",
    "any": "in",
    "not_any": "not-in",
    "all": "in",
}


def _rule_to_vizserver_filter(rule: FilterRule) -> dict[str, list[VizFilterCondition]]:
    """将单条 FilterRule 转为 vizserver filters dict。"""
    field = _ensure_vizserver_key(rule.field)
    operator = rule.operator or rule.type or "is"

    # 先尝试查映射表
    condition: VizCondition | None = _OP_TO_CONDITION.get(operator)

    if condition is None:
        raise DXCohortError(
            f"Unsupported filter operator '{operator}'. "
            f"Supported: {sorted(_OP_TO_CONDITION.keys())}"
        )

    if condition in _NO_VALUE_CONDITIONS:
        values: list[Any] = []
        return {field: [VizFilterCondition(condition=condition)]}
    elif condition in _CONDITIONS_REQUIRING_VALUES:
        values = rule.value if rule.value is not None else (rule.values or [])
        if not values:
            raise DXCohortError(
                f"Filter operator '{operator}' (condition '{condition}') requires non-empty values. "
                f"For null/empty checks use 'is_null' or 'is_not_null' instead."
            )
    else:
        values = rule.value if rule.value is not None else (rule.values or [])

    return {field: [VizFilterCondition(condition=condition, values=values)]}


def _merge_rules(
    rules: list[FilterRule | RulesFilter],
) -> dict[str, list[VizFilterCondition]]:
    """将 rules 列表合并为 vizserver filters dict。"""
    merged: dict[str, list[VizFilterCondition]] = {}
    for rule in rules:
        if isinstance(rule, RulesFilter):
            nested = _normalize_rules_filter(rule)
            for item in nested.pheno_filters.compound:
                for fk, fv in item.filters.items():
                    merged.setdefault(fk, []).extend(fv)
        else:
            for k, v in _rule_to_vizserver_filter(rule).items():
                merged.setdefault(k, []).extend(v)
    return merged


def _normalize_rules_filter(filters: RulesFilter) -> VizPhenoFilters:
    """将 RulesFilter 转换为 VizPhenoFilters。"""
    logic: Literal["and", "or"] = (filters.logical or filters.logic or "and").lower()  # type: ignore[assignment]
    merged = _merge_rules(filters.rules)
    return VizPhenoFilters(
        logic=logic,
        pheno_filters=VizPhenoFiltersInner(
            logic=logic,
            compound=[
                VizCompoundFilterEntry(
                    name="phenotype",
                    logic=logic,
                    filters=merged,
                )
            ],
        ),
    )


def _ensure_vizserver_key(key: str) -> str:
    """将过滤器键规范化为 vizserver 要求的 ``entity$field`` 格式。

    - 已包含 ``$`` 的键（如 ``participant$p131286``）原样返回。
    - 包含 ``.`` 的键（如 ``participant.p131286``）替换为 ``$``。
    - 纯字段名（如 ``p131286``）抛出 ``DXCohortError``。

    Raises:
        DXCohortError: 键不包含 entity 前缀。
    """
    if "$" in key:
        return key
    if "." in key:
        return key.replace(".", "$", 1)
    raise DXCohortError(
        f"Filter key '{key}' must include an entity prefix in "
        f"'entity.field' or 'entity$field' format (e.g. 'participant.{key}')."
    )


def _normalize_pheno_filter_keys(viz: VizPhenoFilters) -> VizPhenoFilters:
    """确保 VizPhenoFilters 中所有 compound filter 的键都是 ``entity$field`` 格式。"""
    new_compound: list[VizCompoundFilterEntry] = []
    for entry in viz.pheno_filters.compound:
        normalized_filters: dict[str, list[VizFilterCondition]] = {}
        for k, v in entry.filters.items():
            normalized_filters[_ensure_vizserver_key(k)] = v
        new_compound.append(
            VizCompoundFilterEntry(
                name=entry.name,
                logic=entry.logic,
                filters=normalized_filters,
            )
        )
    return VizPhenoFilters(
        logic=viz.logic,
        pheno_filters=VizPhenoFiltersInner(
            logic=viz.pheno_filters.logic,
            compound=new_compound,
        ),
    )


def normalize_cohort_filters(
    filters: CohortFilters | dict[str, Any],
) -> VizPhenoFilters:
    """将常见筛选条件格式规范化为 vizserver pheno_filters 格式。

    接受三种输入格式：

    1. **VizPhenoFilters** — vizserver 原生格式，键会自动规范化为 ``entity$field``。
    2. **RulesFilter** — LLM 常用的 logical/rules 格式，自动转换。
    3. **FilterRule** — 单条规则快捷格式，包装为 AND 逻辑。

    也接受原始 dict，会尝试自动识别格式并转换。

    Args:
        filters: 筛选条件，支持 ``CohortFilters`` 联合类型或原始 dict。

    Returns:
        ``VizPhenoFilters`` 实例，所有过滤器键均为 ``entity$field`` 格式。

    Raises:
        DXCohortError: 输入格式无法识别或校验失败。
    """
    # dict 输入：先尝试解析为 typed model
    if isinstance(filters, dict):
        # 已经是 vizserver 格式
        if "pheno_filters" in filters:
            try:
                parsed = VizPhenoFilters.model_validate(filters)
                return _normalize_pheno_filter_keys(parsed)
            except ValidationError as e:
                raise DXCohortError(
                    f"Invalid vizserver pheno_filters format: {e}",
                ) from e

        # 尝试解析为 RulesFilter 或 FilterRule
        try:
            if "rules" in filters:
                parsed = RulesFilter.model_validate(filters)
                return _normalize_rules_filter(parsed)
            elif "field" in filters:
                parsed = FilterRule.model_validate(filters)
                return _normalize_rules_filter(RulesFilter(logic="and", rules=[parsed]))
        except ValidationError as e:
            raise DXCohortError(
                f"Invalid filter format: {e}",
            ) from e

        raise DXCohortError(
            f"Unknown filter format: {filters}. "
            "Expected VizPhenoFilters, RulesFilter, or FilterRule.",
        )

    # typed model 输入
    if isinstance(filters, VizPhenoFilters):
        return _normalize_pheno_filter_keys(filters)

    if isinstance(filters, RulesFilter):
        return _normalize_rules_filter(filters)

    if isinstance(filters, FilterRule):
        return _normalize_rules_filter(RulesFilter(logic="and", rules=[filters]))

    raise DXCohortError(f"Unsupported filter type: {type(filters).__name__}")


# ── Vizserver 交互 ──────────────────────────────────────────────────────


def get_visualize_info(
    record_id: str,
    project: str,
    *,
    cohort_browser: bool = False,
) -> dict[str, Any]:
    """调用 ``/record-xxx/visualize`` 获取 vizserver 连接信息。

    Args:
        record_id: Dataset 或 CohortBrowser 的 record ID。
        project: 所属项目 ID。
        cohort_browser: 为 True 时返回 Cohort 特有的 filters 和 baseSql。
                      Dataset 应传 False，CohortBrowser 应传 True。

    Returns:
        vizserver 响应 dict，包含 url、dataset、databases、schema 等字段。
        当 cohort_browser=True 时额外包含 baseSql 和 filters 字段。

    Raises:
        DXCohortError: record 无效、版本不支持或权限不足。
    """
    try:
        resp = dxpy.DXHTTPRequest(
            "/%s/visualize" % record_id,
            {"project": project, "cohortBrowser": cohort_browser},
        )
    except Exception as e:
        raise DXCohortError(
            f"Failed to get visualize info for '{record_id}': {e}",
            dx_error=e,
        ) from e

    if resp.get("datasetVersion") != "3.0":
        raise DXCohortError(
            f"Unsupported dataset version '{resp.get('datasetVersion')}'. "
            "Only version 3.0 is supported."
        )

    record_types = resp.get("recordTypes", [])
    if "Dataset" not in record_types and "CohortBrowser" not in record_types:
        raise DXCohortError(
            f"Record '{record_id}' is not a Dataset or CohortBrowser. "
            f"Types: {record_types}"
        )

    return resp


def get_dataset_descriptor(record_id: str, project: str) -> dict[str, Any]:
    """下载并解析 dataset 的 gzipped JSON descriptor。

    Args:
        record_id: Dataset record ID。
        project: 所属项目 ID。

    Returns:
        解析后的 descriptor dict，包含 model、join_info 等字段。
    """
    try:
        desc = dxpy.describe(
            record_id,
            fields={"properties", "details"},
            default_fields=True,
        )
    except Exception as e:
        raise DXCohortError(
            f"Failed to describe dataset '{record_id}': {e}",
            dx_error=e,
        ) from e

    details: dict[str, Any] = desc.get("details", {})  # type: ignore[assignment]
    descriptor_link = details.get("descriptor")
    if not descriptor_link:
        raise DXCohortError(f"No descriptor found in dataset '{record_id}' details.")

    # 解析 $dnanexus_link
    if isinstance(descriptor_link, dict) and "$dnanexus_link" in descriptor_link:
        file_id = descriptor_link["$dnanexus_link"]
        if isinstance(file_id, dict):
            file_id = file_id.get("id", "")
    else:
        file_id = str(descriptor_link)

    try:
        file_obj = dxpy.DXFile(file_id, project=project, mode="rb")
        raw: bytes = file_obj.read()  # type: ignore[assignment]
        buf = io.BytesIO(raw)
        with gzip.open(buf, "rt", encoding="utf-8") as f:
            return json.load(f, object_pairs_hook=OrderedDict)
    except Exception as e:
        raise DXCohortError(
            f"Failed to read descriptor file '{file_id}': {e}",
            dx_error=e,
        ) from e


# ── SQL 生成 ────────────────────────────────────────────────────────────


def generate_cohort_sql(
    viz_info: dict[str, Any],
    filter_payload: dict[str, Any],
) -> str:
    """调用 vizserver 生成 cohort SQL。

    Args:
        viz_info: ``get_visualize_info()`` 的返回值。
        filter_payload: ``build_cohort_filter_payload()`` 的返回值。

    Returns:
        生成的 SQL 字符串（末尾带分号）。

    Raises:
        DXCohortError: vizserver 请求失败。
    """
    resource = (
        viz_info["url"] + "/viz-query/3.0/" + viz_info["dataset"] + "/raw-cohort-query"
    )
    try:
        resp = dxpy.DXHTTPRequest(
            resource=resource,
            data=filter_payload,
            prepend_srv=False,
        )
    except Exception as e:
        raise DXCohortError(
            f"Failed to generate cohort SQL: {e}",
            dx_error=e,
        ) from e

    return resp["sql"] + ";"


# ── Record 创建 ─────────────────────────────────────────────────────────


def build_cohort_record_payload(
    name: str,
    folder: str,
    project: str,
    viz_info: dict[str, Any],
    filters: dict[str, Any],
    sql: str,
    entity_fields: list[str],
    description: str = "",
) -> dict[str, Any]:
    """组装 DXRecord 创建 payload。

    Args:
        name: Cohort 名称。
        folder: 目标文件夹路径。
        project: 目标项目 ID。
        viz_info: ``get_visualize_info()`` 的返回值。
        filters: pheno_filters dict。
        sql: 生成的 SQL。
        description: 可选描述。
        entity_fields: 关联的字段列表（``"entity.field_name"`` 格式），
            用于 UKB RAP Web UI 的 Data Preview 展示。

    Returns:
        传给 ``create_cohort_record()`` 的完整 payload。
    """
    base_sql = viz_info.get("baseSql") or viz_info.get("base_sql")
    combined = viz_info.get("combined")

    details: dict[str, Any] = {
        "databases": viz_info["databases"],
        "dataset": {"$dnanexus_link": viz_info["dataset"]},
        "description": description,
        "filters": filters,
        "schema": viz_info["schema"],
        "sql": sql,
        "version": "3.0",
        "fields": entity_fields,
    }
    if base_sql:
        details["baseSql"] = base_sql
    if combined:
        details["combined"] = _cohort_combined_payload(combined)

    types = ["DatabaseQuery", "CohortBrowser"]
    if combined:
        types.append("CombinedDatabaseQuery")

    # links: dataset + all referenced databases
    links = [viz_info["dataset"]]
    for db in viz_info.get("databases", []):
        if isinstance(db, dict):
            # {"app_version": {"$dnanexus_link": "database-xxx"}} format
            for v in db.values():
                if isinstance(v, dict) and "$dnanexus_link" in v:
                    links.append(v["$dnanexus_link"])
        elif isinstance(db, str):
            links.append(db)

    return {
        "name": name,
        "folder": folder,
        "project": project,
        "types": types,
        "details": details,
        "links": links,
        "close": True,
    }


def _cohort_combined_payload(combined: dict[str, Any]) -> dict[str, Any]:
    """转换 combined source 为 $dnanexus_link 格式。"""
    result = dict(combined)
    result["source"] = [
        {"$dnanexus_link": {"id": s["id"], "project": s["project"]}}
        for s in combined["source"]
    ]
    return result


def create_cohort_record(payload: dict[str, Any]) -> str:
    """在 DNAnexus 平台上创建 cohort record。

    Args:
        payload: ``build_cohort_record_payload()`` 的返回值。

    Returns:
        新创建的 cohort record ID。

    Raises:
        DXCohortError: 创建失败。
    """
    try:
        links = payload.pop("links", None)
        input_params: dict[str, Any] = {
            "project": payload["project"],
            "name": payload["name"],
            "types": payload["types"],
            "details": payload["details"],
            "hidden": payload.get("hidden", False),
        }
        if payload.get("folder"):
            input_params["folder"] = payload["folder"]
        if payload.get("properties"):
            input_params["properties"] = payload["properties"]
        if payload.get("tags"):
            input_params["tags"] = payload["tags"]
        if payload.get("parents"):
            input_params["parents"] = payload["parents"]
        if links:
            input_params["links"] = links

        resp = dxpy.api.record_new(input_params)  # type: ignore
        return resp["id"]
    except Exception as e:
        raise DXCohortError(
            f"Failed to create cohort record: {e}",
            dx_error=e,
        ) from e
