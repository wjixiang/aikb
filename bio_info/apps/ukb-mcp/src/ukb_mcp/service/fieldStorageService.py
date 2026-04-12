from __future__ import annotations

import re

import duckdb
from fastapi import Depends
import sqlglot
from sqlglot import exp

from dx_client import IDXClient
from ukb_mcp.api.deps import get_dx_client
from ukb_mcp.config import get_settings


def get_field_storage(
    dx_client: IDXClient = Depends(get_dx_client),
) -> FieldStorageService:
    settings = get_settings()
    return FieldStorageService(settings.db_path, dx_client)


class FieldStorageService:
    def __init__(self, db_path: str, dx_client: IDXClient) -> None:
        self._con = duckdb.connect(db_path)
        self._dx = dx_client

    def sync_field_dict(self):
        df = self._dx.get_data_dictionary(refresh=False)
        self._con.register("tmp", df)
        self._con.execute("DROP TABLE IF EXISTS field_dict")
        self._con.execute("CREATE TABLE field_dict AS SELECT * FROM tmp")
        self._con.unregister("tmp")
        return True

    def count_fields(self) -> int:
        """返回字段字典总记录数。"""
        result = self._con.execute("SELECT COUNT(*) FROM field_dict").fetchone()
        return result[0] if result else 0

    def count_query_fields(self, condition: str) -> int:
        """返回满足条件的记录总数。"""
        parsed = _parse_condition(condition)
        query = (
            sqlglot.select(exp.Count(this=exp.Star()))
            .from_("field_dict")
            .where(parsed)
        )
        result = self._con.execute(query.sql(dialect="duckdb")).fetchone()
        return result[0] if result else 0

    def list_fields(self, page: int = 1, page_size: int = 100):
        offset = (page - 1) * page_size
        return self._con.execute(
            "SELECT * FROM field_dict LIMIT ? OFFSET ?",
            [page_size, offset],
        ).df()

    def query_fields(self, condition: str, page: int = 1, page_size: int = 100):
        offset = (page - 1) * page_size
        parsed = _parse_condition(condition)

        query = (
            sqlglot.select("*")
            .from_("field_dict")
            .where(parsed)
            .limit(page_size)
            .offset(offset)
        )

        return self._con.execute(query.sql(dialect="duckdb")).df()


def _parse_condition(condition: str):
    """解析查询条件：裸词自动转为 LIKE 查询，支持安全 SQL 表达式。"""
    condition = condition.strip()

    # 裸词：仅包含安全的字母数字下划线和非ASCII字符，整体作为 LIKE 关键词搜索
    if re.fullmatch(r"[\w\u0080-\U0010ffff]+", condition):
        # 转义 LIKE special chars，防止 pattern 注入
        escaped = (
            condition.replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_")
        )
        pattern = f"%{escaped}%"

        text_cols = [
            "entity", "name", "type", "title", "description",
            "coding_name", "concept", "folder_path", "units",
        ]

        # CAST 每个列为 VARCHAR，再做 LIKE（避免 DOUBLE 等类型不支持 LIKE 的问题）
        col_conditions = [
            sqlglot.and_(
                sqlglot.cast(sqlglot.column(col), "VARCHAR").is_(exp.Null()).not_(),
                sqlglot.cast(sqlglot.column(col), "VARCHAR").like(exp.Literal.string(pattern)),
            )
            for col in text_cols
        ]

        combined = col_conditions[0]
        for c in col_conditions[1:]:
            combined = sqlglot.or_(combined, c)
        return combined

    # 解析为完整 SQL 表达式
    parsed = sqlglot.parse_one(condition, dialect="duckdb")
    if not isinstance(parsed, exp.Boolean):
        raise ValueError(f"Condition must be a boolean expression, got: {type(parsed).__name__}")
    return parsed
