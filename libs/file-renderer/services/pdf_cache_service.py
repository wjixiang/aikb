"""
PDF Cache Service - PDF 解析结果缓存服务
"""

from typing import Optional

from sqlalchemy.orm import Session

from models.database import PdfParseResult, SessionLocal


class PdfCacheService:
    """PDF 解析结果缓存服务"""

    def __init__(self):
        self._db: Optional[Session] = None

    @property
    def db(self) -> Session:
        """获取数据库会话"""
        if self._db is None:
            self._db = SessionLocal()
        return self._db

    def close(self):
        """关闭数据库会话"""
        if self._db is not None:
            self._db.close()
            self._db = None

    def get_doc(
        self, s3_key: str, file_size: int, modified_time: int
    ) -> Optional[dict]:
        """
        获取文档缓存，如果文件已更新则返回 None

        Args:
            s3_key: S3 存储路径
            file_size: 文件大小
            modified_time: 文件修改时间戳

        Returns:
            缓存数据或 None
        """
        result = (
            self.db.query(PdfParseResult)
            .filter(PdfParseResult.s3_key == s3_key)
            .first()
        )

        if result is None:
            return None

        # 校验文件是否发生变化
        if result.file_size != file_size or result.modified_time != modified_time:
            # 文件已更新，删除旧缓存
            self.db.delete(result)
            self.db.commit()
            return None

        return {
            "file_name": result.file_name,
            "total_page": result.total_page,
            "pages": result.pages,
        }

    def set_doc(
        self,
        s3_key: str,
        file_name: str,
        file_size: int,
        modified_time: int,
        total_page: int,
        pages: dict,
    ) -> None:
        """
        设置文档缓存

        Args:
            s3_key: S3 存储路径
            file_name: 文件名
            file_size: 文件大小
            modified_time: 文件修改时间戳
            total_page: 总页数
            pages: 所有页面内容
        """
        # 检查是否已存在
        existing = (
            self.db.query(PdfParseResult)
            .filter(PdfParseResult.s3_key == s3_key)
            .first()
        )

        if existing is not None:
            # 更新
            existing.file_name = file_name
            existing.file_size = file_size
            existing.modified_time = modified_time
            existing.total_page = total_page
            existing.pages = pages
        else:
            # 创建
            new_result = PdfParseResult(
                s3_key=s3_key,
                file_name=file_name,
                file_size=file_size,
                modified_time=modified_time,
                total_page=total_page,
                pages=pages,
            )
            self.db.add(new_result)

        self.db.commit()

    def invalidate(self, s3_key: str) -> None:
        """
        删除文档缓存

        Args:
            s3_key: S3 存储路径
        """
        result = (
            self.db.query(PdfParseResult)
            .filter(PdfParseResult.s3_key == s3_key)
            .first()
        )

        if result is not None:
            self.db.delete(result)
            self.db.commit()


# 全局缓存服务实例
pdf_cache_service = PdfCacheService()
