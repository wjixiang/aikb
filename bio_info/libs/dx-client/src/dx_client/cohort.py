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
from typing import Any

import dxpy
from .dx_exceptions import DXCohortError

logger = logging.getLogger(__name__)

# ── Operator → vizserver condition 映射 ──────────────────────────────────

_OP_TO_CONDITION: dict[str, str] = {
    "is_not_null": "exists",
    "is_null": "not-exists",
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
    "any": "any",
    "not_any": "not-any",
    "all": "all",
    "not_empty": "not-empty",
}


def _rule_to_vizserver_filter(rule: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    """将单条 rule 转为 vizserver filters dict。

    ``{"field": "participant.p131286", "operator": "is_not_null"}``
    → ``{"participant$p131286": [{"condition": "exists", "values": []}]}``

    兼容 ``operator`` / ``type`` 两种键名。
    """
    field = rule["field"].replace(".", "$")
    operator = rule.get("operator") or rule.get("type") or "is"
    condition = _OP_TO_CONDITION.get(operator, operator)
    values = rule.get("value") or rule.get("values") or []

    return {field: [{"condition": condition, "values": values}]}


def _is_rules_format(filters: dict[str, Any]) -> bool:
    """检测是否为 rules-based 格式（含 ``rules`` 列表）。

    兼容 ``logical`` / ``logic`` 两种键名。
    """
    return "rules" in filters and isinstance(filters["rules"], list)


def _build_vizserver_pheno_filters(
    logic: str,
    merged_filters: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:
    """将 logic + 合并后的 filters 包装为完整 vizserver 格式。"""
    return {
        "logic": logic,
        "pheno_filters": {
            "logic": logic,
            "compound": [
                {
                    "name": "phenotype",
                    "logic": logic,
                    "filters": merged_filters,
                }
            ],
        },
    }


def _merge_rules(rules: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """将 rules 列表合并为 vizserver filters dict。"""
    merged: dict[str, list[dict[str, Any]]] = {}
    for rule in rules:
        if "rules" in rule:
            # 嵌套 group：递归合并
            nested = normalize_cohort_filters(rule)
            for item in nested.get("pheno_filters", {}).get("compound", []):
                for fk, fv in item.get("filters", {}).items():
                    merged.setdefault(fk, []).extend(fv)
        else:
            for k, v in _rule_to_vizserver_filter(rule).items():
                merged.setdefault(k, []).extend(v)
    return merged


def normalize_cohort_filters(filters: dict[str, Any]) -> dict[str, Any]:
    """将常见筛选条件格式规范化为 vizserver pheno_filters 格式。

    如果输入已经是合法的 vizserver 格式（包含 ``logic`` + ``pheno_filters``），
    直接原样返回。否则尝试将 ``logical``/``rules`` / ``logic``/``rules`` 等常见格式转换。

    Args:
        filters: 原始筛选条件 dict。

    Returns:
        符合 vizserver 要求的 pheno_filters dict。
    """
    # 已经是 vizserver 格式
    if "pheno_filters" in filters:
        return filters

    # rules 格式（LLM 常见输出，兼容 logical / logic 两种键名）
    if _is_rules_format(filters):
        logic = (filters.get("logical") or filters.get("logic") or "and").lower()
        merged = _merge_rules(filters["rules"])
        return _build_vizserver_pheno_filters(logic, merged)

    # 单条 rule dict（无 logical/rules 包装）
    if "field" in filters:
        field_filters = _rule_to_vizserver_filter(filters)
        return {
            "logic": "and",
            "pheno_filters": {
                "logic": "and",
                "compound": [
                    {
                        "name": "phenotype",
                        "logic": "and",
                        "filters": field_filters,
                    }
                ],
            },
        }

    # 无法识别的格式，原样返回（让 vizserver 报错）
    logger.warning("Unknown filter format, passing through as-is: %s", filters)
    return filters


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
    description: str = "",
    entity_fields: list[str] | None = None,
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
        entity_fields: 关联的字段列表（``"entity.field_name"`` 格式）。

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
    }
    if entity_fields:
        details["fields"] = entity_fields
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
