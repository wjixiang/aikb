"""
Pagination Service - 智能分页服务

支持多种分页策略:
1. 偏移分页 (Offset-based): 传统分页，支持跳转到指定页
2. 游标分页 (Cursor-based): 高性能分页，适合大数据量
3. 键集分页 (Keyset-based): 无偏移问题，性能稳定

同时保留原有的文本分页功能:
- 固定字符数分页 (FIXED)
- 语义分页 (SEMANTIC)
"""

import base64
import json
import re
from dataclasses import dataclass
from typing import Any, Callable, Generic, TypeVar

from config import settings
from models.file import PaginationMode
from models.pagination import (
    CursorInfo,
    CursorPaginationRequest,
    KeysetInfo,
    KeysetPaginationRequest,
    OffsetPaginationRequest,
    PageInfo,
    PaginatedResponse,
    PaginationParams,
    PaginationStrategy,
    SortOrder,
)


@dataclass
class Page:
    """页面数据类（文本分页）"""

    page_number: int
    content: str
    start_char: int
    end_char: int
    char_count: int


@dataclass
class PaginationResult:
    """文本分页结果"""

    pages: list[Page]
    total_pages: int
    total_chars: int
    mode: PaginationMode
    page_size: int


T = TypeVar("T")


class PaginationService:
    """分页服务"""

    def __init__(self):
        self.default_page_size = settings.pagination.default_page_size
        self.semantic_chunk_size = settings.pagination.semantic_chunk_size
        self.semantic_overlap = settings.pagination.semantic_overlap

    # ==================== 通用分页方法 ====================

    def paginate_list(
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
        # 先排序
        if sort_key and params.sort_by:
            reverse = params.sort_order == SortOrder.DESC
            items = sorted(items, key=sort_key, reverse=reverse)

        if params.strategy == PaginationStrategy.OFFSET:
            return self._paginate_list_offset(items, params)
        elif params.strategy == PaginationStrategy.CURSOR:
            return self._paginate_list_cursor(items, params)
        elif params.strategy == PaginationStrategy.KEYSET:
            return self._paginate_list_keyset(items, params)
        else:
            raise ValueError(f"Unsupported pagination strategy: {params.strategy}")

    def _paginate_list_offset(
        self, items: list[T], params: PaginationParams
    ) -> PaginatedResponse[T]:
        """列表偏移分页"""
        total = len(items)
        offset = params.get_offset()
        limit = params.limit

        # 计算分页
        start = min(offset, total)
        end = min(offset + limit, total)
        page_data = items[start:end]

        # 计算页码信息
        current_page = params.get_page_number()
        total_pages = (total + limit - 1) // limit if limit > 0 else 1

        page_info = PageInfo(
            total=total,
            page=current_page,
            page_size=limit,
            total_pages=total_pages,
            has_next=end < total,
            has_previous=start > 0,
        )

        return PaginatedResponse(
            data=page_data,
            strategy=PaginationStrategy.OFFSET,
            page_info=page_info,
        )

    def _paginate_list_cursor(
        self, items: list[T], params: PaginationParams
    ) -> PaginatedResponse[T]:
        """列表游标分页"""
        total = len(items)
        limit = params.limit

        # 解码游标获取起始位置
        start = 0
        if params.cursor:
            try:
                cursor_data = decode_cursor(params.cursor)
                start = cursor_data.get("index", 0)
                if params.direction == "previous":
                    start = max(0, start - limit)
            except Exception:
                start = 0

        # 获取数据
        end = min(start + limit, total)
        page_data = items[start:end]

        # 生成下一页和上一页游标
        next_cursor = None
        previous_cursor = None

        if end < total:
            next_cursor = encode_cursor({"index": end})
        if start > 0:
            previous_cursor = encode_cursor({"index": max(0, start - limit)})

        cursor_info = CursorInfo(
            next_cursor=next_cursor,
            previous_cursor=previous_cursor,
            has_next=end < total,
            has_previous=start > 0,
        )

        return PaginatedResponse(
            data=page_data,
            strategy=PaginationStrategy.CURSOR,
            cursor_info=cursor_info,
        )

    def _paginate_list_keyset(
        self, items: list[T], params: PaginationParams
    ) -> PaginatedResponse[T]:
        """列表键集分页"""
        # 键集分页在列表上退化为游标分页
        return self._paginate_list_cursor(items, params)

    # ==================== SQLAlchemy分页 ====================

    async def paginate_sqlalchemy(
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
        if params.strategy == PaginationStrategy.OFFSET:
            return await self._paginate_sqlalchemy_offset(query, params, count_query)
        elif params.strategy == PaginationStrategy.CURSOR:
            return await self._paginate_sqlalchemy_cursor(query, params)
        elif params.strategy == PaginationStrategy.KEYSET:
            return await self._paginate_sqlalchemy_keyset(query, params)
        else:
            raise ValueError(f"Unsupported pagination strategy: {params.strategy}")

    async def _paginate_sqlalchemy_offset(
        self, query, params: PaginationParams, count_query=None
    ) -> PaginatedResponse[Any]:
        """SQLAlchemy偏移分页"""
        from sqlalchemy import func, select

        # 获取总数
        if count_query is None:
            count_query = select(func.count()).select_from(query.subquery())

        total_result = await query.session.execute(count_query)
        total = total_result.scalar()

        # 应用分页
        offset = params.get_offset()
        limit = params.limit

        paginated_query = query.offset(offset).limit(limit + 1)  # 多取一条判断是否有下一页
        result = await query.session.execute(paginated_query)
        items = result.scalars().all()

        # 检查是否有下一页
        has_next = len(items) > limit
        items = items[:limit]  # 去掉多取的一条

        # 计算页码信息
        current_page = params.get_page_number()
        total_pages = (total + limit - 1) // limit if limit > 0 else 1

        page_info = PageInfo(
            total=total,
            page=current_page,
            page_size=limit,
            total_pages=total_pages,
            has_next=has_next,
            has_previous=offset > 0,
        )

        return PaginatedResponse(
            data=list(items),
            strategy=PaginationStrategy.OFFSET,
            page_info=page_info,
        )

    async def _paginate_sqlalchemy_cursor(
        self, query, params: PaginationParams
    ) -> PaginatedResponse[Any]:
        """SQLAlchemy游标分页"""
        limit = params.limit

        # 应用游标过滤
        if params.cursor:
            try:
                cursor_data = decode_cursor(params.cursor)
                # 这里假设有一个id字段用于游标
                if "id" in cursor_data:
                    from sqlalchemy import text

                    cursor_id = cursor_data["id"]
                    if params.direction == "next":
                        query = query.where(text(f"id > {cursor_id}"))
                    else:
                        query = query.where(text(f"id < {cursor_id}"))
            except Exception:
                pass

        # 应用排序
        if params.sort_by:
            from sqlalchemy import desc, text

            sort_column = text(params.sort_by)
            if params.sort_order == SortOrder.DESC:
                sort_column = desc(sort_column)
            query = query.order_by(sort_column)

        # 多取一条判断是否有下一页
        paginated_query = query.limit(limit + 1)
        result = await query.session.execute(paginated_query)
        items = result.scalars().all()

        has_next = len(items) > limit
        items = items[:limit]

        # 生成游标
        next_cursor = None
        previous_cursor = None

        if items and has_next:
            last_item = items[-1]
            next_cursor = encode_cursor({"id": getattr(last_item, "id", None)})

        if items and params.cursor:
            first_item = items[0]
            previous_cursor = encode_cursor({"id": getattr(first_item, "id", None)})

        cursor_info = CursorInfo(
            next_cursor=next_cursor,
            previous_cursor=previous_cursor,
            has_next=has_next,
            has_previous=params.cursor is not None,
        )

        return PaginatedResponse(
            data=list(items),
            strategy=PaginationStrategy.CURSOR,
            cursor_info=cursor_info,
        )

    async def _paginate_sqlalchemy_keyset(
        self, query, params: PaginationParams
    ) -> PaginatedResponse[Any]:
        """SQLAlchemy键集分页"""
        limit = params.limit

        # 应用键集过滤
        if params.keyset:
            from sqlalchemy import and_, text

            conditions = []
            for key, value in params.keyset.items():
                if params.direction == "next":
                    conditions.append(text(f"{key} > {value}"))
                else:
                    conditions.append(text(f"{key} < {value}"))
            if conditions:
                query = query.where(and_(*conditions))

        # 应用排序
        if params.sort_by:
            from sqlalchemy import desc, text

            sort_column = text(params.sort_by)
            if params.sort_order == SortOrder.DESC:
                sort_column = desc(sort_column)
            query = query.order_by(sort_column)

        # 多取一条判断是否有下一页
        paginated_query = query.limit(limit + 1)
        result = await query.session.execute(paginated_query)
        items = result.scalars().all()

        has_next = len(items) > limit
        items = items[:limit]

        # 生成键集
        next_keyset = None
        previous_keyset = None

        if items and has_next:
            last_item = items[-1]
            next_keyset = {params.sort_by: getattr(last_item, params.sort_by, None)}

        if items and params.keyset:
            first_item = items[0]
            previous_keyset = {params.sort_by: getattr(first_item, params.sort_by, None)}

        keyset_info = KeysetInfo(
            next_keyset=next_keyset,
            previous_keyset=previous_keyset,
            has_next=has_next,
            has_previous=params.keyset is not None,
        )

        return PaginatedResponse(
            data=list(items),
            strategy=PaginationStrategy.KEYSET,
            keyset_info=keyset_info,
        )

    # ==================== S3分页 ====================

    def paginate_s3_objects(
        self,
        storage_service,
        prefix: str = "",
        max_keys: int = 1000,
        continuation_token: str | None = None,
        start_after: str | None = None,
    ) -> PaginatedResponse[dict]:
        """
        S3对象列表分页

        Args:
            storage_service: 存储服务实例
            prefix: 前缀
            max_keys: 最大数量
            continuation_token: 继续令牌
            start_after: 从此key之后开始

        Returns:
            PaginatedResponse: 分页响应
        """
        from config import settings

        # 构建S3列表参数
        list_params = {
            "Bucket": settings.s3.bucket,
            "Prefix": prefix,
            "MaxKeys": max_keys,
        }

        if continuation_token:
            list_params["ContinuationToken"] = continuation_token
        if start_after:
            list_params["StartAfter"] = start_after

        # 调用S3 API
        response = storage_service.client.list_objects_v2(**list_params)

        # 提取对象信息
        contents = response.get("Contents", [])
        items = [
            {
                "key": obj["Key"],
                "size": obj["Size"],
                "last_modified": obj["LastModified"].isoformat(),
                "etag": obj["ETag"],
            }
            for obj in contents
        ]

        # 构建分页信息
        is_truncated = response.get("IsTruncated", False)
        next_continuation_token = response.get("NextContinuationToken")

        cursor_info = CursorInfo(
            next_cursor=next_continuation_token,
            previous_cursor=None,  # S3不支持反向分页
            has_next=is_truncated,
            has_previous=continuation_token is not None,
        )

        return PaginatedResponse(
            data=items,
            strategy=PaginationStrategy.CURSOR,
            cursor_info=cursor_info,
        )

    # ==================== 文本分页（原有功能）====================

    def paginate(
        self,
        content: str,
        mode: PaginationMode = PaginationMode.FIXED,
        page_size: int | None = None,
    ) -> PaginationResult:
        """
        对文本进行分页

        Args:
            content: 要分页的文本内容
            mode: 分页模式 (FIXED/SEMANTIC)
            page_size: 每页大小（字符数），默认使用配置值

        Returns:
            PaginationResult: 分页结果
        """
        if not content:
            return PaginationResult(
                pages=[],
                total_pages=0,
                total_chars=0,
                mode=mode,
                page_size=page_size or self.default_page_size,
            )

        if mode == PaginationMode.FIXED:
            return self._fixed_paginate(content, page_size)
        elif mode == PaginationMode.SEMANTIC:
            return self._semantic_paginate(content, page_size)
        else:
            raise ValueError(f"Unsupported pagination mode: {mode}")

    def _fixed_paginate(
        self, content: str, page_size: int | None = None
    ) -> PaginationResult:
        """固定字符数分页"""
        size = page_size or self.default_page_size
        total_chars = len(content)
        pages = []

        start = 0
        page_number = 1

        while start < total_chars:
            end = min(start + size, total_chars)
            page_content = content[start:end]

            pages.append(
                Page(
                    page_number=page_number,
                    content=page_content,
                    start_char=start,
                    end_char=end - 1,
                    char_count=len(page_content),
                )
            )

            start = end
            page_number += 1

        return PaginationResult(
            pages=pages,
            total_pages=len(pages),
            total_chars=total_chars,
            mode=PaginationMode.FIXED,
            page_size=size,
        )

    def _semantic_paginate(
        self, content: str, target_size: int | None = None
    ) -> PaginationResult:
        """语义分页 - 按段落、标题等自然边界切分"""
        target = target_size or self.semantic_chunk_size
        total_chars = len(content)

        # 按语义边界切分
        chunks = self._split_by_semantic_boundaries(content)

        pages = []
        current_page_content = []
        current_page_chars = 0
        page_number = 1
        start_char = 0

        for chunk in chunks:
            chunk_len = len(chunk)

            # 如果当前块单独就超过目标大小，需要单独成页
            if chunk_len >= target:
                # 先保存当前累积的内容
                if current_page_content:
                    page_text = "".join(current_page_content)
                    pages.append(
                        Page(
                            page_number=page_number,
                            content=page_text,
                            start_char=start_char,
                            end_char=start_char + len(page_text) - 1,
                            char_count=len(page_text),
                        )
                    )
                    start_char += len(page_text)
                    page_number += 1
                    current_page_content = []
                    current_page_chars = 0

                # 大块单独成页
                pages.append(
                    Page(
                        page_number=page_number,
                        content=chunk,
                        start_char=start_char,
                        end_char=start_char + chunk_len - 1,
                        char_count=chunk_len,
                    )
                )
                start_char += chunk_len
                page_number += 1

            # 如果加入当前块会超过目标大小，先保存当前页
            elif current_page_chars + chunk_len > target and current_page_content:
                page_text = "".join(current_page_content)
                pages.append(
                    Page(
                        page_number=page_number,
                        content=page_text,
                        start_char=start_char,
                        end_char=start_char + len(page_text) - 1,
                        char_count=len(page_text),
                    )
                )
                start_char += len(page_text)
                page_number += 1

                # 开始新页
                current_page_content = [chunk]
                current_page_chars = chunk_len

            else:
                # 加入当前页
                current_page_content.append(chunk)
                current_page_chars += chunk_len

        # 保存最后一页
        if current_page_content:
            page_text = "".join(current_page_content)
            pages.append(
                Page(
                    page_number=page_number,
                    content=page_text,
                    start_char=start_char,
                    end_char=start_char + len(page_text) - 1,
                    char_count=len(page_text),
                )
            )

        return PaginationResult(
            pages=pages,
            total_pages=len(pages),
            total_chars=total_chars,
            mode=PaginationMode.SEMANTIC,
            page_size=target,
        )

    def _split_by_semantic_boundaries(self, content: str) -> list[str]:
        """按语义边界切分文本"""
        # 首先尝试按二级标题切分
        if "## " in content:
            # 保留分隔符
            parts = re.split(r"(?=## )", content)
            return [p for p in parts if p.strip()]

        # 其次按一级标题切分
        if "# " in content:
            parts = re.split(r"(?=# )", content)
            return [p for p in parts if p.strip()]

        # 然后按段落切分（两个换行符）
        paragraphs = re.split(r"\n\n+", content)
        if len(paragraphs) > 1:
            return [p + "\n\n" for p in paragraphs if p.strip()]

        # 最后按行切分
        lines = content.split("\n")
        return [line + "\n" for line in lines if line.strip()]

    def get_page(
        self,
        content: str,
        page_number: int,
        mode: PaginationMode = PaginationMode.FIXED,
        page_size: int | None = None,
    ) -> Page | None:
        """获取指定页码的内容"""
        result = self.paginate(content, mode, page_size)

        if page_number < 1 or page_number > result.total_pages:
            return None

        return result.pages[page_number - 1]

    def get_page_range(
        self,
        content: str,
        start_page: int,
        end_page: int,
        mode: PaginationMode = PaginationMode.FIXED,
        page_size: int | None = None,
    ) -> list[Page]:
        """获取指定范围的页面"""
        result = self.paginate(content, mode, page_size)

        # 调整范围
        start = max(1, start_page)
        end = min(result.total_pages, end_page)

        if start > end:
            return []

        return result.pages[start - 1 : end]

    def get_page_count(
        self,
        content: str,
        mode: PaginationMode = PaginationMode.FIXED,
        page_size: int | None = None,
    ) -> int:
        """获取页面总数"""
        result = self.paginate(content, mode, page_size)
        return result.total_pages

    def get_page_by_char_position(
        self,
        content: str,
        char_position: int,
        mode: PaginationMode = PaginationMode.FIXED,
        page_size: int | None = None,
    ) -> Page | None:
        """根据字符位置获取所在页面"""
        result = self.paginate(content, mode, page_size)

        for page in result.pages:
            if page.start_char <= char_position <= page.end_char:
                return page

        return None


# ==================== 工具函数 ====================


def encode_cursor(data: dict) -> str:
    """
    编码游标数据

    Args:
        data: 游标数据字典

    Returns:
        base64编码的游标字符串
    """
    json_str = json.dumps(data, separators=(",", ":"))
    return base64.urlsafe_b64encode(json_str.encode()).decode().rstrip("=")


def decode_cursor(cursor: str) -> dict:
    """
    解码游标数据

    Args:
        cursor: base64编码的游标字符串

    Returns:
        游标数据字典
    """
    # 添加padding
    padding = 4 - len(cursor) % 4
    if padding != 4:
        cursor += "=" * padding

    json_str = base64.urlsafe_b64decode(cursor.encode()).decode()
    return json.loads(json_str)


def apply_pagination(
    items: list[T],
    params: PaginationParams,
    sort_key: Callable[[T], Any] | None = None,
) -> PaginatedResponse[T]:
    """
    应用分页到列表

    Args:
        items: 数据列表
        params: 分页参数
        sort_key: 排序键函数

    Returns:
        PaginatedResponse: 分页响应
    """
    service = PaginationService()
    return service.paginate_list(items, params, sort_key)


def create_page_response(
    items: list[T],
    total: int,
    params: PaginationParams,
) -> PaginatedResponse[T]:
    """
    创建分页响应

    Args:
        items: 当前页数据
        total: 总记录数
        params: 分页参数

    Returns:
        PaginatedResponse: 分页响应
    """
    if params.strategy == PaginationStrategy.OFFSET:
        offset = params.get_offset()
        limit = params.limit
        current_page = params.get_page_number()
        total_pages = (total + limit - 1) // limit if limit > 0 else 1

        page_info = PageInfo(
            total=total,
            page=current_page,
            page_size=limit,
            total_pages=total_pages,
            has_next=offset + len(items) < total,
            has_previous=offset > 0,
        )

        return PaginatedResponse(
            data=items,
            strategy=PaginationStrategy.OFFSET,
            page_info=page_info,
        )

    elif params.strategy == PaginationStrategy.CURSOR:
        # 游标分页需要调用者提供游标信息
        cursor_info = CursorInfo(
            next_cursor=None,
            previous_cursor=params.cursor,
            has_next=len(items) >= params.limit,
            has_previous=params.cursor is not None,
        )

        return PaginatedResponse(
            data=items,
            strategy=PaginationStrategy.CURSOR,
            cursor_info=cursor_info,
        )

    else:  # KEYSET
        keyset_info = KeysetInfo(
            next_keyset=None,
            previous_keyset=params.keyset,
            has_next=len(items) >= params.limit,
            has_previous=params.keyset is not None,
        )

        return PaginatedResponse(
            data=items,
            strategy=PaginationStrategy.KEYSET,
            keyset_info=keyset_info,
        )


def paginate_with_offset(
    items: list[T],
    page: int = 1,
    page_size: int = 20,
    sort_key: Callable[[T], Any] | None = None,
) -> PaginatedResponse[T]:
    """
    使用偏移分页的便捷函数

    Args:
        items: 数据列表
        page: 页码（从1开始）
        page_size: 每页大小
        sort_key: 排序键函数

    Returns:
        PaginatedResponse: 分页响应
    """
    params = OffsetPaginationRequest(
        page=page,
        page_size=page_size,
    ).to_params()

    service = PaginationService()
    return service.paginate_list(items, params, sort_key)


def paginate_with_cursor(
    items: list[T],
    cursor: str | None = None,
    limit: int = 20,
    direction: str = "next",
) -> PaginatedResponse[T]:
    """
    使用游标分页的便捷函数

    Args:
        items: 数据列表
        cursor: 游标
        limit: 每页大小
        direction: 翻页方向

    Returns:
        PaginatedResponse: 分页响应
    """
    params = CursorPaginationRequest(
        cursor=cursor,
        limit=limit,
        direction=direction,
    ).to_params()

    service = PaginationService()
    return service.paginate_list(items, params)


def paginate_with_keyset(
    items: list[T],
    keyset: dict[str, Any] | None = None,
    limit: int = 20,
    direction: str = "next",
) -> PaginatedResponse[T]:
    """
    使用键集分页的便捷函数

    Args:
        items: 数据列表
        keyset: 键集值
        limit: 每页大小
        direction: 翻页方向

    Returns:
        PaginatedResponse: 分页响应
    """
    params = KeysetPaginationRequest(
        keyset=keyset,
        limit=limit,
        direction=direction,
    ).to_params()

    service = PaginationService()
    return service.paginate_list(items, params)


# 全局服务实例
pagination_service = PaginationService()
