# Markdown Agent 编辑实现计划

## 当前进度

- ✅ P0: 基础读取（分页读取）
- ✅ 响应模型（MarkdownEditResponse, ContentDiff, MarkdownPreviewResponse）

---

## 下一步实现计划

### Phase 1: 基础编辑功能 (P0)

#### 1.1 编辑请求 Model

```python
# models/markdown_edit.py (新建)
class MarkdownEditRequest(BaseModel):
    s3_key: str
    operation: str  # replace, insert, delete
    # 替换/删除用
    start_line: int | None = None
    end_line: int | None = None
    # 替换/插入用
    new_content: str | None = None
    # 插入用
    position: str | None = None  # before, after
    # 模糊匹配用
    match_content: str | None = None
```

#### 1.2 MarkdownEditService

```python
# services/markdown_edit_service.py (新建)

class MarkdownEditService:
    def replace(s3_key, start_line, end_line, new_content) -> MarkdownEditResponse
    def insert(s3_key, position, target_line, content) -> MarkdownEditResponse
    def delete(s3_key, start_line, end_line) -> MarkdownEditResponse
    def replace_matched(s3_key, match_content, new_content) -> MarkdownEditResponse
```

#### 1.3 Router 接口

```
POST /markdown/edit
```

---

### Phase 2: 差异预览功能 (P1)

#### 2.1 预览请求 Model

```python
# 复用 MarkdownEditRequest
class MarkdownPreviewRequest(MarkdownEditRequest):
    pass
```

#### 2.2 MarkdownPreviewService

```python
# services/markdown_preview_service.py (新建)
# 或合并到 MarkdownEditService

class MarkdownEditService:
    def preview(request) -> MarkdownPreviewResponse
        # 计算 diff 但不写入
```

#### 2.3 Router 接口

```
POST /markdown/preview
```

---

### Phase 3: 按章节读取 (P1)

#### 3.1 MarkdownIndexService

```python
class MarkdownIndexService:
    def build_index(content: str) -> MarkdownIndex
        # 解析 # 标题，建立章节映射

    def get_section(index, title: str) -> Section
        # 按标题获取章节
```

#### 3.2 Router 接口

```
POST /markdown/read/by-section
```

---

## 实现顺序

| 步骤 | 功能 | 文件 |
|------|------|------|
| 1 | 编辑请求 Model | `models/markdown_edit.py` |
| 2 | 替换编辑 Service + Router | `services/markdown_edit_service.py`, `routers/markdown.py` |
| 3 | 插入/删除编辑 | 扩展 `markdown_edit_service.py` |
| 4 | 预览功能 | 扩展 Service + Router |
| 5 | 章节索引（可选） | `services/markdown_index_service.py` |

---

## 待确认

1. **编辑操作先实现哪些？** 建议：replace → insert → delete
2. **是否需要实现模糊匹配 replace_matched？**
3. **预览是否单独接口，还是与编辑合并（confirm 参数）？**
