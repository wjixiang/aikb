"""队列构建业务逻辑。"""

from __future__ import annotations

from dx_client import CohortFilters, DXCohortInfo, DXRecordInfo, IDXClient


class CohortService:
    """队列构建服务。"""

    def __init__(self, dx_client: IDXClient) -> None:
        self._dx = dx_client

    def filter(self, filters: dict, limit: int = 100, offset: int = 0) -> list[dict]:
        """按条件筛选参与者。"""
        raise NotImplementedError

    def list_cohorts(
        self,
        name_pattern: str | None = None,
        limit: int = 100,
        refresh: bool = False,
    ) -> list[DXRecordInfo]:
        """列出当前项目中的 cohort record。"""
        return self._dx.list_cohorts(
            name_pattern=name_pattern,
            limit=limit,
            refresh=refresh,
        )

    def get_cohort(self, cohort_id: str, refresh: bool = False) -> DXRecordInfo:
        """获取 cohort record 详情。"""
        return self._dx.get_cohort(cohort_id, refresh=refresh)

    def find_cohort(
        self,
        name_pattern: str | None = None,
        refresh: bool = False,
    ) -> DXRecordInfo:
        """按名称查找 cohort。"""
        return self._dx.find_cohort(name_pattern=name_pattern, refresh=refresh)

    def create_cohort(
        self,
        name: str,
        filters: CohortFilters,
        *,
        dataset_ref: str | None = None,
        folder: str = "/",
        description: str = "",
        entity_fields: list[str] | None = None,
    ) -> DXCohortInfo:
        """基于筛选条件创建 cohort。"""
        return self._dx.create_cohort(
            name,
            filters,
            dataset_ref=dataset_ref,
            folder=folder,
            description=description,
            entity_fields=entity_fields or [],
        )

    def delete_cohort(self, cohort_id: str) -> None:
        """删除 cohort record。"""
        self._dx.delete_cohort(cohort_id)

    def close_cohort(self, cohort_id: str) -> DXRecordInfo:
        """锁定 cohort record，使其变为只读状态。"""
        return self._dx.close_cohort(cohort_id)

    def extract_fields(
        self,
        cohort_id: str,
        entity_fields: list[str],
        refresh: bool = False,
        limit: int = 1000,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """提取 cohort 内参与者的指定字段数据（支持分页）。"""
        df = self._dx.preview_cohort_data(
            cohort_id,
            entity_fields,
            limit=limit + offset,
            refresh=refresh,
        )
        total = len(df)
        records = df.iloc[offset : offset + limit].to_dict(orient="records")
        return records, total

    def download(
        self, cohort_id: str, refresh: bool = False
    ) -> tuple[str, str, list[dict]]:
        """下载 cohort 全部关联字段的数据。

        Returns:
            (cohort_name, cohort_id, data) 元组，data 为完整数据行列表。
        """
        cohort = self._dx.get_cohort(cohort_id, refresh=refresh)
        df = self._dx.download_cohort(cohort_id, refresh=refresh)
        return cohort.name, cohort_id, df.to_dict(orient="records")
