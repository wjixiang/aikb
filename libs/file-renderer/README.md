# File Renderer Service

云端Agent文件读写系统 - 为AI Agent提供基于S3兼容对象存储的文件云端读写服务，支持多种文件格式转换为LLM友好的纯文本数据。

[![Python 3.13+](https://img.shields.io/badge/python-3.13+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.135+-green.svg)](https://fastapi.tiangolo.com/)
[![Code style: black](https://img.shields.io/badge/code%20style-black-000000.svg)](https://github.com/psf/black)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 目录

- [项目概述](#项目概述)
- [功能特性](#功能特性)
- [架构设计](#架构设计)
- [快速开始](#快速开始)
- [API概览](#api概览)
- [环境变量](#环境变量)
- [开发指南](#开发指南)
- [部署指南](#部署指南)
- [数据库迁移](#数据库迁移)
- [监控与日志](#监控与日志)

## 项目概述

File Renderer Service 是一个专为AI Agent设计的文件处理服务，提供以下核心能力：

- **文件存储与管理**: 基于S3兼容对象存储（阿里云OSS、Garage、AWS S3等）
- **多格式文件创建**: 支持Text、JSON、Markdown、HTML、XML、CSV、PDF、TeX、Binary等格式
- **文件格式转换**: 使用Docling将PDF/DOCX/PPTX/XLSX等格式转换为LLM友好的Markdown文本
- **智能分页**: 支持固定字符数分页和语义分页，便于大文件处理
- **Markdown编辑**: 支持行级编辑、预览、追加/覆盖等操作

### 核心设计理念

**扁平化S3 Key管理**: 文件统一基于S3 Key管理，不具有传统目录概念。
- S3 Key示例: `notes/my-note.md`, `data/report.pdf`, `images/photo.png`
- Key中包含路径分隔符，但实际存储为扁平结构

## 功能特性

### 1. 文件管理 (File API)
- 文件上传到S3存储
- 获取文件元数据和预签名下载链接
- 文件删除和软删除
- 文件版本管理

### 2. 文件编辑器 (Editor API)
统一的CRUD操作接口，支持：
- **Create**: 创建新文件（文本、JSON、Markdown等）
- **Read**: 读取文件内容，支持分页
- **Update**: 更新文件内容（overwrite/append/prepend）
- **Delete**: 删除文件
- **Move**: 移动/重命名文件
- **Copy**: 复制文件
- **Exists**: 检查文件是否存在

### 3. 文件格式转换 (DoclingService)
使用Docling将以下格式转换为LLM友好的纯文本：
- **文档**: PDF, DOCX, PPTX, XLSX
- **数据**: CSV, HTML, Markdown
- **图片**: PNG, JPG, TIFF等（OCR识别）

### 4. 智能分页 (PaginationService)
- **固定字符数分页**: 默认4000字符/页，可配置
- **语义分页**: 按段落/标题智能分页，保持内容完整性

### 5. 专用文件类型API
- **Markdown**: 分页读取、行级编辑、预览
- **PDF**: 解析、分页读取、缓存
- **JSON**: 结构化数据管理
- **CSV**: 表格数据管理
- **Text/HTML/XML/TeX/Binary**: 各类文件支持

## 架构设计

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Agent / Client                              │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ HTTP/REST
┌──────────────────────────────▼──────────────────────────────────────────┐
│                     FastAPI Server (file-renderer)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  File API   │  │ Editor API  │  │ Render API  │  │  Docling API    │ │
│  │  /files     │  │  /editor    │  │  /pdf, /md  │  │  /docling       │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                    Middleware Layer                                  ││
│  │  Logging │ Security │ CORS │ Rate Limit │ Performance Monitor      ││
│  └─────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│                         Core Services                                    │
│  ┌──────────────────┐  ┌────────────────┐  ┌─────────────────────────┐  │
│  │  StorageService  │  │ DoclingService │  │   PaginationService     │  │
│  │  (S3/OSS/Garage)  │  │ (File Convert) │  │   (Smart Pagination)    │  │
│  └──────────────────┘  └────────────────┘  └─────────────────────────┘  │
│  ┌──────────────────┐  ┌────────────────┐  ┌─────────────────────────┐  │
│  │ MarkdownService  │  │  PDFService    │  │   FileRepository        │  │
│  │ (Edit/Preview)   │  │ (Parse/Cache)  │  │   (Metadata)            │  │
│  └──────────────────┘  └────────────────┘  └─────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│                         Data Layer                                       │
│  ┌──────────────────┐  ┌────────────────┐  ┌─────────────────────────┐  │
│  │   S3/OSS/Garage   │  │  PostgreSQL    │  │      (Cache)            │  │
│  │  (Object Store)  │  │   (Metadata)   │  │   (Parse Results)       │  │
│  └──────────────────┘  └────────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 技术栈

- **Web框架**: FastAPI 0.135+
- **Python版本**: 3.13+
- **数据库**: PostgreSQL 14+ (SQLAlchemy 2.0 + asyncpg)
- **对象存储**: S3兼容 (boto3)
- **文档转换**: Docling 2.80+
- **数据验证**: Pydantic 2.12+
- **迁移工具**: Alembic
- **包管理**: uv

## 快速开始

### 环境要求

- Python 3.13+
- PostgreSQL 14+
- S3兼容对象存储 (Garage/阿里云OSS/AWS S3)
- uv (Python包管理器)

### 安装步骤

1. **克隆项目**
```bash
cd libs/file-renderer
```

2. **安装依赖**
```bash
# 使用uv安装依赖
uv sync

# 或者使用pip
pip install -e .
```

3. **配置环境变量**
```bash
cp .env.example .env
# 编辑.env文件，配置数据库和S3连接信息
```

4. **初始化数据库**
```bash
# 创建数据库迁移
uv run alembic upgrade head

# 或者使用脚本
./scripts/migrate.sh
```

5. **启动服务**
```bash
# 开发模式（热重载）
uv run python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 生产模式
./scripts/start.sh
```

6. **验证服务**
```bash
# 访问API文档
curl http://localhost:8000/
curl http://localhost:8000/health

# 浏览器打开
open http://localhost:8000/docs
```

### Docker快速启动

```bash
# 使用docker-compose启动完整环境
docker-compose up -d

# 服务将在 http://localhost:8000 启动
```

## API概览

### 核心API端点

#### 1. 文件管理 API (`/api/v1/files`)

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/files/upload` | 上传文件到S3 |
| GET | `/files/{file_id}` | 获取文件元数据 |
| GET | `/files/{file_id}/download` | 获取预签名下载链接 |
| DELETE | `/files/{file_id}` | 删除文件 |

#### 2. 编辑器 API (`/api/v1/editor`)

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/editor` | 统一CRUD接口 |
| POST | `/editor/create` | 创建文件 |
| GET | `/editor/read` | 读取文件 |
| POST | `/editor/update` | 更新文件 |
| DELETE | `/editor/delete` | 删除文件 |
| POST | `/editor/move` | 移动/重命名 |
| POST | `/editor/copy` | 复制文件 |
| GET | `/editor/exists` | 检查存在 |

#### 3. Docling 转换 API (`/api/v1/docling`)

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/docling/convert` | 转换单个文件 |
| POST | `/docling/convert/batch` | 批量转换 |
| GET | `/docling/formats` | 获取支持的格式 |
| GET | `/docling/task/{task_id}` | 查询任务状态 |
| GET | `/docling/page` | 分页读取转换结果 |

#### 4. Markdown API (`/api/v1/markdown`)

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/markdown` | 创建Markdown文件 |
| GET | `/markdown/read` | 读取Markdown |
| POST | `/markdown/read/bypage` | 分页读取 |
| POST | `/markdown/edit` | 行级编辑 |
| POST | `/markdown/edit/preview` | 编辑预览 |
| POST | `/markdown/append` | 追加内容 |

#### 5. PDF API (`/api/v1/pdf`)

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/pdf` | 创建PDF |
| POST | `/pdf/read` | 读取PDF内容 |
| GET | `/pdf/read/{file_id}/page/{page_num}` | 读取指定页 |

#### 6. 健康检查

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/` | 服务根端点 |
| GET | `/health` | 健康检查 |
| GET | `/health/db` | 数据库连接检查 |
| GET | `/health/s3` | S3连接检查 |

### 统一CRUD接口示例

**POST /api/v1/editor** - 统一的文件编辑接口

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

### API文档

启动服务后访问：
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI Schema**: http://localhost:8000/openapi.json

## 环境变量

### 必需配置

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL连接字符串 | `postgresql://user:pass@localhost:5432/filerenderer` |
| `S3_ENDPOINT` | S3服务端点 | `oss-cn-hangzhou.aliyuncs.com` |
| `S3_ACCESS_KEY_ID` | S3访问密钥ID | `your-access-key` |
| `S3_ACCESS_KEY_SECRET` | S3访问密钥Secret | `your-secret-key` |
| `S3_BUCKET` | S3存储桶名称 | `my-bucket` |
| `S3_REGION` | S3区域 | `cn-hangzhou` |

### 可选配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `S3_FORCE_PATH_STYLE` | 是否使用path-style (Garage需要true) | `false` |
| `SERVER_HOST` | 服务监听地址 | `0.0.0.0` |
| `SERVER_PORT` | 服务监听端口 | `8000` |
| `SERVER_LOG_LEVEL` | 日志级别 | `INFO` |
| `DEFAULT_PAGE_SIZE` | 默认分页大小(字符数) | `4000` |
| `SEMANTIC_CHUNK_SIZE` | 语义分块大小 | `2000` |
| `CONVERSION_MAX_FILE_SIZE` | 最大文件大小(字节) | `104857600` (100MB) |
| `CONVERSION_TIMEOUT` | 转换超时(秒) | `300` |
| `CONVERSION_ENABLE_OCR` | 是否启用OCR | `true` |
| `CONVERSION_MAX_WORKERS` | 并发转换工作线程数 | `4` |
| `DEBUG` | 调试模式 | `false` |

### 配置示例

```bash
# .env 文件示例

# 数据库配置
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/filerenderer

# S3/OSS配置 (阿里云)
S3_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
S3_ACCESS_KEY_ID=LTAIxxxxxxxxxxxx
S3_ACCESS_KEY_SECRET=your-secret-key
S3_BUCKET=agent-files
S3_REGION=cn-hangzhou
S3_FORCE_PATH_STYLE=false

# S3配置 (Garage)
# S3_ENDPOINT=192.168.123.98:3900
# S3_ACCESS_KEY_ID=your-access-key-id
# S3_ACCESS_KEY_SECRET=your-access-key-secret
# S3_BUCKET=agentfs
# S3_REGION=garage
# S3_FORCE_PATH_STYLE=true

# 服务器配置
SERVER_HOST=0.0.0.0
SERVER_PORT=8000
SERVER_LOG_LEVEL=INFO

# 分页配置
DEFAULT_PAGE_SIZE=4000
SEMANTIC_CHUNK_SIZE=2000
SEMANTIC_OVERLAP=200

# 转换配置
CONVERSION_MAX_FILE_SIZE=104857600
CONVERSION_TIMEOUT=300
CONVERSION_ENABLE_OCR=true
CONVERSION_ENABLE_TABLE_EXTRACTION=true
CONVERSION_MAX_WORKERS=4
CONVERSION_ENABLE_CACHE=true
CONVERSION_CACHE_TTL_HOURS=168

# 调试模式
DEBUG=false
```

## 开发指南

### 项目结构

```
file-renderer/
├── alembic/                    # 数据库迁移
│   ├── versions/               # 迁移脚本
│   ├── env.py                  # 迁移环境配置
│   └── alembic.ini             # Alembic配置
├── lib/                        # 核心库
│   ├── middleware.py           # FastAPI中间件
│   ├── exceptions.py           # 自定义异常
│   ├── logging_config.py       # 日志配置
│   └── schemas.py              # 通用响应模型
├── models/                     # 数据模型
│   ├── database.py             # SQLAlchemy模型
│   ├── file.py                 # 文件相关模型
│   ├── create.py               # 创建请求模型
│   ├── edit.py                 # 编辑请求模型
│   ├── markdown_model.py       # Markdown模型
│   ├── pdf_model.py            # PDF模型
│   └── docling_model.py        # Docling模型
├── repositories/               # 数据访问层
│   └── file_repository.py      # 文件仓库
├── routers/                    # API路由
│   ├── file.py                 # 文件路由
│   ├── editor.py               # 编辑器路由
│   ├── docling.py              # Docling路由
│   ├── markdown.py             # Markdown路由
│   ├── pdf.py                  # PDF路由
│   └── health.py               # 健康检查路由
├── services/                   # 业务逻辑层
│   ├── storage_service.py      # S3存储服务
│   ├── docling_service.py      # 文件转换服务
│   ├── pagination_service.py   # 分页服务
│   ├── markdown_service.py     # Markdown服务
│   └── pdf_service.py          # PDF服务
├── scripts/                    # 运维脚本
│   ├── start.sh                # 启动脚本
│   ├── migrate.sh              # 迁移脚本
│   └── health-check.sh         # 健康检查脚本
├── tests/                      # 测试
│   ├── conftest.py             # 测试配置
│   └── test_*.py               # 测试文件
├── config.py                   # 应用配置
├── main.py                     # 应用入口
├── pyproject.toml              # 项目配置
└── README.md                   # 项目文档
```

### 代码规范

项目使用以下工具保证代码质量：

```bash
# 代码格式化
uv run black .

# 代码检查
uv run ruff check .

# 类型检查
uv run mypy .

# 运行测试
uv run pytest

# 使用Makefile简化命令
make format    # 格式化代码
make lint      # 运行所有检查
make test      # 运行测试
make all       # 格式化+检查+测试
```

### 添加新路由

1. 在 `routers/` 目录创建新路由文件
2. 在 `routers/__init__.py` 导出路由
3. 在 `main.py` 注册路由

示例：
```python
# routers/example.py
from fastapi import APIRouter

router = APIRouter(prefix="/example", tags=["example"])

@router.get("/")
async def example():
    return {"message": "Hello"}

# main.py
from routers import example_router
app.include_router(example_router, prefix="/api/v1")
```

### 数据库迁移

```bash
# 创建新迁移（自动检测模型变化）
uv run alembic revision --autogenerate -m "添加新表"

# 升级数据库到最新版本
uv run alembic upgrade head

# 降级数据库到上一个版本
uv run alembic downgrade -1

# 查看迁移历史
uv run alembic history --verbose

# 使用脚本
./scripts/migrate.sh upgrade
./scripts/migrate.sh downgrade
./scripts/migrate.sh revision "添加新表"
```

## 部署指南

详见 [docs/deployment.md](docs/deployment.md)

### 快速部署

```bash
# Docker Compose部署
docker-compose up -d

# Kubernetes部署
kubectl apply -f k8s/
```

## 监控与日志

### 日志配置

日志格式：`timestamp | level | message`

```json
{
  "timestamp": "2024-01-15T08:30:00Z",
  "level": "INFO",
  "message": "Request completed",
  "request_id": "uuid",
  "method": "GET",
  "path": "/files/123",
  "status_code": 200,
  "duration_ms": 45.2
}
```

### 健康检查

```bash
# 服务健康
curl http://localhost:8000/health

# 数据库连接
curl http://localhost:8000/health/db

# S3连接
curl http://localhost:8000/health/s3
```

### 性能监控

服务自动记录以下指标：
- 请求处理时间 (`X-Response-Time` 响应头)
- 慢请求警告 (超过1秒)
- 请求ID追踪 (`X-Request-ID` 响应头)

## 数据库迁移

项目使用 Alembic 进行数据库迁移管理，支持 SQLAlchemy 2.0 异步操作。

### 迁移命令

```bash
# 创建新迁移（自动检测模型变化）
uv run alembic revision --autogenerate -m "迁移描述"

# 升级数据库到最新版本
uv run alembic upgrade head

# 降级数据库到上一个版本
uv run alembic downgrade -1

# 查看迁移历史
uv run alembic history --verbose

# 查看当前版本
uv run alembic current

# 标记特定版本（不执行迁移）
uv run alembic stamp <revision_id>
```

### 迁移工作流

1. **修改模型**: 编辑 `models/database.py` 中的 SQLAlchemy 模型
2. **创建迁移**: `uv run alembic revision --autogenerate -m "描述"`
3. **检查迁移脚本**: 查看 `alembic/versions/` 中生成的脚本
4. **应用迁移**: `uv run alembic upgrade head`
5. **回滚（如需）**: `uv run alembic downgrade -1`

### 初始迁移

项目已包含初始迁移脚本，创建以下表：
- `file_metadata`: 文件元数据
- `file_versions`: 文件版本
- `pdf_parse_results`: PDF解析结果缓存
- `conversion_cache`: 文档转换缓存
- `conversion_tasks`: 转换任务

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 许可证

[MIT](https://opensource.org/licenses/MIT)

## 联系方式

- 项目主页: https://github.com/aikb/file-renderer
- 问题反馈: https://github.com/aikb/file-renderer/issues
- 邮箱: dev@aikb.io
