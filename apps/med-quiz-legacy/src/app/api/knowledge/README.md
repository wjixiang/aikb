# Knowledge Base Text Data API

这套API提供了完整的文本数据检索功能，基于knowledgeBase服务实现。

## API端点

### 1. 获取单个文档

**GET** `/api/knowledge/text`

**参数:**

- `key` (string): 文档键名（文件路径）
- `id` (string): 文档ID（MongoDB ObjectId）
- `collection` (string, 可选): 集合名称，默认为'notes'

**示例:**

```bash
GET /api/knowledge/text?key=README.md
GET /api/knowledge/text?id=507f1f77bcf86cd799439011
```

**响应:**

```json
{
  "id": "507f1f77bcf86cd799439011",
  "key": "README.md",
  "title": "README",
  "content": "# 文档内容...",
  "lastModified": "2024-01-15T10:30:00.000Z",
  "metadata": {
    "size": 1024,
    "contentType": "text/markdown",
    "tags": ["documentation", "guide"]
  }
}
```

### 2. 搜索文档

**GET** `/api/knowledge/search`

**参数:**

- `query` (string): 搜索关键词
- `limit` (number): 返回结果数量限制，默认50
- `offset` (number): 偏移量，默认0
- `collection` (string, 可选): 集合名称，默认为'notes'
- `tags` (string): 标签列表，逗号分隔
- `sortBy` (string): 排序字段，可选值：'lastModified' | 'title' | 'key'
- `sortOrder` (string): 排序顺序，可选值：'asc' | 'desc'

**示例:**

```bash
GET /api/knowledge/search?query=react&limit=10&tags=guide,tutorial
```

**响应:**

```json
{
  "documents": [
    {
      "id": "507f1f77bcf86cd799439011",
      "key": "react-guide.md",
      "title": "React Guide",
      "content": "# React 指南...",
      "lastModified": "2024-01-15T10:30:00.000Z",
      "metadata": {}
    }
  ],
  "total": 25,
  "hasMore": true
}
```

### 3. 获取文档列表

**GET** `/api/knowledge/list`

**参数:**

- `collection` (string, 可选): 集合名称，默认为'notes'
- `limit` (number): 限制返回数量，默认100（0表示不限制）

**示例:**

```bash
GET /api/knowledge/list?limit=20
```

**响应:**

```json
{
  "documents": [
    {
      "id": "507f1f77bcf86cd799439011",
      "key": "README.md",
      "title": "README",
      "content": "# 文档内容...",
      "lastModified": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### 4. 获取统计信息

**GET** `/api/knowledge/stats`

**参数:**

- `collection` (string, 可选): 集合名称，默认为'notes'

**示例:**

```bash
GET /api/knowledge/stats
```

**响应:**

```json
{
  "totalDocuments": 150,
  "totalSize": 524288,
  "lastSync": "2024-01-15T10:30:00.000Z",
  "tags": ["documentation", "guide", "tutorial", "reference"]
}
```

## 使用方法

### 在组件中使用

```typescript
// 获取单个文档
const fetchDocument = async (key: string) => {
  const response = await fetch(
    `/api/knowledge/text?key=${encodeURIComponent(key)}`,
  );
  const document = await response.json();
  return document;
};

// 搜索文档
const searchDocuments = async (query: string) => {
  const response = await fetch(
    `/api/knowledge/search?query=${encodeURIComponent(query)}&limit=10`,
  );
  const result = await response.json();
  return result;
};

// 获取文档列表
const listDocuments = async () => {
  const response = await fetch("/api/knowledge/list");
  const data = await response.json();
  return data.documents;
};
```

### 错误处理

所有API端点都返回标准的HTTP状态码：

- `200 OK`: 请求成功
- `400 Bad Request`: 参数错误
- `404 Not Found`: 文档未找到
- `500 Internal Server Error`: 服务器错误

错误响应格式：

```json
{
  "message": "错误描述"
}
```

## 集成示例

### 与WorkSpace组件集成

```typescript
// 更新Leaf组件使用新的API
const fetchDocument = useCallback(async (path: string) => {
  const response = await fetch(
    `/api/knowledge/text?key=${encodeURIComponent(path)}`,
  );
  if (!response.ok) throw new Error("Failed to fetch document");
  return response.json();
}, []);
```

### 搜索功能集成

```typescript
const searchAndOpenDocuments = async (query: string) => {
  const response = await fetch(
    `/api/knowledge/search?query=${encodeURIComponent(query)}`,
  );
  const { documents } = await response.json();

  // 打开第一个匹配的文档
  if (documents.length > 0) {
    openDocument(documents[0].key);
  }
};
```

## 性能优化

- 所有API端点都支持缓存
- 搜索功能使用MongoDB索引优化
- 支持分页查询减少数据传输
- 支持按标签过滤提高查询效率

## 扩展性

API设计支持多个集合：

- `notes`: 默认笔记集合
- `docs`: 文档集合
- `articles`: 文章集合
- 自定义集合名称

通过collection参数可以灵活切换不同的数据集合。
