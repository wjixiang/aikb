# File Renderer API 使用指南

本文档介绍如何使用 File Renderer Service API 进行文件管理操作。

## 目录

- [快速开始](#快速开始)
- [文件管理](#文件管理)
- [文件创建](#文件创建)
- [PDF 处理](#pdf-处理)
- [Markdown 编辑](#markdown-编辑)
- [Docling 文件转换](#docling-文件转换)
- [Editor API](#editor-api)
- [分页查询](#分页查询)
- [错误处理](#错误处理)

## 快速开始

### 基础 URL

```
http://localhost:8000/api/v1
```

### 健康检查

```bash
curl http://localhost:8000/health
```

响应示例：

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "s3_connected": true,
  "database_connected": true,
  "timestamp": "2024-01-15T08:30:00Z"
}
```

## 文件管理

### 上传文件

```bash
curl -X POST \
  http://localhost:8000/api/v1/files/upload \
  -F "file=@/path/to/document.pdf"
```

响应示例：

```json
{
  "file_id": "550e8400-e29b-41d4-a716-446655440000",
  "original_name": "document.pdf",
  "s3_key": "uploads/2024/01/document.pdf",
  "content_type": "application/pdf",
  "file_size": 1024567,
  "status": "pending"
}
```

### 获取文件元数据

```bash
curl http://localhost:8000/api/v1/files/{file_id}
```

### 获取下载链接

```bash
curl "http://localhost:8000/api/v1/files/{file_id}/download?expires_in=3600"
```

### 删除文件

```bash
curl -X DELETE http://localhost:8000/api/v1/files/{file_id}
```

### 列出所有文件

```bash
curl "http://localhost:8000/api/v1/files/?limit=20&offset=0"
```

## 文件创建

### 创建文本文件

```bash
curl -X POST \
  http://localhost:8000/api/v1/text/create \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "notes.txt",
    "fileType": "text"
  }'
```

### 创建 JSON 文件

```bash
curl -X POST \
  http://localhost:8000/api/v1/json/create \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "data.json",
    "fileType": "json"
  }'
```

### 创建 Markdown 文件

```bash
curl -X POST \
  http://localhost:8000/api/v1/markdown/create \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "document.md",
    "fileType": "markdown"
  }'
```

### 创建其他类型文件

支持的文件类型：

- `text` - 纯文本文件
- `json` - JSON 文件
- `markdown` - Markdown 文件
- `html` - HTML 文件
- `xml` - XML 文件
- `csv` - CSV 文件
- `pdf` - PDF 文件
- `binary` - 二进制文件
- `tex` - LaTeX 文件

## PDF 处理

### 创建空 PDF 文件

```bash
curl -X POST \
  http://localhost:8000/api/v1/pdf/create \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "document.pdf",
    "fileType": "pdf"
  }'
```

### 读取 PDF 指定页

```bash
curl -X POST \
  http://localhost:8000/api/v1/pdf/read \
  -H "Content-Type: application/json" \
  -d '{
    "s3_key": "pdf/document.pdf",
    "page": 1
  }'
```

响应示例：

```json
{
  "metadata": {
    "s3_key": "pdf/document.pdf",
    "file_name": "document.pdf",
    "total_pages": 15
  },
  "page": 1,
  "content": "第一章 引言\n\n本文研究了..."
}
```

## Markdown 编辑

### 分页读取 Markdown

```bash
curl -X POST \
  http://localhost:8000/api/v1/markdown/read/bypage \
  -H "Content-Type: application/json" \
  -d '{
    "s3_key": "markdown/document.md",
    "page": 1,
    "page_size": 1000
  }'
```

### 替换内容

```bash
curl -X POST \
  http://localhost:8000/api/v1/markdown/edit/replace \
  -H "Content-Type: application/json" \
  -d '{
    "s3_key": "markdown/document.md",
    "start_line": 10,
    "end_line": 20,
    "new_content": "这是新的内容"
  }'
```

### 插入内容

```bash
curl -X POST \
  http://localhost:8000/api/v1/markdown/edit/insert \
  -H "Content-Type: application/json" \
  -d '{
    "s3_key": "markdown/document.md",
    "content": "插入的内容",
    "position": "after_line",
    "target_line": 10
  }'
```

插入位置选项：

- `start` - 文件开头
- `end` - 文件末尾
- `before_line` - 指定行之前
- `after_line` - 指定行之后

### 删除内容

```bash
curl -X POST \
  http://localhost:8000/api/v1/markdown/edit/delete \
  -H "Content-Type: application/json" \
  -d '{
    "s3_key": "markdown/document.md",
    "start_line": 10,
    "end_line": 20
  }'
```

### 预览编辑效果

所有编辑操作都有对应的预览接口，不会实际修改文件：

- `POST /api/v1/markdown/preview/replace`
- `POST /api/v1/markdown/preview/insert`
- `POST /api/v1/markdown/preview/delete`

## Docling 文件转换

### 转换文件

```bash
curl -X POST \
  http://localhost:8000/api/v1/docling/convert \
  -H "Content-Type: application/json" \
  -d '{
    "s3_key": "uploads/document.pdf",
    "file_type": "pdf",
    "force_refresh": false
  }'
```

### 获取文本内容

```bash
curl -X POST \
  http://localhost:8000/api/v1/docling/text \
  -H "Content-Type: application/json" \
  -d '{
    "s3_key": "uploads/document.pdf"
  }'
```

### 获取指定页内容

```bash
curl -X POST \
  http://localhost:8000/api/v1/docling/page \
  -H "Content-Type: application/json" \
  -d '{
    "s3_key": "uploads/document.pdf",
    "page_number": 1
  }'
```

### 获取转换状态

```bash
curl -X POST \
  http://localhost:8000/api/v1/docling/status \
  -H "Content-Type: application/json" \
  -d '{
    "s3_key": "uploads/document.pdf"
  }'
```

### 获取支持的格式

```bash
curl http://localhost:8000/api/v1/docling/formats
```

## Editor API

Editor API 提供统一的文件操作接口。

### 统一接口

```bash
curl -X POST \
  http://localhost:8000/api/v1/editor \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create",
    "s3_key": "notes/my-note.md",
    "content": "# Hello World",
    "content_type": "text/markdown"
  }'
```

操作类型：

- `create` - 创建文件
- `read` - 读取文件
- `update` - 更新文件
- `delete` - 删除文件
- `move` - 移动/重命名文件
- `copy` - 复制文件
- `exists` - 检查文件是否存在

### 独立接口

#### 创建文件

```bash
curl -X POST \
  http://localhost:8000/api/v1/editor/create \
  -H "Content-Type: application/json" \
  -d '{
    "s3_key": "notes/my-note.md",
    "content": "# Hello World",
    "content_type": "text/markdown"
  }'
```

#### 读取文件

```bash
curl "http://localhost:8000/api/v1/editor/read?s3_key=notes/my-note.md&encoding=utf-8"
```

#### 更新文件

```bash
curl -X POST \
  http://localhost:8000/api/v1/editor/update \
  -H "Content-Type: application/json" \
  -d '{
    "s3_key": "notes/my-note.md",
    "content": "更新的内容",
    "mode": "overwrite",
    "encoding": "utf-8"
  }'
```

更新模式：

- `overwrite` - 覆盖原有内容
- `append` - 追加到末尾
- `prepend` - 插入到开头

#### 删除文件

```bash
curl -X DELETE "http://localhost:8000/api/v1/editor/delete?s3_key=notes/my-note.md"
```

#### 移动文件

```bash
curl -X POST \
  http://localhost:8000/api/v1/editor/move \
  -H "Content-Type: application/json" \
  -d '{
    "s3_key": "notes/old-name.md",
    "new_s3_key": "notes/new-name.md"
  }'
```

#### 复制文件

```bash
curl -X POST \
  http://localhost:8000/api/v1/editor/copy \
  -H "Content-Type: application/json" \
  -d '{
    "s3_key": "notes/source.md",
    "new_s3_key": "notes/backup.md"
  }'
```

#### 检查文件是否存在

```bash
curl "http://localhost:8000/api/v1/editor/exists?s3_key=notes/my-note.md"
```

## 分页查询

### 分页参数

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| page | int | 1 | 页码（从1开始） |
| page_size | int | 20 | 每页数量 |
| offset | int | 0 | 偏移量（从0开始） |
| limit | int | 20 | 返回数量限制 |

### Markdown 文件列表

```bash
curl "http://localhost:8000/api/v1/markdown/list?page=1&page_size=20&prefix=markdown/"
```

## 错误处理

### 错误响应格式

```json
{
  "success": false,
  "message": "错误描述",
  "error_code": "ERROR_CODE",
  "errors": [
    {
      "field": "field_name",
      "message": "字段错误描述",
      "code": "FIELD_ERROR_CODE"
    }
  ],
  "timestamp": "2024-01-15T08:30:00Z"
}
```

### 常见错误代码

| 错误代码 | HTTP 状态码 | 描述 |
|----------|-------------|------|
| VALIDATION_ERROR | 400 | 请求参数验证失败 |
| FILE_TOO_LARGE | 413 | 文件超过大小限制 |
| NOT_FOUND | 404 | 资源不存在 |
| CONFLICT | 409 | 资源冲突（如文件已存在） |
| UNAUTHORIZED | 401 | 未授权 |
| FORBIDDEN | 403 | 禁止访问 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |
| SERVICE_UNAVAILABLE | 503 | 服务不可用 |
| RATE_LIMITED | 429 | 请求过于频繁 |

### 处理错误

```python
import requests

response = requests.post(
    "http://localhost:8000/api/v1/files/upload",
    files={"file": open("document.pdf", "rb")}
)

if response.status_code == 200:
    data = response.json()
    print(f"File uploaded: {data['file_id']}")
elif response.status_code == 413:
    error = response.json()
    print(f"File too large: {error['message']}")
elif response.status_code == 404:
    print("File not found")
else:
    error = response.json()
    print(f"Error: {error['message']} ({error['error_code']})")
```

## SDK 示例

### Python

```python
import requests
from typing import Optional

class FileRendererClient:
    def __init__(self, base_url: str, api_key: Optional[str] = None):
        self.base_url = base_url
        self.headers = {}
        if api_key:
            self.headers["X-API-Key"] = api_key

    def upload_file(self, file_path: str) -> dict:
        with open(file_path, "rb") as f:
            response = requests.post(
                f"{self.base_url}/api/v1/files/upload",
                files={"file": f},
                headers=self.headers
            )
        response.raise_for_status()
        return response.json()

    def create_markdown(self, file_name: str) -> dict:
        response = requests.post(
            f"{self.base_url}/api/v1/markdown/create",
            json={"fileName": file_name, "fileType": "markdown"},
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

    def read_markdown_page(self, s3_key: str, page: int = 1) -> dict:
        response = requests.post(
            f"{self.base_url}/api/v1/markdown/read/bypage",
            json={"s3_key": s3_key, "page": page, "page_size": 1000},
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

# 使用示例
client = FileRendererClient("http://localhost:8000", api_key="your-api-key")

# 上传文件
result = client.upload_file("document.pdf")
print(f"Uploaded: {result['file_id']}")

# 创建 Markdown
result = client.create_markdown("notes.md")
print(f"Created: {result['s3_key']}")

# 读取 Markdown
result = client.read_markdown_page("markdown/notes.md", page=1)
print(f"Content: {result['content']}")
```

### JavaScript/TypeScript

```typescript
class FileRendererClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl;
    this.headers = {};
    if (apiKey) {
      this.headers["X-API-Key"] = apiKey;
    }
  }

  async uploadFile(file: File): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${this.baseUrl}/api/v1/files/upload`, {
      method: "POST",
      headers: this.headers,
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  async createMarkdown(fileName: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/markdown/create`, {
      method: "POST",
      headers: {
        ...this.headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fileName, fileType: "markdown" }),
    });

    if (!response.ok) {
      throw new Error(`Create failed: ${response.statusText}`);
    }

    return response.json();
  }

  async readMarkdownPage(s3Key: string, page: number = 1): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/markdown/read/bypage`,
      {
        method: "POST",
        headers: {
          ...this.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ s3_key: s3Key, page, page_size: 1000 }),
      }
    );

    if (!response.ok) {
      throw new Error(`Read failed: ${response.statusText}`);
    }

    return response.json();
  }
}

// 使用示例
const client = new FileRendererClient("http://localhost:8000", "your-api-key");

// 上传文件
const fileInput = document.getElementById("fileInput") as HTMLInputElement;
if (fileInput.files && fileInput.files[0]) {
  const result = await client.uploadFile(fileInput.files[0]);
  console.log("Uploaded:", result.file_id);
}

// 创建 Markdown
const result = await client.createMarkdown("notes.md");
console.log("Created:", result.s3_key);
```

## 最佳实践

1. **使用分页读取大文件**：对于大文件，使用分页接口避免内存问题
2. **先预览再编辑**：使用预览接口确认修改效果
3. **处理错误**：始终检查响应状态码并处理错误
4. **使用预签名 URL**：下载文件时使用预签名 URL
5. **设置合适的过期时间**：根据使用场景设置下载链接的过期时间
