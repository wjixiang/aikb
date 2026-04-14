"""数据库业务逻辑。"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import pandas as pd
from dx_client import IDXClient

if TYPE_CHECKING:
    from ukb_api.service.fieldStorageService import FieldStorageService

logger = logging.getLogger(__name__)


class DatabaseService:
    """DNAnexus database 操作服务。"""

    def __init__(
        self,
        dx_client: IDXClient,
        field_storage: FieldStorageService | None = None,
    ) -> None:
        self._dx = dx_client
        self._field_storage = field_storage

    def list_databases(
        self,
        name_pattern: str | None = None,
        *,
        refresh: bool = False,
    ) -> list[dict]:
        dbs = self._dx.list_databases(name_pattern=name_pattern, refresh=refresh)
        return [
            {
                "id": db.id,
                "name": db.name,
                "state": db.state,
                "project": db.project,
                "created": db.created,
                "modified": db.modified,
            }
            for db in dbs
        ]

    def get_database(self, database_id: str, *, refresh: bool = False) -> dict:
        db = self._dx.get_database(database_id, refresh=refresh)
        return {
            "id": db.id,
            "name": db.name,
            "state": db.state,
            "project": db.project,
            "created": db.created,
            "modified": db.modified,
        }

    def find_database(
        self,
        name_pattern: str | None = None,
        *,
        refresh: bool = False,
    ) -> dict:
        db = self._dx.find_database(name_pattern=name_pattern, refresh=refresh)
        return {
            "id": db.id,
            "name": db.name,
            "state": db.state,
            "project": db.project,
        }

    def describe_database(self, database_id: str, *, refresh: bool = False) -> dict:
        return self._dx.describe_database_cluster(
            database_id, refresh=refresh
        ).model_dump()

    def list_tables(self, database_id: str, *, refresh: bool = False) -> list[dict]:
        tables = self._dx.get_database_schema(database_id, refresh=refresh)
        return [{"name": t.name} for t in tables]

    def list_fields(
        self,
        database_id: str,
        entity: str | None = None,
        name_pattern: str | None = None,
        *,
        refresh: bool = False,
    ) -> list[dict]:
        if self._field_storage is not None and not refresh:
            rows = self._field_storage.list_fields_filtered(
                entity=entity,
                name_pattern=name_pattern,
            )
            return [
                {"entity": r[0], "name": r[1], "type": r[2], "title": r[3]}
                for r in rows
            ]
        df = self._dx.list_fields(
            entity=entity,
            name_pattern=name_pattern,
            refresh=refresh,
        )
        return df.to_dict(orient="records")

    def list_entities(self, *, refresh: bool = False) -> list[dict]:
        if self._field_storage is not None and not refresh:
            rows = self._field_storage.list_fields_filtered()
            entity_counts: dict[str, int] = {}
            for r in rows:
                entity_counts[r[0]] = entity_counts.get(r[0], 0) + 1
            return [{"name": k, "field_count": v} for k, v in entity_counts.items()]
        df = self._dx.list_fields(refresh=refresh)
        if df.empty:
            return []
        entity_counts = df.groupby("entity").size().reset_index(name="field_count")
        return entity_counts.to_dict(orient="records")

    def query(
        self,
        database_id: str,
        entity_fields: list[str],
        dataset_ref: str | None = None,
        *,
        refresh: bool = False,
    ) -> pd.DataFrame:
        return self._dx.query_database(
            database_id,
            entity_fields,
            dataset_ref,
            refresh=refresh,
        )
