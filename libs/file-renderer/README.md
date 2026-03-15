# 云端Agent文件读写系统

为agent提供基于S3兼容对象存储的文件云端读写系统，通过docling实现多种文件格式转换为LLM友好的纯文本数据，并进行自动分页。

使用 AWS boto3 SDK，兼容阿里云OSS、MinIO及所有S3兼容存储服务。

## 核心设计理念

**扁平化S3 Key管理**: 文件统一基于S3 Key管理，不具有传统目录概念。
- S3 Key示例: `notes/my-note.md`, `data/report.pdf`, `images/photo.png`
- Key中包含路径分隔符，但实际存储为扁平结构

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Agent                                    │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                    FastAPI Server (file-renderer)               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ FileAPI     │  │ EditorAPI   │  │ RenderAPI               │ │
│  │             │  │             │  │                         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                  Unified CRUD API                          │ │
│  │   POST /editor  (create/read/update/delete/move/copy/exists)│ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                      Core Services                              │
│  ┌──────────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │ StorageService   │  │ DoclingService │  │ PaginationServ  │  │
│  │ (S3/OSS)         │  │ (文件转换)       │  │ (分页)          │  │
│  └──────────────────┘  └────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 功能特性

### 1. 文件存储 (StorageService)
- 基于S3兼容的对象存储（使用AWS boto3 SDK）
- 支持阿里云OSS、MinIO及所有S3兼容存储
- 预签名URL上传/下载
- 支持所有文件类型

### 2. 文件编辑器 (EditorAPI)
统一的CRUD操作接口，支持：
- **Create**: 创建新文件（文本、JSON、Markdown等）
- **Read**: 读取文件内容
- **Update**: 更新文件内容（overwrite/append/prepend）
- **Delete**: 删除文件
- **Move**: 移动/重命名文件
- **Copy**: 复制文件
- **Exists**: 检查文件是否存在

### 3. 文件转换 (DoclingService)
使用docling将以下格式转换为LLM友好的纯文本：
- PDF, DOCX, PPTX, XLSX, CSV
- HTML, Markdown
- 图片 (PNG, JPG等)

### 4. 智能分页 (PaginationService)
- **固定字符数分页**: 默认4000字符/页
- **语义分页**: 按段落/标题分页

## API Endpoints

### File APIs (基于file_id)
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/files/upload` | 上传文件到S3 |
| GET | `/files/{file_id}` | 获取文件元数据 |
| GET | `/files/{file_id}/download` | 获取下载链接 |
| DELETE | `/files/{file_id}` | 删除文件 |

### Editor APIs (基于S3 Key，扁平化管理)
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/editor/create` | 创建文件 |
| GET | `/editor/read` | 读取文件 |
| POST | `/editor/update` | 更新文件 |
| DELETE | `/editor/delete` | 删除文件 |
| POST | `/editor/move` | 移动/重命名 |
| POST | `/editor/copy` | 复制文件 |
| GET | `/editor/exists` | 检查是否存在 |
| POST | `/editor` | 统一CRUD接口 |

### Render APIs
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/files/{file_id}/render` | 触发转换 |
| GET | `/files/{file_id}/text` | 获取转换文本 |

### Pagination APIs
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/files/{file_id}/pages` | 页面列表 |
| GET | `/files/{file_id}/pages/{n}` | 指定页面 |

## Editor API 详细说明

### 统一CRUD接口

**POST /editor** - 统一的文件编辑接口

```json
// 创建文件
{
  "action": "create",
  "s3_key": "notes/my-note.md",
  "content": "# Hello World\n\nThis is my note.",
  "content_type": "text/markdown"
}

// 读取文件
{
  "action": "read",
  "s3_key": "notes/my-note.md",
  "encoding": "utf-8"
}

// 更新文件 (覆盖)
{
  "action": "update",
  "s3_key": "notes/my-note.md",
  "content": "New content",
  "mode": "overwrite"
}

// 更新文件 (追加)
{
  "action": "update",
  "s3_key": "notes/my-note.md",
  "content": "\nAppended content",
  "mode": "append"
}

// 删除文件
{
  "action": "delete",
  "s3_key": "notes/my-note.md"
}

// 移动/重命名
{
  "action": "move",
  "s3_key": "notes/old-name.md",
  "new_s3_key": "notes/new-name.md"
}

// 复制文件
{
  "action": "copy",
  "s3_key": "notes/source.md",
  "new_s3_key": "notes/destination.md"
}

// 检查存在
{
  "action": "exists",
  "s3_key": "notes/my-note.md"
}
```

**响应格式:**
```json
{
  "success": true,
  "message": "File created successfully",
  "action": "create",
  "s3_key": "notes/my-note.md",
  "content_type": "text/markdown",
  "file_size": 1024
}
```

### 独立操作接口

```bash
# 创建文件
curl -X POST http://localhost:8000/editor/create \
  -H "Content-Type: application/json" \
  -d '{"s3_key": "notes/test.md", "content": "Hello", "content_type": "text/plain"}'

# 读取文件
curl "http://localhost:8000/editor/read?s3_key=notes/test.md"

# 更新文件
curl -X POST http://localhost:8000/editor/update \
  -H "Content-Type: application/json" \
  -d '{"s3_key": "notes/test.md", "content": "New content", "mode": "overwrite"}'

# 删除文件
curl -X DELETE "http://localhost:8000/editor/delete?s3_key=notes/test.md"

# 移动文件
curl -X POST http://localhost:8000/editor/move \
  -H "Content-Type: application/json" \
  -d '{"s3_key": "notes/old.md", "new_s3_key": "notes/new.md"}'

# 复制文件
curl -X POST http://localhost:8000/editor/copy \
  -H "Content-Type: application/json" \
  -d '{"s3_key": "notes/source.md", "new_s3_key": "notes/dest.md"}'

# 检查存在
curl "http://localhost:8000/editor/exists?s3_key=notes/test.md"
```

## Agent Tools 定义

```json
{
  "toolName": "file_editor",
  "params": {
    "action": "create|read|update|delete|move|copy|exists",
    "s3_key": "string",
    "content": "string (optional)",
    "content_type": "string (optional)",
    "mode": "overwrite|append|prepend (optional)",
    "new_s3_key": "string (optional)",
    "encoding": "string (optional)"
  },
  "desc": "统一的文件编辑工具，支持S3兼容存储的CRUD操作"
}
```

## Configuration

环境变量配置：
```bash
# S3/OSS配置
S3_ENDPOINT=localhost:9000
S3_ACCESS_KEY_ID=admin
S3_ACCESS_KEY_SECRET=your_secret
S3_BUCKET=agentfs
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true

# 分页配置
DEFAULT_PAGE_SIZE=4000

# 转换配置
MAX_FILE_SIZE=104857600
CONVERSION_TIMEOUT=300

# 服务器配置
SERVER_HOST=0.0.0.0
SERVER_PORT=8000
```

## Development

```bash
# 安装依赖
cd libs/file-renderer
uv sync

# 启动服务
uv run python -m uvicorn main:app --reload

# 测试Editor API
curl -X POST http://localhost:8000/editor \
  -H "Content-Type: application/json" \
  -d '{"action": "create", "s3_key": "test.md", "content": "Hello World"}'
```

## 项目依赖

- **docling**: 文件格式转换
- **fastapi**: Web框架
- **pydantic**: 数据验证
- **boto3**: AWS S3 SDK (兼容阿里云OSS/MinIO等)
