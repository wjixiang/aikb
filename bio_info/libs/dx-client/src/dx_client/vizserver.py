"""DNAnexus vizserver REST API 客户端。

封装所有与 vizserver 交互的 HTTP 调用，通过依赖注入便于测试。

Usage::

    from dx_client import DXClient, VizRawDataPayload, VizFieldMapping

    client = DXClient(config)
    client.connect()

    # 1. 获取 vizserver 连接信息
    viz_info = client.vizserver.get_visualize_info(dataset_id, project_id)
    print(f"Vizserver: {viz_info.url}, Dataset: {viz_info.dataset}")

    # 2. 查询数据（使用 Pydantic payload 模型）
    payload = VizRawDataPayload(
        project_context=project_id,
        fields=[VizFieldMapping(eid="participant$eid")],
        limit=100,
    )
    results = client.vizserver.query_raw_data(viz_info, payload)
    # results: list[dict[str, Any]] — 每行 dict 的 key = 字段别名

    # 3. 生成 SQL（不执行，仅返回 SQL 字符串）
    from dx_client import VizQueryPayload
    sql_payload = VizQueryPayload(
        project_context=project_id,
        fields=[VizFieldMapping(eid="participant$eid")],
        return_query=True,
    )
    sql = client.vizserver.generate_sql(viz_info, sql_payload)
"""

from __future__ import annotations

import logging
from typing import Protocol, runtime_checkable

import pandas as pd

import dxpy
from dxpy.exceptions import DXAPIError as DxPyDXAPIError
from dxpy.exceptions import DXError as DxPyDXError

from .dx_exceptions import (
    DXCohortError,
    check_vizserver_response,
    translate_dx_error,
)
from .dx_models import (
    VizCohortQueryPayload,
    VizFieldMapping,
    VizInfo,
    VizQueryPayload,
    VizRawDataPayload,
)

logger = logging.getLogger(__name__)


@runtime_checkable
class IVizserverClient(Protocol):
    """DNAnexus vizserver REST API 交互协议。

    实现类封装 vizserver 资源 URL 的构建和 ``dxpy.DXHTTPRequest`` 的调用，
    使所有 vizserver 调用可注入和可 mock。
    """

    def get_visualize_info(
        self,
        record_id: str,
        project: str,
    ) -> VizInfo:
        """调用 ``/{record_id}/visualize`` 获取 vizserver 连接信息。

        校验 datasetVersion == "3.0" 和 recordTypes 后返回。

        Args:
            record_id: Dataset 或 CohortBrowser 的 record ID。
            project: 所属项目 ID。

        Returns:
            VizInfo 实例，包含 url、dataset、databases、schema 等。

        Raises:
            DXCohortError: record 无效、版本不支持或权限不足。
        """
        ...

    def query_raw_data(
        self,
        viz_info: VizInfo,
        payload: VizRawDataPayload,
    ) -> pd.DataFrame:
        """调用 ``{url}/data/3.0/{dataset}/raw`` 查询数据。

        统一的字段提取端点，用于字段提取、ID 校验和 cohort 字段提取。
        请求体使用 :class:`VizRawDataPayload` Pydantic 模型构建，
        返回 DataFrame，列名为请求时的字段别名。

        Args:
            viz_info: :meth:`get_visualize_info` 的返回值。
            payload: 查询条件，包含 project_context、fields 及可选的
                filters、base_sql、limit 等，详见 :class:`VizRawDataPayload`。

        Returns:
            查询结果 DataFrame，列 = 字段别名，行 = 查询结果。
            若 vizserver 返回 SQL 而非数据（payload 中 return_query=True），
            则返回空 DataFrame。

        Raises:
            DXCohortError: vizserver 请求失败或返回错误响应。
        """
        ...

    def generate_cohort_sql(
        self,
        viz_info: VizInfo,
        payload: VizCohortQueryPayload,
    ) -> str:
        """调用 ``{url}/viz-query/3.0/{dataset}/raw-cohort-query`` 生成 cohort SQL。

        该端点专门用于基于 cohort 筛选条件（pheno_filters）生成 SQL。
        与 :meth:`generate_sql` 的区别是：接受 cohort 专属的 pheno_filters 结构。

        Args:
            viz_info: :meth:`get_visualize_info` 的返回值。
            payload: Cohort 查询条件，详见 :class:`VizCohortQueryPayload`。

        Returns:
            生成的 SQL 字符串（末尾带分号 ``;``）。

        Raises:
            DXVizserverError: vizserver 返回错误响应。
            DXCohortError: vizserver 请求失败。
        """
        ...

    def generate_sql(
        self,
        viz_info: VizInfo,
        payload: VizQueryPayload,
    ) -> str:
        """调用 ``{url}/viz-query/3.0/{dataset}/raw-query`` 生成通用 SQL。

        与 :meth:`generate_cohort_sql` 不同，此端点接受任意 filters/raw_filters 组合，
        不限于 cohort 的 pheno_filters 结构。

        Args:
            viz_info: :meth:`get_visualize_info` 的返回值。
            payload: 查询条件，详见 :class:`VizQueryPayload`。
                注意：:attr:`VizQueryPayload.return_query` 固定为 ``True``。

        Returns:
            生成的 SQL 字符串。

        Raises:
            DXVizserverError: vizserver 返回错误响应。
            DXCohortError: vizserver 请求失败。
        """
        ...

    def preview_cohort(
        self,
        cohort_id: str,
        project: str,
        entity_fields: list[str],
        *,
        limit: int = 100,
    ) -> pd.DataFrame:
        """预览 cohort 数据（直接查询，不创建 cohort record）。

        内部调用 ``/{cohort_id}/visualize`` 获取 viz_info，
        再调用 ``/data/3.0/{dataset}/raw`` 查询数据。

        注意：字段格式为 ``entity$field``（如 ``participant$eid``），
        而非 dataset 的 ``entity.field`` 格式。

        Args:
            cohort_id: Cohort record ID (record-xxxx)。
            project: 项目 ID。
            entity_fields: 要查询的字段列表（如 ``["participant$eid", "participant$sex"]``）。
            limit: 最大返回行数，默认 100。

        Returns:
            查询结果 DataFrame，列 = 字段名。

        Raises:
            DXCohortError: vizserver 请求失败或返回错误响应。
        """
        ...


class VizserverClient:
    """``IVizserverClient`` 的默认实现，使用 ``dxpy`` SDK。

    整个代码库中唯一构建 vizserver 资源 URL 并调用
    ``dxpy.DXHTTPRequest(prepend_srv=False)`` 的地方。
    """

    def get_visualize_info(
        self,
        record_id: str,
        project: str,
    ) -> VizInfo:
        """调用 ``/{record_id}/visualize`` 获取 vizserver 连接信息。"""
        try:
            resp = dxpy.DXHTTPRequest(
                "/%s/visualize" % record_id,
                {"project": project, "cohortBrowser": False},
            )
        except Exception as e:
            raise DXCohortError(
                f"Failed to get visualize info for '{record_id}': {e}",
                dx_error=e,
            ) from e

        check_vizserver_response(
            resp,
            f"Failed to get visualize info for '{record_id}'",
        )

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

        return VizInfo.model_validate(resp)

    def query_raw_data(
        self,
        viz_info: VizInfo,
        payload: VizRawDataPayload,
    ) -> pd.DataFrame:
        """调用 ``{url}/data/3.0/{dataset}/raw`` 查询数据。

        统一的字段提取端点，用于字段提取、ID 校验和 cohort 字段提取。
        请求体使用 :class:`VizRawDataPayload` Pydantic 模型构建，
        返回 DataFrame，列名为请求时的字段别名。

        Args:
            viz_info: :meth:`get_visualize_info` 的返回值。
            payload: 查询条件，使用 :class:`VizRawDataPayload` 构建。
                常用字段：

                - ``project_context``: 项目 ID（必填）
                - ``fields``: 字段映射列表，如 ``[VizFieldMapping(eid="participant$eid")]``
                - ``limit``: 最大返回行数
                - ``filters``: pheno_filters 结构（cohort 过滤）
                - ``base_sql``: Dataset base SQL

        Returns:
            查询结果 DataFrame，列 = 字段别名，行 = 查询结果。
            若 vizserver 返回 SQL 而非数据（payload 中 return_query=True），
            则返回空 DataFrame。

        Raises:
            DXCohortError: vizserver 请求失败或返回错误响应。
        """
        resource = viz_info.url + "/data/3.0/" + viz_info.dataset + "/raw"
        try:
            resp = dxpy.DXHTTPRequest(
                resource=resource,
                data=payload.model_dump(exclude_none=True),
                prepend_srv=False,
            )
        except (DxPyDXError, DxPyDXAPIError) as e:
            translate_dx_error(
                e,
                f"vizserver data query failed for dataset '{viz_info.dataset}'",
            )
            raise  # unreachable after translate_dx_error

        check_vizserver_response(
            resp,
            f"vizserver data query failed for dataset '{viz_info.dataset}'",
        )

        if "sql" in resp and "results" not in resp:
            logger.warning(
                "query_raw_data received a SQL response (return_query=True in payload?). "
                "Use generate_sql() for SQL generation. Returning empty DataFrame."
            )

        return pd.DataFrame(resp.get("results", []))

    def generate_cohort_sql(
        self,
        viz_info: VizInfo,
        payload: VizCohortQueryPayload,
    ) -> str:
        """调用 ``{url}/viz-query/3.0/{dataset}/raw-cohort-query`` 生成 cohort SQL。

        该端点专门用于基于 cohort 筛选条件（pheno_filters）生成 SQL。

        Args:
            viz_info: :meth:`get_visualize_info` 的返回值。
            payload: Cohort 查询条件，使用 :class:`VizCohortQueryPayload` 构建。
                常用字段：

                - ``project_context``: 项目 ID（必填）
                - ``filters``: pheno_filters 结构（cohort 过滤）
                - ``base_sql``: Cohort base SQL（可选）
                - ``fields``: 要查询的字段列表

        Returns:
            生成的 SQL 字符串（末尾带分号 ``;``）。

        Raises:
            DXVizserverError: vizserver 返回错误响应。
            DXCohortError: vizserver 请求失败。
        """
        resource = (
            viz_info.url + "/viz-query/3.0/" + viz_info.dataset + "/raw-cohort-query"
        )
        try:
            resp = dxpy.DXHTTPRequest(
                resource=resource,
                data=payload.model_dump(exclude_none=True),
                prepend_srv=False,
            )
        except (DxPyDXError, DxPyDXAPIError) as e:
            translate_dx_error(
                e,
                f"vizserver cohort SQL generation failed for dataset '{viz_info.dataset}'",
            )
            raise  # unreachable after translate_dx_error

        check_vizserver_response(
            resp,
            f"vizserver cohort SQL generation failed for dataset '{viz_info.dataset}'",
        )

        return resp["sql"] + ";"

    def generate_sql(
        self,
        viz_info: VizInfo,
        payload: VizQueryPayload,
    ) -> str:
        """调用 ``{url}/viz-query/3.0/{dataset}/raw-query`` 生成通用 SQL。

        与 :meth:`generate_cohort_sql` 不同，此端点接受任意 filters/raw_filters 组合，
        不限于 cohort 的 pheno_filters 结构。

        Args:
            viz_info: :meth:`get_visualize_info` 的返回值。
            payload: 查询条件，使用 :class:`VizQueryPayload` 构建。
                常用字段：

                - ``project_context``: 项目 ID（必填）
                - ``fields``: 字段映射列表
                - ``filters``: pheno_filters 结构
                - ``raw_filters``: assay_filters 结构（变异/表达）
                - ``base_sql``: Dataset base SQL
                - ``return_query``: 固定为 ``True``（生成 SQL 而非执行）

        Returns:
            生成的 SQL 字符串。

        Raises:
            DXVizserverError: vizserver 返回错误响应。
            DXCohortError: vizserver 请求失败。
        """
        resource = viz_info.url + "/viz-query/3.0/" + viz_info.dataset + "/raw-query"
        try:
            resp = dxpy.DXHTTPRequest(
                resource=resource,
                data=payload.model_dump(exclude_none=True),
                prepend_srv=False,
            )
        except (DxPyDXError, DxPyDXAPIError) as e:
            translate_dx_error(
                e,
                f"vizserver SQL generation failed for dataset '{viz_info.dataset}'",
            )
            raise  # unreachable after translate_dx_error

        check_vizserver_response(
            resp,
            f"vizserver raw-query failed for dataset '{viz_info.dataset}'",
        )

        return resp["sql"]

    def preview_cohort(
        self,
        cohort_id: str,
        project: str,
        entity_fields: list[str],
        *,
        limit: int = 100,
    ) -> pd.DataFrame:
        """预览 cohort 数据（直接查询，不创建 cohort record）。

        内部调用 ``/{cohort_id}/visualize`` 获取 viz_info，
        再调用 ``/data/3.0/{dataset}/raw`` 查询数据。

        注意：字段格式为 ``entity$field``（如 ``participant$eid``），
        而非 dataset 的 ``entity.field`` 格式。

        Args:
            cohort_id: Cohort record ID (record-xxxx)。
            project: 项目 ID。
            entity_fields: 要查询的字段列表（如 ``["participant$eid", "participant$sex"]``）。
            limit: 最大返回行数，默认 100。

        Returns:
            查询结果 DataFrame，列 = 字段名。

        Raises:
            DXCohortError: vizserver 请求失败或返回错误响应。
        """
        if not entity_fields:
            return pd.DataFrame()

        viz_info = self.get_visualize_info(cohort_id, project)

        # Build field mappings: raw entity$field strings -> VizFieldMapping
        field_mappings = [
            VizFieldMapping(**{f.split("$")[-1]: f}) for f in entity_fields
        ]

        payload = VizRawDataPayload(
            project_context=project,
            fields=field_mappings,
            limit=limit,
        )  # type: ignore[call-arg]
        if viz_info.base_sql:
            payload.base_sql = viz_info.base_sql
        if viz_info.filters:
            # 直接赋值（类型为 dict 而非 VizPhenoFilters），
            # 序列化结果与 CohortService.preview_cohort_data 行为一致。
            payload.filters = viz_info.filters  # type: ignore[assignment]

        return self.query_raw_data(viz_info, payload)
