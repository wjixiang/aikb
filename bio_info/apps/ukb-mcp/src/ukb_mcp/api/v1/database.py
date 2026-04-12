"""数据库 REST 端点。"""

from __future__ import annotations

import io

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from ukb_mcp.api.deps import get_dx_client
from ukb_mcp.domain.database.models import (
    DatabaseFieldInfo,
    DatabaseInfo,
    DatabaseQueryRequest,
    DatabaseQueryResponse,
    DatabaseTableInfo,
    PaginatedFieldsResponse,
    PaginatedTablesResponse,
)
from ukb_mcp.domain.database.service import DatabaseService
from dx_client import IDXClient

router = APIRouter(prefix="/databases", tags=["databases"])


def get_database_service(dx_client: IDXClient = Depends(get_dx_client)) -> DatabaseService:
    return DatabaseService(dx_client)


# ── 数据库 CRUD ──────────────────────────────────────────────────────────


@router.get("", response_model=list[DatabaseInfo])
def list_databases(
    name: str | None = Query(default=None, description="按名称模糊匹配。"),
    refresh: bool = Query(default=False, description="强制刷新缓存。"),
    service: DatabaseService = Depends(get_database_service),
) -> list[DatabaseInfo]:
    """列出当前项目中的 DNAnexus database 对象。"""
    return service.list_databases(name_pattern=name, refresh=refresh)  # type: ignore[return-value]


@router.get("/find", response_model=DatabaseInfo)
def find_database(
    name: str | None = Query(default=None, description="按名称模糊匹配。"),
    refresh: bool = Query(default=False, description="强制刷新缓存。"),
    service: DatabaseService = Depends(get_database_service),
) -> DatabaseInfo:
    """查找并返回第一个匹配的 database。"""
    return service.find_database(name_pattern=name, refresh=refresh)  # type: ignore[return-value]


@router.get("/{database_id}", response_model=DatabaseInfo)
def get_database(
    database_id: str,
    refresh: bool = Query(default=False, description="强制刷新缓存。"),
    service: DatabaseService = Depends(get_database_service),
) -> DatabaseInfo:
    """获取 database 详情。"""
    return service.get_database(database_id, refresh=refresh)  # type: ignore[return-value]


@router.get("/{database_id}/describe")
def describe_database(
    database_id: str,
    refresh: bool = Query(default=False, description="强制刷新缓存。"),
    service: DatabaseService = Depends(get_database_service),
) -> dict:
    """获取数据库集群完整描述（原始 API 响应）。"""
    return service.describe_database(database_id, refresh=refresh)


# ── 数据表与字段 ─────────────────────────────────────────────────────────


@router.get("/{database_id}/tables", response_model=PaginatedTablesResponse)
def list_tables(
    database_id: str,
    limit: int = Query(default=100, ge=1, le=100, description="每页条数。"),
    offset: int = Query(default=0, ge=0, description="偏移量。"),
    refresh: bool = Query(default=False, description="强制刷新缓存。"),
    service: DatabaseService = Depends(get_database_service),
) -> PaginatedTablesResponse:
    """列出数据库中的数据表（目录结构）。"""
    tables, total = service.list_tables(database_id, limit=limit, offset=offset, refresh=refresh)
    return PaginatedTablesResponse(
        data=[DatabaseTableInfo(name=t["name"]) for t in tables],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{database_id}/fields", response_model=PaginatedFieldsResponse)
def list_fields(
    database_id: str,
    entity: str | None = Query(default=None, description="按实体过滤。"),
    name: str | None = Query(default=None, description="按字段名模糊匹配。"),
    limit: int = Query(default=100, ge=1, le=100, description="每页条数。"),
    offset: int = Query(default=0, ge=0, description="偏移量。"),
    refresh: bool = Query(default=False, description="强制刷新缓存。"),
    service: DatabaseService = Depends(get_database_service),
) -> PaginatedFieldsResponse:
    """列出数据集中的可用字段（精简视图）。

    返回 entity / name / type / title 四列，支持按实体和字段名过滤。
    """
    fields, total = service.list_fields(
        database_id, entity=entity, name_pattern=name, limit=limit, offset=offset, refresh=refresh,
    )
    return PaginatedFieldsResponse(
        data=[DatabaseFieldInfo(**f) for f in fields],
        total=total,
        limit=limit,
        offset=offset,
    )


# ── 查询与导出 ──────────────────────────────────────────────────────────


@router.post("/{database_id}/query", response_model=DatabaseQueryResponse)
def query_database(
    database_id: str,
    body: DatabaseQueryRequest = ...,
    service: DatabaseService = Depends(get_database_service),
) -> DatabaseQueryResponse:
    """从数据库关联的数据集中提取指定字段。

    返回行字典列表，第一列为 eid，其余列为请求的字段。
    """
    records, total = service.query(
        database_id,
        body.entity_fields,
        body.dataset_ref,
        limit=body.limit,
        offset=body.offset,
        refresh=body.refresh,
    )
    return DatabaseQueryResponse(
        data=records,
        total=total,
        limit=body.limit,
        offset=body.offset,
    )


@router.post("/{database_id}/export")
def export_database_csv(
    database_id: str,
    body: DatabaseQueryRequest,
    service: DatabaseService = Depends(get_database_service),
) -> StreamingResponse:
    """提取字段并流式返回 CSV 文件。"""
    records, _ = service.query(
        database_id,
        body.entity_fields,
        body.dataset_ref,
        limit=body.limit,
        offset=body.offset,
        refresh=body.refresh,
    )
    import pandas as pd
    buf = io.StringIO()
    pd.DataFrame(records).to_csv(buf, index=False)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=export.csv"},
    )
