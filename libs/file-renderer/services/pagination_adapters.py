"""
Pagination Adapters - 分页适配器

为不同数据源提供统一的分页接口：
- SQLAlchemy/数据库查询分页
- 列表/内存数据分页
- S3对象列表分页
"""

from typing import Any, Callable, Generic, TypeVar

from models.pagination import (
    CursorInfo,
    KeysetInfo,
    OffsetPaginationRequest,
    PageInfo,
    PaginatedResponse,
    PaginationParams,
    PaginationStrategy,
    SortOrder,
)
from services.pagination_service import (
    PaginationService,
    decode_cursor,
    encode_cursor,
)

T = TypeVar("T")


class ListPaginationAdapter(Generic[T]):
    """列表分页适配器"""

    def __init__(self, items: list[T]):
        self.items = items
        self.service = PaginationService()

    def paginate(
        self,
        params: PaginationParams,
        sort_key: Callable[[T], Any] | None = None,
    ) -> PaginatedResponse[T]:
        """
        对列表进行分页

        Args:
            params: 分页参数
            sort_key: 排序键函数

        Returns:
            PaginatedResponse: 分页响应
        """
        return self.service.paginate_list(self.items, params, sort_key)

    def paginate_with_offset(
        self,
        page: int = 1,
        page_size: int = 20,
        sort_key: Callable[[T], Any] | None = None,
    ) -> PaginatedResponse[T]:
        """使用偏移分页"""
        params = OffsetPaginationRequest(
            page=page,
            page_size=page_size,
        ).to_params()
        return self.paginate(params, sort_key)


class SQLAlchemyPaginationAdapter:
    """SQLAlchemy分页适配器"""

    def __init__(self, session):
        self.session = session
        self.service = PaginationService()

    async def paginate(
        self,
        query,
        params: PaginationParams,
        count_query=None,
    ) -> PaginatedResponse[Any]:
        """
        SQLAlchemy查询分页

        Args:
            query: SQLAlchemy查询对象
            params: 分页参数
            count_query: 可选的计数查询

        Returns:
            PaginatedResponse: 分页响应
        """
        return await self.service.paginate_sqlalchemy(query, params, count_query)

    async def paginate_with_offset(
        self,
        query,
        page: int = 1,
        page_size: int = 20,
        count_query=None,
    ) -> PaginatedResponse[Any]:
        """使用偏移分页"""
        params = OffsetPaginationRequest(
            page=page,
            page_size=page_size,
        ).to_params()
        return await self.paginate(query, params, count_query)

    @staticmethod
    def apply_sorting(query, sort_by: str | None, sort_order: SortOrder):
        """
        应用排序到查询

        Args:
            query: SQLAlchemy查询
            sort_by: 排序字段
            sort_order: 排序方向

        Returns:
            排序后的查询
        """
        if not sort_by:
            return query

        from sqlalchemy import desc, text

        sort_column = text(sort_by)
        if sort_order == SortOrder.DESC:
            sort_column = desc(sort_column)

        return query.order_by(sort_column)

    @staticmethod
    def apply_keyset_filter(
        query,
        keyset: dict[str, Any],
        direction: str = "next",
    ):
        """
        应用键集过滤

        Args:
            query: SQLAlchemy查询
            keyset: 键集值
            direction: 翻页方向

        Returns:
            过滤后的查询
        """
        if not keyset:
            return query

        from sqlalchemy import and_, text

        conditions = []
        for key, value in keyset.items():
            if direction == "next":
                conditions.append(text(f"{key} > {value}"))
            else:
                conditions.append(text(f"{key} < {value}"))

        if conditions:
            query = query.where(and_(*conditions))

        return query


class S3PaginationAdapter:
    """S3分页适配器"""

    def __init__(self, storage_service):
        self.storage_service = storage_service
        self.service = PaginationService()

    def paginate(
        self,
        prefix: str = "",
        max_keys: int = 1000,
        continuation_token: str | None = None,
        start_after: str | None = None,
    ) -> PaginatedResponse[dict]:
        """
        S3对象列表分页

        Args:
            prefix: 前缀
            max_keys: 最大数量
            continuation_token: 继续令牌
            start_after: 从此key之后开始

        Returns:
            PaginatedResponse: 分页响应
        """
        return self.service.paginate_s3_objects(
            storage_service=self.storage_service,
            prefix=prefix,
            max_keys=max_keys,
            continuation_token=continuation_token,
            start_after=start_after,
        )

    def list_with_metadata(
        self,
        prefix: str = "",
        max_keys: int = 1000,
    ) -> list[dict]:
        """
        列出文件并获取元数据

        Args:
            prefix: 前缀
            max_keys: 最大数量

        Returns:
            文件信息列表
        """
        keys = self.storage_service.list_objects(prefix)
        files = []

        for key in keys[:max_keys]:
            try:
                size = self.storage_service.get_file_size(key)
                modified = self.storage_service.get_modified_time(key)
                files.append({
                    "key": key,
                    "size": size,
                    "last_modified": modified,
                })
            except Exception:
                files.append({
                    "key": key,
                    "size": None,
                    "last_modified": None,
                })

        return files

    def paginate_with_offset(
        self,
        prefix: str = "",
        page: int = 1,
        page_size: int = 50,
    ) -> PaginatedResponse[dict]:
        """
        使用偏移分页列出S3文件

        Args:
            prefix: 前缀
            page: 页码
            page_size: 每页大小

        Returns:
            PaginatedResponse: 分页响应
        """
        # 获取所有文件
        all_files = self.list_with_metadata(prefix, max_keys=10000)

        # 应用偏移分页
        params = OffsetPaginationRequest(
            page=page,
            page_size=page_size,
        ).to_params()

        return self.service.paginate_list(all_files, params)


class AsyncGeneratorPaginationAdapter(Generic[T]):
    """异步生成器分页适配器"""

    def __init__(self, generator: Callable[..., Any]):
        self.generator = generator

    async def paginate(
        self,
        params: PaginationParams,
        *args,
        **kwargs,
    ) -> PaginatedResponse[T]:
        """
        对异步生成器进行分页

        Args:
            params: 分页参数
            *args: 生成器参数
            **kwargs: 生成器关键字参数

        Returns:
            PaginatedResponse: 分页响应
        """
        # 收集数据
        items = []
        async for item in self.generator(*args, **kwargs):
            items.append(item)

        # 使用列表分页
        service = PaginationService()
        return service.paginate_list(items, params)


class CursorPaginationHelper:
    """游标分页辅助类"""

    @staticmethod
    def create_cursor(
        item: Any,
        cursor_fields: list[str],
    ) -> str:
        """
        从对象创建游标

        Args:
            item: 数据对象
            cursor_fields: 游标字段列表

        Returns:
            游标字符串
        """
        cursor_data = {}
        for field in cursor_fields:
            value = getattr(item, field, None)
            if value is not None:
                # 处理datetime类型
                if hasattr(value, "isoformat"):
                    value = value.isoformat()
                cursor_data[field] = value

        return encode_cursor(cursor_data)

    @staticmethod
    def decode_cursor_data(cursor: str) -> dict:
        """
        解码游标数据

        Args:
            cursor: 游标字符串

        Returns:
            游标数据字典
        """
        return decode_cursor(cursor)


class PaginationMixin:
    """分页Mixin类，可混入到Repository中"""

    async def paginate(
        self,
        query,
        params: PaginationParams,
        count_query=None,
    ) -> PaginatedResponse[Any]:
        """
        分页查询

        Args:
            query: 查询对象
            params: 分页参数
            count_query: 计数查询

        Returns:
            PaginatedResponse: 分页响应
        """
        service = PaginationService()
        return await service.paginate_sqlalchemy(query, params, count_query)

    def apply_pagination_to_list(
        self,
        items: list[T],
        params: PaginationParams,
        sort_key: Callable[[T], Any] | None = None,
    ) -> PaginatedResponse[T]:
        """
        对列表进行分页

        Args:
            items: 数据列表
            params: 分页参数
            sort_key: 排序键函数

        Returns:
            PaginatedResponse: 分页响应
        """
        service = PaginationService()
        return service.paginate_list(items, params, sort_key)


# 便捷函数


def paginate_list(
    items: list[T],
    page: int = 1,
    page_size: int = 20,
    sort_key: Callable[[T], Any] | None = None,
) -> PaginatedResponse[T]:
    """
    列表分页便捷函数

    Args:
        items: 数据列表
        page: 页码
        page_size: 每页大小
        sort_key: 排序键函数

    Returns:
        PaginatedResponse: 分页响应
    """
    adapter = ListPaginationAdapter(items)
    return adapter.paginate_with_offset(page, page_size, sort_key)


def paginate_s3(
    storage_service,
    prefix: str = "",
    page: int = 1,
    page_size: int = 50,
) -> PaginatedResponse[dict]:
    """
    S3分页便捷函数

    Args:
        storage_service: 存储服务
        prefix: 前缀
        page: 页码
        page_size: 每页大小

    Returns:
        PaginatedResponse: 分页响应
    """
    adapter = S3PaginationAdapter(storage_service)
    return adapter.paginate_with_offset(prefix, page, page_size)


async def paginate_sqlalchemy(
    session,
    query,
    page: int = 1,
    page_size: int = 20,
    count_query=None,
) -> PaginatedResponse[Any]:
    """
    SQLAlchemy分页便捷函数

    Args:
        session: 数据库会话
        query: 查询对象
        page: 页码
        page_size: 每页大小
        count_query: 计数查询

    Returns:
        PaginatedResponse: 分页响应
    """
    adapter = SQLAlchemyPaginationAdapter(session)
    return await adapter.paginate_with_offset(query, page, page_size, count_query)
