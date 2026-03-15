"""
Markdown Edit Service - Markdown 文件编辑服务
"""

from models.markdown_edit import MarkdownEditRequest, MarkdownInsertRequest, MarkdownDeleteRequest
from models.markdown_model import ContentDiff, MarkdownEditResponse, MarkdownPreviewResponse
from services.storage_service import storage_service


class MarkdownEditService:
    """Markdown 文件编辑服务"""

    def replace(
        self,
        s3_key: str,
        start_line: int,
        end_line: int,
        new_content: str,
    ) -> MarkdownEditResponse:
        """
        替换指定行范围的内容

        Args:
            s3_key: S3存储路径
            start_line: 起始行号（从0开始）
            end_line: 结束行号
            new_content: 新内容

        Returns:
            MarkdownEditResponse: 编辑结果
        """
        # 读取原文件
        content_bytes = storage_service.download(s3_key)
        content = content_bytes.decode("utf-8")
        lines = content.split("\n")

        old_line_count = len(lines)

        # 验证行号范围
        if start_line < 0 or start_line >= old_line_count:
            return MarkdownEditResponse(
                success=False,
                message=f"Invalid start_line: {start_line}. File has {old_line_count} lines.",
                s3_key=s3_key,
                old_line_count=old_line_count,
                new_line_count=old_line_count,
                lines_changed=0,
            )

        if end_line > old_line_count:
            end_line = old_line_count

        # 执行替换
        before = lines[:start_line]
        after = lines[end_line:]
        new_lines = before + new_content.split("\n") + after

        # 写入文件
        new_content_str = "\n".join(new_lines)
        storage_service.upload(
            data=new_content_str,
            key=s3_key,
            content_type="text/markdown"
        )

        new_line_count = len(new_lines)

        return MarkdownEditResponse(
            success=True,
            message=f"Successfully replaced lines {start_line}-{end_line}",
            s3_key=s3_key,
            old_line_count=old_line_count,
            new_line_count=new_line_count,
            lines_changed=new_line_count - old_line_count,
        )

    def insert(
        self,
        s3_key: str,
        content: str,
        position: str = "end",
        target_line: int | None = None,
    ) -> MarkdownEditResponse:
        """
        插入内容

        Args:
            s3_key: S3存储路径
            content: 插入的内容
            position: 插入位置 (start/end/before_line/after_line)
            target_line: 目标行号（before_line/after_line用）

        Returns:
            MarkdownEditResponse: 编辑结果
        """
        # 读取原文件
        content_bytes = storage_service.download(s3_key)
        original_content = content_bytes.decode("utf-8")
        lines = original_content.split("\n")

        old_line_count = len(lines)

        # 根据位置插入
        insert_lines = content.split("\n")

        if position == "start":
            # 插入到开头
            new_lines = insert_lines + lines
        elif position == "end":
            # 插入到结尾
            new_lines = lines + insert_lines
        elif position == "before_line" and target_line is not None:
            # 插入到指定行之前
            if target_line < 0 or target_line > old_line_count:
                return MarkdownEditResponse(
                    success=False,
                    message=f"Invalid target_line: {target_line}",
                    s3_key=s3_key,
                    old_line_count=old_line_count,
                    new_line_count=old_line_count,
                    lines_changed=0,
                )
            new_lines = lines[:target_line] + insert_lines + lines[target_line:]
        elif position == "after_line" and target_line is not None:
            # 插入到指定行之后
            if target_line < 0 or target_line >= old_line_count:
                return MarkdownEditResponse(
                    success=False,
                    message=f"Invalid target_line: {target_line}",
                    s3_key=s3_key,
                    old_line_count=old_line_count,
                    new_line_count=old_line_count,
                    lines_changed=0,
                )
            new_lines = lines[:target_line + 1] + insert_lines + lines[target_line + 1:]
        else:
            return MarkdownEditResponse(
                success=False,
                message=f"Invalid position: {position}",
                s3_key=s3_key,
                old_line_count=old_line_count,
                new_line_count=old_line_count,
                lines_changed=0,
            )

        # 写入文件
        new_content_str = "\n".join(new_lines)
        storage_service.upload(
            data=new_content_str,
            key=s3_key,
            content_type="text/markdown"
        )

        new_line_count = len(new_lines)

        return MarkdownEditResponse(
            success=True,
            message=f"Successfully inserted content at {position}",
            s3_key=s3_key,
            old_line_count=old_line_count,
            new_line_count=new_line_count,
            lines_changed=new_line_count - old_line_count,
        )

    def delete(
        self,
        s3_key: str,
        start_line: int,
        end_line: int,
    ) -> MarkdownEditResponse:
        """
        删除指定行范围的内容

        Args:
            s3_key: S3存储路径
            start_line: 起始行号
            end_line: 结束行号

        Returns:
            MarkdownEditResponse: 编辑结果
        """
        # 读取原文件
        content_bytes = storage_service.download(s3_key)
        content = content_bytes.decode("utf-8")
        lines = content.split("\n")

        old_line_count = len(lines)

        # 验证行号范围
        if start_line < 0 or start_line >= old_line_count:
            return MarkdownEditResponse(
                success=False,
                message=f"Invalid start_line: {start_line}",
                s3_key=s3_key,
                old_line_count=old_line_count,
                new_line_count=old_line_count,
                lines_changed=0,
            )

        if end_line > old_line_count:
            end_line = old_line_count

        # 执行删除
        new_lines = lines[:start_line] + lines[end_line:]

        # 写入文件
        new_content_str = "\n".join(new_lines)
        storage_service.upload(
            data=new_content_str,
            key=s3_key,
            content_type="text/markdown"
        )

        new_line_count = len(new_lines)

        return MarkdownEditResponse(
            success=True,
            message=f"Successfully deleted lines {start_line}-{end_line}",
            s3_key=s3_key,
            old_line_count=old_line_count,
            new_line_count=new_line_count,
            lines_changed=new_line_count - old_line_count,
        )

    # ==================== 预览方法 ====================

    def preview_replace(
        self,
        s3_key: str,
        start_line: int,
        end_line: int,
        new_content: str,
    ) -> MarkdownPreviewResponse:
        """预览替换操作"""
        # 读取原文件
        content_bytes = storage_service.download(s3_key)
        content = content_bytes.decode("utf-8")
        lines = content.split("\n")

        old_line_count = len(lines)

        # 验证行号范围
        if start_line < 0 or start_line >= old_line_count:
            return MarkdownPreviewResponse(
                success=False,
                message=f"Invalid start_line: {start_line}",
                s3_key=s3_key,
                diffs=[],
                old_line_count=old_line_count,
                new_line_count=old_line_count,
            )

        if end_line > old_line_count:
            end_line = old_line_count

        # 计算新内容
        before = lines[:start_line]
        after = lines[end_line:]
        new_lines = before + new_content.split("\n") + after
        new_line_count = len(new_lines)

        # 生成 diff
        old_content = "\n".join(lines[start_line:end_line])
        diffs = [
            ContentDiff(
                diff_type="changed",
                old_content=old_content,
                new_content=new_content,
                old_line_start=start_line,
                old_line_end=end_line,
                new_line_start=start_line,
                new_line_end=start_line + len(new_content.split("\n")),
                line_count=new_line_count - old_line_count,
            )
        ]

        return MarkdownPreviewResponse(
            success=True,
            message=f"Preview: will replace lines {start_line}-{end_line}",
            s3_key=s3_key,
            diffs=diffs,
            old_line_count=old_line_count,
            new_line_count=new_line_count,
        )

    def preview_insert(
        self,
        s3_key: str,
        content: str,
        position: str = "end",
        target_line: int | None = None,
    ) -> MarkdownPreviewResponse:
        """预览插入操作"""
        # 读取原文件
        content_bytes = storage_service.download(s3_key)
        original_content = content_bytes.decode("utf-8")
        lines = original_content.split("\n")

        old_line_count = len(lines)
        insert_lines = content.split("\n")
        new_line_count = old_line_count + len(insert_lines)

        # 计算新内容位置
        if position == "start":
            new_line_start = 0
            new_line_end = len(insert_lines)
        elif position == "end":
            new_line_start = old_line_count
            new_line_end = old_line_count + len(insert_lines)
        elif position == "before_line" and target_line is not None:
            new_line_start = target_line
            new_line_end = target_line + len(insert_lines)
        elif position == "after_line" and target_line is not None:
            new_line_start = target_line + 1
            new_line_end = target_line + 1 + len(insert_lines)
        else:
            return MarkdownPreviewResponse(
                success=False,
                message=f"Invalid position: {position}",
                s3_key=s3_key,
                diffs=[],
                old_line_count=old_line_count,
                new_line_count=old_line_count,
            )

        # 生成 diff
        diffs = [
            ContentDiff(
                diff_type="added",
                old_content=None,
                new_content=content,
                old_line_start=None,
                old_line_end=None,
                new_line_start=new_line_start,
                new_line_end=new_line_end,
                line_count=len(insert_lines),
            )
        ]

        return MarkdownPreviewResponse(
            success=True,
            message=f"Preview: will insert {len(insert_lines)} lines at {position}",
            s3_key=s3_key,
            diffs=diffs,
            old_line_count=old_line_count,
            new_line_count=new_line_count,
        )

    def preview_delete(
        self,
        s3_key: str,
        start_line: int,
        end_line: int,
    ) -> MarkdownPreviewResponse:
        """预览删除操作"""
        # 读取原文件
        content_bytes = storage_service.download(s3_key)
        content = content_bytes.decode("utf-8")
        lines = content.split("\n")

        old_line_count = len(lines)

        # 验证行号范围
        if start_line < 0 or start_line >= old_line_count:
            return MarkdownPreviewResponse(
                success=False,
                message=f"Invalid start_line: {start_line}",
                s3_key=s3_key,
                diffs=[],
                old_line_count=old_line_count,
                new_line_count=old_line_count,
            )

        if end_line > old_line_count:
            end_line = old_line_count

        deleted_content = "\n".join(lines[start_line:end_line])
        new_line_count = old_line_count - (end_line - start_line)

        # 生成 diff
        diffs = [
            ContentDiff(
                diff_type="deleted",
                old_content=deleted_content,
                new_content=None,
                old_line_start=start_line,
                old_line_end=end_line,
                new_line_start=None,
                new_line_end=None,
                line_count=-(end_line - start_line),
            )
        ]

        return MarkdownPreviewResponse(
            success=True,
            message=f"Preview: will delete lines {start_line}-{end_line}",
            s3_key=s3_key,
            diffs=diffs,
            old_line_count=old_line_count,
            new_line_count=new_line_count,
        )


# 全局服务实例
markdown_edit_service = MarkdownEditService()
