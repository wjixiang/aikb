"""
Pagination Models - 分页数据模型

提供通用的分页参数和响应模型，支持多种分页策略：
- Offset-based: 传统的偏移量分页
- Cursor-based: 游标分页（适合大数据量）
- Keyset-based: 键集分页（高性能，无偏移问题）
"""

from enum import Enum
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field, model_validator


class PaginationStrategy(str, Enum):
    """分页策略枚举"""

    OFFSET = "offset"
    CURSOR = "cursor"
    KEYSET = "keyset"


class SortOrder(str, Enum):
    """排序方向"""

    ASC = "asc"
    DESC = "desc"


T = TypeVar("T")


class CursorInfo(BaseModel):
    """游标信息"""

    next_cursor: str | None = Field(
        default=None,
        description="下一页游标",
        examples=["eyJpZCI6IDEwMCwgInRzIjogMTcwNDA2MDgwMH0="],
    )
    previous_cursor: str | None = Field(
        default=None,
        description="上一页游标",
        examples=["eyJpZCI6IDUwLCAidHMiOiAxNzA0MDYwMDAwfQ=="],
    )
    has_next: bool = Field(
        default=False,
        description="是否有下一页",
        examples=[True],
    )
    has_previous: bool = Field(
        default=False,
        description="是否有上一页",
        examples=[False],
    )


class PageInfo(BaseModel):
    """页面信息（Offset分页）"""

    total: int = Field(
        ...,
        description="总记录数",
        examples=[1000],
    )
    page: int = Field(
        ...,
        description="当前页码（从1开始）",
        examples=[1],
    )
    page_size: int = Field(
        ...,
        description="每页大小",
        examples=[20],
    )
    total_pages: int = Field(
        ...,
        description="总页数",
        examples=[50],
    )
    has_next: bool = Field(
        ...,
        description="是否有下一页",
        examples=[True],
    )
    has_previous: bool = Field(
        ...,
        description="是否有上一页",
        examples=[False],
    )


class KeysetInfo(BaseModel):
    """键集分页信息"""

    next_keyset: dict[str, Any] | None = Field(
        default=None,
        description="下一页键集值",
        examples=[{"id": 100, "created_at": "2024-01-01T00:00:00Z"}],
    )
    previous_keyset: dict[str, Any] | None = Field(
        default=None,
        description="上一页键集值",
        examples=[{"id": 50, "created_at": "2023-12-31T23:59:59Z"}],
    )
    has_next: bool = Field(
        default=False,
        description="是否有下一页",
        examples=[True],
    )
    has_previous: bool = Field(
        default=False,
        description="是否有上一页",
        examples=[False],
    )


class PaginationParams(BaseModel):
    """通用分页参数"""

    strategy: PaginationStrategy = Field(
        default=PaginationStrategy.OFFSET,
        description="分页策略",
        examples=["offset"],
    )
    limit: int = Field(
        default=20,
        ge=1,
        le=1000,
        description="每页数量",
        examples=[20],
    )
    # Offset分页参数
    offset: int = Field(
        default=0,
        ge=0,
        description="偏移量（Offset分页）",
        examples=[0],
    )
    page: int | None = Field(
        default=None,
        ge=1,
        description="页码（从1开始，Offset分页）",
        examples=[1],
    )
    # Cursor分页参数
    cursor: str | None = Field(
        default=None,
        description="游标（Cursor分页）",
        examples=["eyJpZCI6IDEwMH0="],
    )
    direction: str = Field(
        default="next",
        description="翻页方向（Cursor分页）: next/previous",
        examples=["next"],
    )
    # Keyset分页参数
    keyset: dict[str, Any] | None = Field(
        default=None,
        description="键集值（Keyset分页）",
        examples=[{"id": 100}],
    )
    # 排序参数
    sort_by: str | None = Field(
        default=None,
        description="排序字段",
        examples=["created_at"],
    )
    sort_order: SortOrder = Field(
        default=SortOrder.DESC,
        description="排序方向",
        examples=["desc"],
    )

    @model_validator(mode="after")
    def validate_pagination_params(self):
        """验证分页参数一致性"""
        if self.strategy == PaginationStrategy.OFFSET:
            # 如果提供了page，自动计算offset
            if self.page is not None and self.page > 0:
                self.offset = (self.page - 1) * self.limit
        elif self.strategy == PaginationStrategy.CURSOR:
            if self.cursor and self.direction not in ("next", "previous"):
                raise ValueError("direction must be 'next' or 'previous' for cursor pagination")
        elif self.strategy == PaginationStrategy.KEYSET:
            if self.keyset is not None and not isinstance(self.keyset, dict):
                raise ValueError("keyset must be a dictionary")
        return self

    def get_offset(self) -> int:
        """获取有效的偏移量"""
        if self.page is not None:
            return (self.page - 1) * self.limit
        return self.offset

    def get_page_number(self) -> int:
        """获取当前页码"""
        if self.page is not None:
            return self.page
        return (self.offset // self.limit) + 1 if self.limit > 0 else 1


class PaginatedResponse(BaseModel, Generic[T]):
    """通用分页响应模型"""

    data: list[T] = Field(
        default_factory=list,
        description="数据列表",
    )
    strategy: PaginationStrategy = Field(
        ...,
        description="使用的分页策略",
        examples=["offset"],
    )
    # 根据策略填充不同的信息
    page_info: PageInfo | None = Field(
        default=None,
        description="Offset分页信息",
    )
    cursor_info: CursorInfo | None = Field(
        default=None,
        description="Cursor分页信息",
    )
    keyset_info: KeysetInfo | None = Field(
        default=None,
        description="Keyset分页信息",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "data": [],
                    "strategy": "offset",
                    "page_info": {
                        "total": 100,
                        "page": 1,
                        "page_size": 20,
                        "total_pages": 5,
                        "has_next": True,
                        "has_previous": False,
                    },
                }
            ]
        }
    }


class OffsetPaginationRequest(BaseModel):
    """Offset分页请求"""

    page: int = Field(
        default=1,
        ge=1,
        description="页码（从1开始）",
        examples=[1],
    )
    page_size: int = Field(
        default=20,
        ge=1,
        le=1000,
        description="每页数量",
        examples=[20],
    )
    sort_by: str | None = Field(
        default=None,
        description="排序字段",
        examples=["created_at"],
    )
    sort_order: SortOrder = Field(
        default=SortOrder.DESC,
        description="排序方向",
        examples=["desc"],
    )

    def to_params(self) -> PaginationParams:
        """转换为通用分页参数"""
        return PaginationParams(
            strategy=PaginationStrategy.OFFSET,
            limit=self.page_size,
            page=self.page,
            sort_by=self.sort_by,
            sort_order=self.sort_order,
        )


class CursorPaginationRequest(BaseModel):
    """Cursor分页请求"""

    cursor: str | None = Field(
        default=None,
        description="游标",
        examples=["eyJpZCI6IDEwMH0="],
    )
    limit: int = Field(
        default=20,
        ge=1,
        le=1000,
        description="每页数量",
        examples=[20],
    )
    direction: str = Field(
        default="next",
        description="翻页方向: next/previous",
        examples=["next"],
    )
    sort_by: str | None = Field(
        default=None,
        description="排序字段",
        examples=["created_at"],
    )
    sort_order: SortOrder = Field(
        default=SortOrder.DESC,
        description="排序方向",
        examples=["desc"],
    )

    def to_params(self) -> PaginationParams:
        """转换为通用分页参数"""
        return PaginationParams(
            strategy=PaginationStrategy.CURSOR,
            limit=self.limit,
            cursor=self.cursor,
            direction=self.direction,
            sort_by=self.sort_by,
            sort_order=self.sort_order,
        )


class KeysetPaginationRequest(BaseModel):
    """Keyset分页请求"""

    keyset: dict[str, Any] | None = Field(
        default=None,
        description="键集值",
        examples=[{"id": 100}],
    )
    limit: int = Field(
        default=20,
        ge=1,
        le=1000,
        description="每页数量",
        examples=[20],
    )
    direction: str = Field(
        default="next",
        description="翻页方向: next/previous",
        examples=["next"],
    )
    sort_by: str | None = Field(
        default=None,
        description="排序字段",
        examples=["created_at"],
    )
    sort_order: SortOrder = Field(
        default=SortOrder.DESC,
        description="排序方向",
        examples=["desc"],
    )

    def to_params(self) -> PaginationParams:
        """转换为通用分页参数"""
        return PaginationParams(
            strategy=PaginationStrategy.KEYSET,
            limit=self.limit,
            keyset=self.keyset,
            direction=self.direction,
            sort_by=self.sort_by,
            sort_order=self.sort_order,
        )


class S3ListParams(BaseModel):
    """S3列表分页参数"""

    prefix: str = Field(
        default="",
        description="文件前缀",
        examples=["documents/"],
    )
    max_keys: int = Field(
        default=1000,
        ge=1,
        le=1000,
        description="最大返回数量",
        examples=[100],
    )
    continuation_token: str | None = Field(
        default=None,
        description="继续令牌（用于分页）",
        examples=["1ueGcxLPRx1Tr/XYExHnhb0gV95BUjmas81J"],
    )
    start_after: str | None = Field(
        default=None,
        description="从此key之后开始列出",
        examples=["documents/file1.txt"],
    )

    def to_params(self) -> PaginationParams:
        """转换为通用分页参数"""
        return PaginationParams(
            strategy=PaginationStrategy.CURSOR,
            limit=self.max_keys,
            cursor=self.continuation_token,
        )
