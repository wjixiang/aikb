"""
Pagination Service Tests - 分页服务单元测试

测试内容:
1. 文本分页 (FIXED, SEMANTIC)
2. 列表分页 (Offset, Cursor, Keyset)
3. 游标编解码
4. 分页工具函数
5. S3分页适配
"""

import pytest
from datetime import datetime
from unittest.mock import MagicMock, AsyncMock

from models.file import PaginationMode
from models.pagination import (
    CursorPaginationRequest,
    KeysetPaginationRequest,
    OffsetPaginationRequest,
    PaginatedResponse,
    PaginationParams,
    PaginationStrategy,
    SortOrder,
)
from services.pagination_service import (
    PaginationService,
    Page,
    apply_pagination,
    create_page_response,
    encode_cursor,
    decode_cursor,
    paginate_with_offset,
    paginate_with_cursor,
    paginate_with_keyset,
)
from services.pagination_adapters import (
    ListPaginationAdapter,
    S3PaginationAdapter,
    CursorPaginationHelper,
    paginate_list,
)


class TestPaginationServiceTextPagination:
    """文本分页测试类"""

    @pytest.fixture
    def service(self):
        """获取分页服务实例"""
        return PaginationService()

    @pytest.fixture
    def sample_text(self):
        """示例文本"""
        return "This is a sample text for testing pagination service. " * 50

    @pytest.fixture
    def markdown_text(self):
        """Markdown格式文本"""
        return """# Title 1

This is the first paragraph under title 1. It contains some content.

## Subtitle 1.1

This is content under subtitle 1.1. More text here.

## Subtitle 1.2

This is content under subtitle 1.2. Even more text here.

# Title 2

This is the second main section with its own content.

## Subtitle 2.1

Content under subtitle 2.1.
"""

    # ==================== 固定分页测试 ====================

    def test_fixed_paginate_basic(self, service, sample_text):
        """测试基本固定分页功能"""
        result = service.paginate(sample_text, mode=PaginationMode.FIXED, page_size=100)

        assert result.mode == PaginationMode.FIXED
        assert result.page_size == 100
        assert result.total_pages > 0
        assert result.total_chars == len(sample_text)
        assert len(result.pages) == result.total_pages

    def test_fixed_paginate_page_content(self, service):
        """测试固定分页页面内容"""
        text = "ABCDEFGHIJ"  # 10 characters
        result = service.paginate(text, mode=PaginationMode.FIXED, page_size=3)

        # Should create 4 pages: ABC, DEF, GHI, J
        assert result.total_pages == 4
        assert result.pages[0].content == "ABC"
        assert result.pages[1].content == "DEF"
        assert result.pages[2].content == "GHI"
        assert result.pages[3].content == "J"

    def test_fixed_paginate_page_metadata(self, service):
        """测试固定分页页面元数据"""
        text = "ABCDEFGHIJ"
        result = service.paginate(text, mode=PaginationMode.FIXED, page_size=3)

        # Check page numbers
        for i, page in enumerate(result.pages):
            assert page.page_number == i + 1

        # Check character positions
        assert result.pages[0].start_char == 0
        assert result.pages[0].end_char == 2
        assert result.pages[1].start_char == 3
        assert result.pages[1].end_char == 5
        assert result.pages[2].start_char == 6
        assert result.pages[2].end_char == 8
        assert result.pages[3].start_char == 9
        assert result.pages[3].end_char == 9

    def test_fixed_paginate_empty_content(self, service):
        """测试空内容分页"""
        result = service.paginate("", mode=PaginationMode.FIXED, page_size=100)

        assert result.total_pages == 0
        assert result.total_chars == 0
        assert len(result.pages) == 0

    def test_fixed_paginate_exact_fit(self, service):
        """测试正好整除的分页"""
        text = "ABCDEF"  # 6 characters
        result = service.paginate(text, mode=PaginationMode.FIXED, page_size=3)

        assert result.total_pages == 2
        assert result.pages[0].content == "ABC"
        assert result.pages[1].content == "DEF"

    def test_fixed_paginate_single_page(self, service):
        """测试单页情况"""
        text = "Short"
        result = service.paginate(text, mode=PaginationMode.FIXED, page_size=100)

        assert result.total_pages == 1
        assert result.pages[0].content == "Short"

    # ==================== 语义分页测试 ====================

    def test_semantic_paginate_by_heading2(self, service, markdown_text):
        """测试按二级标题语义分页"""
        result = service.paginate(markdown_text, mode=PaginationMode.SEMANTIC, page_size=500)

        assert result.mode == PaginationMode.SEMANTIC
        assert result.total_pages > 0

        # Check that pages respect heading boundaries
        for page in result.pages:
            content = page.content
            lines = content.split('\n')
            for line in lines:
                if line.startswith('## '):
                    # Heading should be at the start of content or after newline
                    assert content.find(line) == 0 or content[content.find(line) - 1] == '\n'

    def test_semantic_paginate_respects_boundaries(self, service):
        """测试语义分页尊重自然边界"""
        text = """# Main Title

First paragraph content here.

Second paragraph content here.

## Section 1

Section 1 content.

## Section 2

Section 2 content.
"""
        result = service.paginate(text, mode=PaginationMode.SEMANTIC, page_size=50)

        # Each page should contain complete sections or paragraphs
        for page in result.pages:
            content = page.content.strip()
            if content and not content.startswith('#'):
                pass  # Paragraphs should be kept together when possible

    def test_semantic_paginate_large_chunk(self, service):
        """测试语义分页处理大段落"""
        # Create a paragraph larger than target size
        large_paragraph = "A" * 1000
        text = f"# Title\n\n{large_paragraph}\n\n## Section\n\nNormal content."

        result = service.paginate(text, mode=PaginationMode.SEMANTIC, page_size=100)

        # Large paragraph should be in its own page
        large_page = None
        for page in result.pages:
            if "A" * 100 in page.content:
                large_page = page
                break

        assert large_page is not None
        assert large_page.char_count >= 1000

    def test_semantic_paginate_empty_content(self, service):
        """测试空内容语义分页"""
        result = service.paginate("", mode=PaginationMode.SEMANTIC, page_size=100)

        assert result.total_pages == 0
        assert result.total_chars == 0
        assert len(result.pages) == 0

    def test_semantic_paginate_no_headings(self, service):
        """测试无标题文本的语义分页"""
        text = "Paragraph one.\n\nParagraph two.\n\nParagraph three."
        result = service.paginate(text, mode=PaginationMode.SEMANTIC, page_size=50)

        assert result.total_pages > 0

    # ==================== 获取指定页面测试 ====================

    def test_get_page_valid(self, service, sample_text):
        """测试获取有效页面"""
        page = service.get_page(sample_text, page_number=1, mode=PaginationMode.FIXED, page_size=100)

        assert page is not None
        assert page.page_number == 1
        assert len(page.content) <= 100

    def test_get_page_invalid(self, service, sample_text):
        """测试获取无效页面"""
        page = service.get_page(sample_text, page_number=9999, mode=PaginationMode.FIXED, page_size=100)

        assert page is None

    def test_get_page_zero(self, service, sample_text):
        """测试获取第0页"""
        page = service.get_page(sample_text, page_number=0, mode=PaginationMode.FIXED, page_size=100)

        assert page is None

    def test_get_page_negative(self, service, sample_text):
        """测试获取负页码"""
        page = service.get_page(sample_text, page_number=-1, mode=PaginationMode.FIXED, page_size=100)

        assert page is None

    # ==================== 获取页面范围测试 ====================

    def test_get_page_range_valid(self, service):
        """测试获取有效页面范围"""
        text = "ABCDEFGHIJ"
        pages = service.get_page_range(text, start_page=1, end_page=2, mode=PaginationMode.FIXED, page_size=3)

        assert len(pages) == 2
        assert pages[0].page_number == 1
        assert pages[1].page_number == 2

    def test_get_page_range_out_of_bounds(self, service):
        """测试获取超出范围的页面"""
        text = "ABCDEF"
        pages = service.get_page_range(text, start_page=10, end_page=20, mode=PaginationMode.FIXED, page_size=3)

        assert len(pages) == 0

    def test_get_page_range_partial(self, service):
        """测试获取部分超出范围的页面"""
        text = "ABCDEFGHIJ"  # 4 pages with size 3
        pages = service.get_page_range(text, start_page=3, end_page=10, mode=PaginationMode.FIXED, page_size=3)

        assert len(pages) == 2  # Only pages 3 and 4 exist
        assert pages[0].page_number == 3
        assert pages[1].page_number == 4

    # ==================== 获取页面总数测试 ====================

    def test_get_page_count(self, service):
        """测试获取页面总数"""
        text = "ABCDEFGHIJ"
        count = service.get_page_count(text, mode=PaginationMode.FIXED, page_size=3)

        assert count == 4

    def test_get_page_count_empty(self, service):
        """测试空内容页面总数"""
        count = service.get_page_count("", mode=PaginationMode.FIXED, page_size=100)

        assert count == 0

    # ==================== 根据字符位置获取页面测试 ====================

    def test_get_page_by_char_position_valid(self, service):
        """测试根据有效字符位置获取页面"""
        text = "ABCDEFGHIJ"
        page = service.get_page_by_char_position(text, char_position=5, mode=PaginationMode.FIXED, page_size=3)

        assert page is not None
        assert page.page_number == 2  # Position 5 is in page 2 (DEF)
        assert page.start_char <= 5 <= page.end_char

    def test_get_page_by_char_position_out_of_bounds(self, service):
        """测试根据超出范围字符位置获取页面"""
        text = "ABCDEF"
        page = service.get_page_by_char_position(text, char_position=100, mode=PaginationMode.FIXED, page_size=3)

        assert page is None

    def test_get_page_by_char_position_negative(self, service):
        """测试根据负字符位置获取页面"""
        text = "ABCDEF"
        page = service.get_page_by_char_position(text, char_position=-1, mode=PaginationMode.FIXED, page_size=3)

        assert page is None

    # ==================== 边界情况测试 ====================

    def test_unicode_content(self, service):
        """测试Unicode内容分页"""
        text = "你好世界！" * 100  # Chinese characters
        result = service.paginate(text, mode=PaginationMode.FIXED, page_size=50)

        assert result.total_pages > 0
        assert result.total_chars == len(text)

    def test_multiline_content(self, service):
        """测试多行内容分页"""
        text = "Line 1\nLine 2\nLine 3\n" * 20
        result = service.paginate(text, mode=PaginationMode.FIXED, page_size=30)

        assert result.total_pages > 0
        # Reconstruct and verify
        reconstructed = "".join(page.content for page in result.pages)
        assert reconstructed == text

    def test_content_integrity(self, service, sample_text):
        """测试分页后内容完整性"""
        result = service.paginate(sample_text, mode=PaginationMode.FIXED, page_size=100)

        # Reconstruct original text from pages
        reconstructed = "".join(page.content for page in result.pages)
        assert reconstructed == sample_text

    def test_semantic_content_integrity(self, service, markdown_text):
        """测试语义分页后内容完整性"""
        result = service.paginate(markdown_text, mode=PaginationMode.SEMANTIC, page_size=50)

        # Reconstruct original text from pages
        reconstructed = "".join(page.content for page in result.pages)
        assert reconstructed == markdown_text

    # ==================== 默认配置测试 ====================

    def test_default_page_size(self, service, sample_text):
        """测试默认页面大小"""
        result = service.paginate(sample_text, mode=PaginationMode.FIXED)

        # Should use default from settings (4000)
        assert result.page_size == 4000

    def test_invalid_mode(self, service, sample_text):
        """测试无效分页模式"""
        with pytest.raises(ValueError, match="Unsupported pagination mode"):
            service.paginate(sample_text, mode="invalid_mode")

    # ==================== 分页边界分割测试 ====================

    def test_split_by_semantic_boundaries_heading2(self, service):
        """测试按二级标题切分"""
        text = "## Section 1\nContent 1\n## Section 2\nContent 2"
        chunks = service._split_by_semantic_boundaries(text)

        assert len(chunks) == 2
        assert "## Section 1" in chunks[0]
        assert "## Section 2" in chunks[1]

    def test_split_by_semantic_boundaries_heading1(self, service):
        """测试按一级标题切分"""
        text = "# Title 1\nContent 1\n# Title 2\nContent 2"
        chunks = service._split_by_semantic_boundaries(text)

        assert len(chunks) == 2
        assert "# Title 1" in chunks[0]
        assert "# Title 2" in chunks[1]

    def test_split_by_semantic_boundaries_paragraph(self, service):
        """测试按段落切分"""
        text = "Paragraph 1\n\nParagraph 2\n\nParagraph 3"
        chunks = service._split_by_semantic_boundaries(text)

        assert len(chunks) == 3

    def test_split_by_semantic_boundaries_line(self, service):
        """测试按行切分"""
        text = "Line 1\nLine 2\nLine 3"
        chunks = service._split_by_semantic_boundaries(text)

        assert len(chunks) == 3

    def test_split_by_semantic_boundaries_empty(self, service):
        """测试空内容切分"""
        chunks = service._split_by_semantic_boundaries("")

        assert len(chunks) == 0


class TestCursorEncoding:
    """游标编解码测试"""

    def test_encode_cursor_basic(self):
        """测试基本游标编码"""
        data = {"id": 100, "timestamp": "2024-01-01T00:00:00Z"}
        cursor = encode_cursor(data)

        assert isinstance(cursor, str)
        assert len(cursor) > 0

    def test_decode_cursor_basic(self):
        """测试基本游标解码"""
        data = {"id": 100, "timestamp": "2024-01-01T00:00:00Z"}
        cursor = encode_cursor(data)
        decoded = decode_cursor(cursor)

        assert decoded == data

    def test_encode_decode_roundtrip(self):
        """测试编码解码往返"""
        test_cases = [
            {"id": 1},
            {"id": 100, "created_at": "2024-01-15T10:30:00Z"},
            {"key": "value", "number": 42, "bool": True},
        ]

        for data in test_cases:
            cursor = encode_cursor(data)
            decoded = decode_cursor(cursor)
            assert decoded == data

    def test_decode_invalid_cursor(self):
        """测试解码无效游标"""
        with pytest.raises(Exception):
            decode_cursor("invalid_cursor!!!")

    def test_cursor_url_safe(self):
        """测试游标URL安全"""
        data = {"id": 100, "path": "test/path"}
        cursor = encode_cursor(data)

        # URL安全字符检查
        assert "+" not in cursor
        assert "/" not in cursor
        assert "=" not in cursor  # padding被移除


class TestListPagination:
    """列表分页测试"""

    @pytest.fixture
    def sample_items(self):
        """示例数据列表"""
        return [
            {"id": i, "name": f"Item {i}", "value": i * 10}
            for i in range(1, 101)
        ]

    def test_offset_pagination_basic(self, sample_items):
        """测试基本偏移分页"""
        params = OffsetPaginationRequest(
            page=1,
            page_size=20,
        ).to_params()

        result = apply_pagination(sample_items, params)

        assert result.strategy == PaginationStrategy.OFFSET
        assert len(result.data) == 20
        assert result.page_info is not None
        assert result.page_info.page == 1
        assert result.page_info.total == 100
        assert result.page_info.has_next is True
        assert result.page_info.has_previous is False

    def test_offset_pagination_second_page(self, sample_items):
        """测试偏移分页第二页"""
        params = OffsetPaginationRequest(
            page=2,
            page_size=20,
        ).to_params()

        result = apply_pagination(sample_items, params)

        assert result.page_info.page == 2
        assert len(result.data) == 20
        assert result.data[0]["id"] == 21
        assert result.page_info.has_next is True
        assert result.page_info.has_previous is True

    def test_offset_pagination_last_page(self, sample_items):
        """测试偏移分页最后一页"""
        params = OffsetPaginationRequest(
            page=5,
            page_size=20,
        ).to_params()

        result = apply_pagination(sample_items, params)

        assert result.page_info.page == 5
        assert len(result.data) == 20
        assert result.page_info.has_next is False
        assert result.page_info.has_previous is True

    def test_offset_pagination_empty_list(self):
        """测试空列表偏移分页"""
        params = OffsetPaginationRequest(
            page=1,
            page_size=20,
        ).to_params()

        result = apply_pagination([], params)

        assert len(result.data) == 0
        assert result.page_info.total == 0
        assert result.page_info.has_next is False

    def test_cursor_pagination_basic(self, sample_items):
        """测试基本游标分页"""
        params = CursorPaginationRequest(
            cursor=None,
            limit=20,
        ).to_params()

        result = apply_pagination(sample_items, params)

        assert result.strategy == PaginationStrategy.CURSOR
        assert len(result.data) == 20
        assert result.cursor_info is not None
        assert result.cursor_info.has_next is True
        assert result.cursor_info.has_previous is False

    def test_cursor_pagination_with_cursor(self, sample_items):
        """测试带游标的分页"""
        # 第一页
        params1 = CursorPaginationRequest(cursor=None, limit=20).to_params()
        result1 = apply_pagination(sample_items, params1)

        # 使用返回的游标获取第二页
        next_cursor = result1.cursor_info.next_cursor
        assert next_cursor is not None

        params2 = CursorPaginationRequest(
            cursor=next_cursor,
            limit=20,
        ).to_params()
        result2 = apply_pagination(sample_items, params2)

        assert len(result2.data) == 20
        assert result2.cursor_info.has_previous is True

    def test_pagination_with_sorting(self, sample_items):
        """测试带排序的分页"""
        params = OffsetPaginationRequest(
            page=1,
            page_size=20,
            sort_by="value",
            sort_order=SortOrder.DESC,
        ).to_params()

        result = apply_pagination(sample_items, params, sort_key=lambda x: x["value"])

        # 验证降序排序
        assert result.data[0]["value"] > result.data[-1]["value"]

    def test_pagination_with_sorting_asc(self, sample_items):
        """测试升序排序"""
        params = OffsetPaginationRequest(
            page=1,
            page_size=20,
            sort_by="value",
            sort_order=SortOrder.ASC,
        ).to_params()

        result = apply_pagination(sample_items, params, sort_key=lambda x: x["value"])

        # 验证升序排序
        assert result.data[0]["value"] < result.data[-1]["value"]


class TestPaginationUtilities:
    """分页工具函数测试"""

    def test_create_page_response_offset(self):
        """测试创建偏移分页响应"""
        items = [{"id": i} for i in range(1, 21)]
        params = OffsetPaginationRequest(page=1, page_size=20).to_params()

        result = create_page_response(items, total=100, params=params)

        assert result.strategy == PaginationStrategy.OFFSET
        assert result.page_info is not None
        assert result.page_info.total == 100
        assert result.page_info.page == 1

    def test_create_page_response_cursor(self):
        """测试创建游标分页响应"""
        items = [{"id": i} for i in range(1, 21)]
        params = CursorPaginationRequest(cursor=None, limit=20).to_params()

        result = create_page_response(items, total=100, params=params)

        assert result.strategy == PaginationStrategy.CURSOR
        assert result.cursor_info is not None

    def test_paginate_with_offset_convenience(self):
        """测试偏移分页便捷函数"""
        items = [{"id": i} for i in range(1, 101)]

        result = paginate_with_offset(items, page=2, page_size=20)

        assert result.strategy == PaginationStrategy.OFFSET
        assert result.page_info.page == 2
        assert result.data[0]["id"] == 21

    def test_paginate_with_cursor_convenience(self):
        """测试游标分页便捷函数"""
        items = [{"id": i} for i in range(1, 101)]

        result = paginate_with_cursor(items, cursor=None, limit=20)

        assert result.strategy == PaginationStrategy.CURSOR
        assert len(result.data) == 20

    def test_paginate_with_keyset_convenience(self):
        """测试键集分页便捷函数"""
        items = [{"id": i} for i in range(1, 101)]

        result = paginate_with_keyset(items, keyset=None, limit=20)

        assert result.strategy == PaginationStrategy.KEYSET
        assert len(result.data) == 20


class TestListPaginationAdapter:
    """列表分页适配器测试"""

    def test_adapter_offset_pagination(self):
        """测试适配器偏移分页"""
        items = [{"id": i} for i in range(1, 101)]
        adapter = ListPaginationAdapter(items)

        result = adapter.paginate_with_offset(page=1, page_size=20)

        assert len(result.data) == 20
        assert result.page_info.page == 1

    def test_adapter_with_sorting(self):
        """测试适配器排序"""
        items = [{"id": i, "value": 100 - i} for i in range(1, 101)]
        adapter = ListPaginationAdapter(items)

        result = adapter.paginate_with_offset(
            page=1,
            page_size=20,
            sort_key=lambda x: x["value"]
        )

        # 验证排序
        assert result.data[0]["value"] < result.data[-1]["value"]


class TestCursorPaginationHelper:
    """游标分页辅助类测试"""

    def test_create_cursor_from_object(self):
        """测试从对象创建游标"""
        class MockItem:
            def __init__(self):
                self.id = 100
                self.created_at = datetime(2024, 1, 1, 12, 0, 0)

        item = MockItem()
        cursor = CursorPaginationHelper.create_cursor(item, ["id", "created_at"])

        assert isinstance(cursor, str)

        # 解码验证
        decoded = CursorPaginationHelper.decode_cursor_data(cursor)
        assert decoded["id"] == 100
        assert "created_at" in decoded

    def test_decode_cursor_data(self):
        """测试解码游标数据"""
        data = {"id": 100, "name": "test"}
        cursor = encode_cursor(data)

        decoded = CursorPaginationHelper.decode_cursor_data(cursor)
        assert decoded == data


class TestS3PaginationAdapter:
    """S3分页适配器测试"""

    @pytest.fixture
    def mock_storage_service(self):
        """模拟存储服务"""
        service = MagicMock()
        service.list_objects.return_value = [
            "file1.txt",
            "file2.txt",
            "file3.txt",
        ]
        service.get_file_size.side_effect = [100, 200, 300]
        service.get_modified_time.side_effect = [1000, 2000, 3000]
        return service

    def test_adapter_list_with_metadata(self, mock_storage_service):
        """测试获取带元数据的文件列表"""
        adapter = S3PaginationAdapter(mock_storage_service)

        files = adapter.list_with_metadata(prefix="test/")

        assert len(files) == 3
        assert files[0]["key"] == "file1.txt"
        assert files[0]["size"] == 100

    def test_adapter_paginate_with_offset(self, mock_storage_service):
        """测试适配器偏移分页"""
        adapter = S3PaginationAdapter(mock_storage_service)

        result = adapter.paginate_with_offset(prefix="test/", page=1, page_size=2)

        assert result.strategy == PaginationStrategy.OFFSET
        assert len(result.data) == 2


class TestPaginationEdgeCases:
    """分页边界情况测试"""

    def test_pagination_with_single_item(self):
        """测试单条数据分页"""
        items = [{"id": 1}]
        params = OffsetPaginationRequest(page=1, page_size=20).to_params()

        result = apply_pagination(items, params)

        assert len(result.data) == 1
        assert result.page_info.total_pages == 1
        assert result.page_info.has_next is False

    def test_pagination_page_beyond_range(self):
        """测试超出范围的页码"""
        items = [{"id": i} for i in range(1, 21)]
        params = OffsetPaginationRequest(page=10, page_size=20).to_params()

        result = apply_pagination(items, params)

        assert len(result.data) == 0
        assert result.page_info.has_next is False

    def test_pagination_with_large_page_size(self):
        """测试大页码大小"""
        items = [{"id": i} for i in range(1, 11)]
        params = OffsetPaginationRequest(page=1, page_size=1000).to_params()

        result = apply_pagination(items, params)

        assert len(result.data) == 10
        assert result.page_info.total_pages == 1

    def test_pagination_with_duplicate_sort_keys(self):
        """测试重复排序键"""
        items = [
            {"id": 1, "value": 10},
            {"id": 2, "value": 10},
            {"id": 3, "value": 10},
        ]
        params = OffsetPaginationRequest(page=1, page_size=2).to_params()

        result = apply_pagination(items, params, sort_key=lambda x: x["value"])

        assert len(result.data) == 2


class TestPaginatedResponseModel:
    """分页响应模型测试"""

    def test_paginated_response_creation(self):
        """测试分页响应创建"""
        response = PaginatedResponse[
            dict
        ](
            data=[{"id": 1}, {"id": 2}],
            strategy=PaginationStrategy.OFFSET,
        )

        assert len(response.data) == 2
        assert response.strategy == PaginationStrategy.OFFSET

    def test_paginated_response_with_page_info(self):
        """测试带分页信息的分页响应"""
        from models.pagination import PageInfo

        page_info = PageInfo(
            total=100,
            page=1,
            page_size=20,
            total_pages=5,
            has_next=True,
            has_previous=False,
        )

        response = PaginatedResponse[dict](
            data=[{"id": 1}],
            strategy=PaginationStrategy.OFFSET,
            page_info=page_info,
        )

        assert response.page_info.total == 100
        assert response.page_info.has_next is True

    def test_paginated_response_with_cursor_info(self):
        """测试带游标信息的分页响应"""
        from models.pagination import CursorInfo

        cursor_info = CursorInfo(
            next_cursor="abc123",
            previous_cursor=None,
            has_next=True,
            has_previous=False,
        )

        response = PaginatedResponse[dict](
            data=[{"id": 1}],
            strategy=PaginationStrategy.CURSOR,
            cursor_info=cursor_info,
        )

        assert response.cursor_info.next_cursor == "abc123"


class TestPaginationParams:
    """分页参数测试"""

    def test_offset_params_calculation(self):
        """测试偏移参数计算"""
        params = PaginationParams(
            strategy=PaginationStrategy.OFFSET,
            limit=20,
            page=3,
        )

        assert params.get_offset() == 40  # (3-1) * 20
        assert params.get_page_number() == 3

    def test_cursor_params_validation(self):
        """测试游标参数验证"""
        params = PaginationParams(
            strategy=PaginationStrategy.CURSOR,
            limit=20,
            cursor="eyJpZCI6IDEwfQ==",
            direction="next",
        )

        assert params.cursor is not None
        assert params.direction == "next"

    def test_keyset_params_validation(self):
        """测试键集参数验证"""
        params = PaginationParams(
            strategy=PaginationStrategy.KEYSET,
            limit=20,
            keyset={"id": 100},
        )

        assert params.keyset == {"id": 100}

    def test_invalid_direction_raises_error(self):
        """测试无效方向引发错误"""
        with pytest.raises(ValueError):
            PaginationParams(
                strategy=PaginationStrategy.CURSOR,
                limit=20,
                cursor="test",
                direction="invalid",
            )


# ==================== 便捷函数测试 ====================

class TestConvenienceFunctions:
    """便捷函数测试"""

    def test_paginate_list_function(self):
        """测试paginate_list便捷函数"""
        items = [{"id": i} for i in range(1, 101)]

        result = paginate_list(items, page=2, page_size=20)

        assert result.strategy == PaginationStrategy.OFFSET
        assert result.page_info.page == 2
        assert len(result.data) == 20
