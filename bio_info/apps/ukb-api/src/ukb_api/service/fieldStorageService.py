from __future__ import annotations

import re

import duckdb
from fastapi import Depends

from dx_client import IDXClient
from ukb_api.api.deps import get_dx_client
from ukb_api.config import get_settings


def get_field_storage(
    dx_client: IDXClient = Depends(get_dx_client),
) -> FieldStorageService:
    settings = get_settings()
    return FieldStorageService(settings.db_path, dx_client)


def _is_bare_keyword(text: str) -> bool:
    """判断是否为裸关键词（非完整SQL谓词）。"""
    text = text.strip()
    if not text:
        return False
    # 含 SQL 关键字的不是裸词
    sql_keywords = re.compile(
        r"\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|WHERE|AND|OR|"
        r"LIKE|IN|BETWEEN|IS|NULL|TRUE|FALSE|COUNT|FROM|JOIN|ON|GROUP|"
        r"ORDER|BY|HAVING|LIMIT|OFFSET|AS|CAST|NOT|INTO|VALUES)\b",
        re.IGNORECASE,
    )
    return not bool(sql_keywords.search(text))


def _build_keyword_condition(text: str) -> str:
    """将裸关键词转为 SQL WHERE 条件（所有文本列 OR LIKE）。"""
    escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    pattern = f"'%{escaped}%'"
    cols = [
        "entity",
        "name",
        "type",
        "title",
        "description",
        "coding_name",
        "concept",
        "folder_path",
        "units",
    ]
    conditions = " OR ".join(f"(CAST({col} AS VARCHAR) LIKE {pattern})" for col in cols)
    return f"({conditions})"


class FieldStorageService:
    def __init__(self, db_path: str, dx_client: IDXClient) -> None:
        self._con = duckdb.connect(db_path)
        self._dx = dx_client

    def sync_field_dict(self):
        df = self._dx.get_data_dictionary(refresh=False)
        self._con.register("tmp", df)
        self._con.execute("DROP TABLE IF EXISTS field_dict")
        self._con.execute(
            """
            CREATE TABLE field_dict AS
            SELECT
                CAST(entity AS VARCHAR) AS entity,
                CAST(name AS VARCHAR) AS name,
                CAST(type AS VARCHAR) AS type,
                CAST(title AS VARCHAR) AS title,
                CAST(description AS VARCHAR) AS description,
                CAST(coding_name AS VARCHAR) AS coding_name,
                CAST(concept AS VARCHAR) AS concept,
                CAST(folder_path AS VARCHAR) AS folder_path,
                CAST(is_multi_select AS VARCHAR) AS is_multi_select,
                CAST(is_sparse_coding AS VARCHAR) AS is_sparse_coding,
                CAST(linkout AS VARCHAR) AS linkout,
                CAST(longitudinal_axis_type AS VARCHAR) AS longitudinal_axis_type,
                CAST(referenced_entity_field AS VARCHAR) AS referenced_entity_field,
                CAST(relationship AS VARCHAR) AS relationship,
                CAST(units AS VARCHAR) AS units,
                CAST(primary_key_type AS VARCHAR) AS primary_key_type
            FROM tmp
        """
        )
        self._con.unregister("tmp")
        return True

    def count_fields(self) -> int:
        """返回字段字典总记录数。"""
        result = self._con.execute("SELECT COUNT(*) FROM field_dict").fetchone()
        return result[0] if result else 0

    def count_query_fields(self, condition: str) -> int:
        """返回满足条件的记录总数。"""
        if _is_bare_keyword(condition):
            condition = _build_keyword_condition(condition)
        result = self._con.execute(
            f"SELECT COUNT(*) FROM field_dict WHERE {condition}"
        ).fetchone()
        return result[0] if result else 0

    def list_fields(self, page: int = 1, page_size: int = 100):
        offset = (page - 1) * page_size
        return self._con.execute(
            "SELECT * FROM field_dict LIMIT ? OFFSET ?",
            [page_size, offset],
        ).df()

    def query_fields(self, condition: str, page: int = 1, page_size: int = 100):
        if _is_bare_keyword(condition):
            condition = _build_keyword_condition(condition)
        offset = (page - 1) * page_size
        return self._con.execute(
            f"SELECT * FROM field_dict WHERE {condition} LIMIT {page_size} OFFSET {offset}"
        ).df()
