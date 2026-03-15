# PDF 解析缓存机制设计

## 概述

为 PDF 解析服务添加 PostgreSQL 缓存机制，缓存解析后的完整 PDF 数据（包含所有页面内容），实现永久存储。

## 缓存策略

### 1. 数据库设计

```sql
-- PDF 解析结果表
CREATE TABLE pdf_parse_results (
    id SERIAL PRIMARY KEY,
    s3_key VARCHAR(512) NOT NULL UNIQUE,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    modified_time BIGINT NOT NULL,
    total_page INTEGER NOT NULL,
    pages JSONB NOT NULL,  -- {"1": "content1", "2": "content2", ...}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_pdf_parse_results_s3_key ON pdf_parse_results(s3_key);
CREATE INDEX idx_pdf_parse_results_updated_at ON pdf_parse_results(updated_at);
```

### 2. 缓存键设计

| 缓存类型 | 键格式 | 说明 |
|---------|--------|------|
| 文档缓存 | s3_key (主键) | 完整的 PDF 解析结果（包含所有页面） |

### 3. 缓存更新机制

- **主动失效**：当 PDF 文件在 OSS 中被更新时，通过文件大小 + 修改时间判断
- **无过期**：永久存储，除非手动删除或重新解析

## 数据结构

### 完整文档缓存

| 字段 | 类型 | 说明 |
|-----|------|------|
| s3_key | VARCHAR(512) | S3 存储路径（主键） |
| file_name | VARCHAR(255) | 文件名 |
| file_size | BIGINT | 文件大小（字节） |
| modified_time | BIGINT | 文件修改时间戳 |
| total_page | INTEGER | 总页数 |
| pages | JSONB | 所有页面内容 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### pages 字段示例

```json
{
  "1": "## JAMASurgery | Review\n\n## Diagnosis...",
  "2": "Table 1. ...",
  "3": "..."
}
```

## 实现方案

### 1. 新增配置

在 `.env` 中添加：
```bash
# 数据库配置（复用项目现有配置）
DATABASE_URL=postgresql://user:password@localhost:5432/filerenderer
```

### 2. 新增缓存服务

```python
# services/pdf_cache_service.py
from sqlalchemy import Column, Integer, String, BigInteger, DateTime, JSON
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB

class PdfParseResult(Base):
    __tablename__ = "pdf_parse_results"

    id = Column(Integer, primary_key=True)
    s3_key = Column(String(512), unique=True, nullable=False)
    file_name = Column(String(255), nullable=False)
    file_size = Column(BigInteger, nullable=False)
    modified_time = Column(BigInteger, nullable=False)
    total_page = Column(Integer, nullable=False)
    pages = Column(JSONB, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class PdfCacheService:
    """PDF 解析结果缓存服务"""

    def get_doc(self, s3_key: str, file_size: int, modified_time: int) -> dict | None
    """获取文档缓存，如果文件已更新则返回 None"""

    def set_doc(self, s3_key: str, data: dict) -> None
    """设置文档缓存"""

    def invalidate(self, s3_key: str) -> None
    """删除文档缓存"""

    def get_or_parse(self, s3_key: str, parser_func: callable) -> dict
    """获取缓存或执行解析"""
```

### 3. 修改 PDF 服务

```python
class PdfService:
    def __init__(self):
        self._converter: Optional[DocumentConverter] = None
        self._cache = PdfCacheService()

    def read_pdf(self, s3_key: str, page: int = 1) -> PdfReadResponse:
        # 1. 获取文件信息
        file_size = storage_service.get_file_size(s3_key)
        modified_time = storage_service.get_modified_time(s3_key)

        # 2. 尝试从缓存获取完整文档
        cached_doc = self._cache.get_doc(s3_key, file_size, modified_time)

        if cached_doc:
            # 使用缓存
            total_pages = cached_doc["total_page"]
            if page < 1 or page > total_pages:
                raise ValueError(f"Invalid page number: {page}. Total pages: {total_pages}")

            content = cached_doc["pages"][str(page)]
            return PdfReadResponse(...)

        # 3. 解析 PDF（完整解析所有页面）
        result = self.converter.convert(...)
        doc = result.document
        total_pages = doc.num_pages()

        # 4. 提取所有页面内容
        pages = {}
        for i in range(1, total_pages + 1):
            pages[str(i)] = doc.export_to_markdown(page_no=i)

        # 5. 存入缓存
        cache_data = {
            "file_name": file_name,
            "file_size": file_size,
            "modified_time": modified_time,
            "total_page": total_pages,
            "pages": pages,
        }
        self._cache.set_doc(s3_key, cache_data)

        # 6. 返回指定页
        content = pages[str(page)]
        return PdfReadResponse(...)
```

### 4. 新增 Storage Service 方法

```python
class StorageService:
    def get_file_size(self, key: str) -> int:
        """获取文件大小"""
        response = self.client.head_object(
            Bucket=settings.s3.bucket,
            Key=key,
        )
        return response["ContentLength"]

    def get_modified_time(self, key: str) -> int:
        """获取文件修改时间戳"""
        response = self.client.head_object(
            Bucket=settings.s3.bucket,
            Key=key,
        )
        # 转换为时间戳
        return int(response["LastModified"].timestamp())
```

## 流程图

```
请求到来
    │
    ▼
┌─────────────────────────────────┐
│  获取文件大小和修改时间          │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  查询数据库缓存                 │
│  (带文件变化校验)               │
└─────────────────────────────────┘
    │
    ├─ 命中 ──────► 获取指定页 → 返回
    │
    ▼ 未命中
┌─────────────────────────────────┐
│  下载 PDF                       │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  解析 PDF（完整解析所有页面）    │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  提取所有页面内容               │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  存入数据库缓存                 │
└─────────────────────────────────┘
    │
    ▼
  返回指定页内容
```

## 缓存校验逻辑

```python
def get_doc(self, s3_key: str, file_size: int, modified_time: int) -> dict | None:
    """获取文档缓存，如果文件已更新则返回 None"""
    result = self.db.query(PdfParseResult).filter(
        PdfParseResult.s3_key == s3_key
    ).first()

    if not result:
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
```

## 注意事项

1. **首次解析慢**：首次解析需要处理所有页面，耗时较长，后续请求会很快
2. **缓存更新**：文件变化时自动更新缓存
3. **手动刷新**：可提供 API 手动清除缓存强制重新解析

## 配置参数

| 参数 | 默认值 | 说明 |
|-----|-------|------|
| `DATABASE_URL` | - | PostgreSQL 连接字符串 |

## API 扩展（可选）

```python
@router.delete("/pdf/cache/{s3_key}")
async def invalidate_pdf_cache(s3_key: str):
    """删除指定 PDF 的缓存"""
    cache_service.invalidate(s3_key)
    return {"message": "Cache invalidated"}
```
