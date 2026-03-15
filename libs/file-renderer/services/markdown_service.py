"""
Markdown Service - Markdown 文件读取服务
"""

from models.markdown_model import (
    MarkdownMetadata,
    MarkdownReadByPageResponse,
)
from services.storage_service import storage_service


class MarkdownService:
    """Markdown 文件服务"""

    def read_by_page(
        self,
        s3_key: str,
        page: int = 1,
        page_size: int = 1000,
    ) -> MarkdownReadByPageResponse:
        """
        分页读取 Markdown 文件

        Args:
            s3_key: S3存储路径
            page: 页码，从1开始
            page_size: 每页行数

        Returns:
            MarkdownReadByPageResponse: 分页读取结果
        """
        # 读取完整内容
        content_bytes = storage_service.download(s3_key)
        content = content_bytes.decode("utf-8")
        lines = content.split("\n")

        total_lines = len(lines)
        total_pages = (total_lines + page_size - 1) // page_size  # 向上取整

        # 验证页码
        if page < 1:
            page = 1
        if page > total_pages and total_pages > 0:
            page = total_pages

        # 计算页码范围
        start_line = (page - 1) * page_size
        end_line = min(start_line + page_size, total_lines)

        # 提取当前页内容
        page_content = "\n".join(lines[start_line:end_line])

        # 提取文件名
        file_name = s3_key.split("/")[-1] if "/" in s3_key else s3_key

        return MarkdownReadByPageResponse(
            metadata=MarkdownMetadata(
                s3_key=s3_key,
                file_name=file_name,
                total_lines=total_lines,
                total_pages=total_pages,
            ),
            page=page,
            content=page_content,
            start_line=start_line,
            end_line=end_line,
            has_next=page < total_pages,
            has_previous=page > 1,
        )


# 全局服务实例
markdown_service = MarkdownService()
