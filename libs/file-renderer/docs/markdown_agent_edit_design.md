# Markdown Agent 编辑 API 设计方案

## 1. 核心挑战分析

| 挑战 | 描述 |
|------|------|
| **超长文本** | Markdown 文件可能上百页，无法一次性加载到 LLM 上下文 |
| **精确定位** | Agent 需要定位到具体章节/段落进行编辑 |
| **编辑粒度** | 支持多种编辑操作（替换、插入、删除、移动） |
| **版本管理** | 编辑可回滚，需维护历史版本 |
| **变更预览** | 编辑前预览 diff，避免错误修改 |

---

## 2. 核心 API 设计

### 2.1 读取接口（分块读取）

```
# 按行范围读取
GET /markdown/read?start_line=0&end_line=100

# 按章节读取（需要先建立索引）
GET /markdown/read?section=title

# 分页读取
GET /markdown/read?page=1&page_size=5000
```

### 2.2 编辑接口

```json
// 精确行号替换
POST /markdown/edit
{
    "s3_key": "...",
    "operation": "replace",
    "start_line": 10,
    "end_line": 20,
    "new_content": "..."
}

// 模糊匹配替换
POST /markdown/edit
{
    "s3_key": "...",
    "operation": "replace_matched",
    "match_content": "原内容...",
    "new_content": "新内容..."
}

// 插入
POST /markdown/edit
{
    "s3_key": "...",
    "operation": "insert",
    "position": "after_line",
    "target": "50",
    "content": "..."
}
```

### 2.3 版本管理

```json
// 保存版本
POST /markdown/version
{
    "s3_key": "...",
    "message": "添加实验结果"
}

// 回滚
POST /markdown/rollback
{
    "s3_key": "...",
    "version_id": "..."
}
```

### 2.4 差异预览

```json
// 预览变更
POST /markdown/preview
{
    "s3_key": "...",
    "operation": "replace",
    "start_line": 10,
    "end_line": 20,
    "new_content": "..."
}
// 返回 unified diff 格式
```

---

## 3. 底层实现架构

```
┌─────────────────────────────────────────────────────┐
│                   Markdown Router                    │
└─────────────────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ read_service│  │edit_service │  │version_service│
└─────────────┘  └─────────────┘  └─────────────┘
         │               │               │
         └───────────────┼───────────────┘
                         ▼
              ┌─────────────────────┐
              │   Storage Service   │
              │   (S3)              │
              └─────────────────────┘
```

### 3.1 核心服务设计

| 服务 | 职责 |
|------|------|
| **MarkdownIndexService** | 解析 Markdown 结构，建立章节索引 |
| **MarkdownReadService** | 分块读取，支持多种分块模式 |
| **MarkdownEditService** | 执行编辑操作，生成 diff |
| **VersionService** | 版本快照管理、回滚 |

---

## 4. 关键技术点

### 4.1 Markdown 索引结构

```python
class MarkdownIndex:
    sections: list[Section]  # 章节列表
    toc: TableOfContents    # 目录

class Section:
    title: str
    start_line: int
    end_line: int
    level: int  # 标题级别 1-6
```

### 4.2 分块策略

- **按行分块**：固定行数，适合结构化文档
- **按章节分块**：以标题为边界，保持语义完整
- **按 Token 分块**：控制 LLM 上下文长度

### 4.3 编辑事务

1. 读取 → 编辑 → 预览 → 确认 → 写入
2. 写入前先下载完整内容（内存允许情况下）
3. 大文件使用流式处理

---

## 5. 待确认问题

1. **文件大小上限**：超出内存的大文件如何处理？（流式编辑？）
2. **并发编辑**：是否需要锁机制？
3. **版本存储**：版本历史存储在哪里？（S3 + 数据库？）
4. **Agent 交互模式**：是否需要为 Agent 设计更高级的抽象？

---

## 6. 实现优先级

| 优先级 | 功能 | 说明 |
|--------|------|------|
| P0 | 基础读取 | 按行范围读取、分页读取 |
| P0 | 基础编辑 | 替换、插入、删除 |
| P1 | 差异预览 | 编辑前预览 diff |
| P1 | 章节索引 | 解析 Markdown 标题结构 |
| P2 | 版本管理 | 快照保存与回滚 |
| P2 | 并发控制 | 文件锁机制 |
