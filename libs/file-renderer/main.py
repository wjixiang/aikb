"""
File Renderer Service - 为Agent提供云端文件读写服务

基于S3兼容对象存储的文件云端读写系统，通过docling实现多种文件格式转换为LLM友好的纯文本数据，并进行自动分页。

Features:
- 文件上传、下载、管理
- 多格式文件创建（Text, JSON, Markdown, HTML, XML, CSV, PDF, TeX, Binary）
- PDF解析和分页读取
- Markdown编辑和预览
- S3兼容存储（阿里云OSS、MinIO等）
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, APIKeyHeader

from config import settings
from lib.error_handlers import register_exception_handlers
from lib.exceptions import FileRendererException
from lib.logging_config import get_logger, setup_logging
from lib.middleware import (
    ErrorHandlingMiddleware,
    LoggingMiddleware,
    PerformanceMonitoringMiddleware,
    RequestIDMiddleware,
    SecurityHeadersMiddleware,
    TimingMiddleware,
)

# Security schemes for OpenAPI
SECURITY_SCHEMES = {
    "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "JWT token authentication. Format: Bearer {token}",
    },
    "apiKeyAuth": {
        "type": "apiKey",
        "in": "header",
        "name": "X-API-Key",
        "description": "API Key authentication. Format: X-API-Key: {your_api_key}",
    },
}
from models.database import (
    check_database_connection_async,
    init_db_async,
)
from routers import (
    binary_router,
    csv_router,
    docling_router,
    editor_router,
    file_router,
    health_router,
    html_router,
    json_router,
    markdown_router,
    pdf_router,
    tex_router,
    text_router,
    xml_router,
)

# 配置日志
setup_logging()

logger = get_logger(__name__)


# API 标签元数据 - 用于组织和分组 API 文档
TAGS_METADATA = [
    {
        "name": "files",
        "description": "文件管理 API - 上传、下载、删除、查询文件元数据",
    },
    {
        "name": "text",
        "description": "文本文件 API - 创建和管理纯文本文件",
    },
    {
        "name": "json",
        "description": "JSON 文件 API - 创建和管理 JSON 文件",
    },
    {
        "name": "markdown",
        "description": "Markdown 文件 API - 创建、读取、编辑 Markdown 文件，支持分页和预览",
    },
    {
        "name": "html",
        "description": "HTML 文件 API - 创建和管理 HTML 文件",
    },
    {
        "name": "xml",
        "description": "XML 文件 API - 创建和管理 XML 文件",
    },
    {
        "name": "csv",
        "description": "CSV 文件 API - 创建和管理 CSV 文件",
    },
    {
        "name": "binary",
        "description": "二进制文件 API - 创建和管理二进制文件",
    },
    {
        "name": "pdf",
        "description": "PDF 文件 API - 创建和解析 PDF 文件，支持分页读取",
    },
    {
        "name": "tex",
        "description": "TeX 文件 API - 创建和管理 LaTeX 文件",
    },
    {
        "name": "docling",
        "description": "Docling 文件转换 API - 统一的多格式文件转换服务，支持 PDF/DOCX/PPTX/XLSX/CSV/HTML/Markdown/图片等格式转换为 LLM 友好的纯文本",
    },
    {
        "name": "health",
        "description": "健康检查 API - 服务状态和连接检查",
    },
]


@asynccontextmanager
async def lifespan(_: FastAPI):
    """应用生命周期管理"""
    # 启动时
    logger.info(
        f"Starting {settings.app_name} v{settings.app_version}",
        extra={
            "app_name": settings.app_name,
            "app_version": settings.app_version,
            "s3_bucket": settings.s3.bucket,
            "s3_endpoint": settings.s3.endpoint,
            "debug": settings.debug,
        },
    )

    # 初始化数据库（异步方式）
    try:
        await init_db_async()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}", exc_info=True)
        raise

    yield
    # 关闭时
    logger.info(f"Shutting down {settings.app_name}")


app = FastAPI(
    title="File Renderer Service",
    description="""
    云端Agent文件读写系统 API

    为Agent提供基于S3兼容对象存储的文件云端读写服务，支持多种文件格式：

    ## 核心功能

    ### 1. 文件管理
    - 文件上传到S3存储
    - 获取文件元数据和下载链接
    - 文件删除和列表查询

    ### 2. 文件创建
    - 文本文件 (text/plain)
    - JSON 文件 (application/json)
    - Markdown 文件 (text/markdown)
    - HTML 文件 (text/html)
    - XML 文件 (application/xml)
    - CSV 文件 (text/csv)
    - PDF 文件 (application/pdf)
    - TeX 文件 (application/x-tex)
    - 二进制文件 (application/octet-stream)

    ### 3. PDF 处理
    - 使用 docling 解析 PDF 文件
    - 分页读取指定页面内容

    ### 4. Markdown 编辑
    - 分页读取大文件
    - 行级编辑（替换、插入、删除）
    - 编辑预览（不实际修改文件）

    ## 技术架构

    - **存储层**: S3兼容对象存储（阿里云OSS、MinIO等）
    - **转换层**: docling 文件格式转换
    - **API层**: FastAPI + Pydantic
    - **数据库**: PostgreSQL（文件元数据）

    ## 认证

    支持两种认证方式：
    1. **Bearer Token (JWT)**: 在请求头中添加 `Authorization: Bearer {token}`
    2. **API Key**: 在请求头中添加 `X-API-Key: {your_api_key}`

    选择认证方式取决于你的部署配置。默认情况下不需要认证。

    ## 使用指南

    ### 快速开始

    1. 上传文件：使用 `POST /api/v1/files/upload`
    2. 获取元数据：使用 `GET /api/v1/files/{file_id}`
    3. 下载文件：使用 `GET /api/v1/files/{file_id}/download`

    ### 分页读取

    对于大文件，使用分页接口：
    - Markdown: `POST /api/v1/markdown/read/bypage`
    - PDF: `POST /api/v1/pdf/read`
    - Docling: `POST /api/v1/docling/page`

    ### 文件编辑

    使用 Editor API 进行文件操作：
    - 统一接口：`POST /api/v1/editor`
    - 独立接口：`POST /api/v1/editor/create`, `GET /api/v1/editor/read`, etc.

    ## 错误处理

    所有错误响应都遵循统一格式：
    ```json
    {
        "success": false,
        "message": "错误描述",
        "error_code": "ERROR_CODE",
        "errors": [...],
        "timestamp": "2024-01-15T08:30:00Z"
    }
    ```

    常见错误代码：
    - `VALIDATION_ERROR`: 请求参数验证失败
    - `NOT_FOUND`: 资源不存在
    - `INTERNAL_ERROR`: 服务器内部错误
    - `FILE_TOO_LARGE`: 文件超过大小限制
    """,
    version=settings.app_version,
    openapi_tags=TAGS_METADATA,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
    contact={
        "name": "AIKB Team",
        "url": "https://github.com/aikb/file-renderer",
        "email": "dev@aikb.io",
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT",
    },
    terms_of_service="https://aikb.io/terms",
    swagger_ui_parameters={
        "persistAuthorization": True,
        "displayRequestDuration": True,
        "docExpansion": "list",
        "filter": True,
        "showExtensions": True,
        "showCommonExtensions": True,
        "deepLinking": True,
        "defaultModelsExpandDepth": 1,
        "defaultModelExpandDepth": 1,
        "syntaxHighlight": {"theme": "monokai"},
    },
)

# 配置 OpenAPI 安全方案
app.openapi_schema = None


def custom_openapi():
    """自定义 OpenAPI 配置，添加安全方案"""
    if app.openapi_schema:
        return app.openapi_schema

    from fastapi.openapi.utils import get_openapi

    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
        tags=app.openapi_tags,
    )

    # 添加安全方案
    openapi_schema["components"]["securitySchemes"] = SECURITY_SCHEMES

    # 添加全局安全要求（可选，默认不启用）
    # openapi_schema["security"] = [{"bearerAuth": []}, {"apiKeyAuth": []}]

    # 添加外部文档链接
    openapi_schema["externalDocs"] = {
        "description": "API 使用指南",
        "url": "/docs/api_usage.md",
    }

    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi

# 添加中间件（注意：中间件执行顺序与添加顺序相反，最后添加的最先执行）

# 1. 错误处理中间件（最先执行，最后处理）
app.add_middleware(
    ErrorHandlingMiddleware,
    include_traceback=settings.debug,
)

# 2. 安全响应头中间件
app.add_middleware(SecurityHeadersMiddleware)

# 3. CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应配置具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Request-ID", "X-Response-Time"],
    max_age=600,
)

# 4. 性能监控中间件
app.add_middleware(
    PerformanceMonitoringMiddleware,
    slow_request_threshold_ms=1000.0,
)

# 5. 计时中间件
app.add_middleware(TimingMiddleware)

# 6. 请求ID中间件
app.add_middleware(RequestIDMiddleware)

# 7. 日志中间件（最后添加，最先处理请求）
app.add_middleware(
    LoggingMiddleware,
    exclude_paths=["/health", "/", "/docs", "/openapi.json", "/favicon.ico", "/redoc"],
)


# 注册全局异常处理器
register_exception_handlers(app, include_traceback=settings.debug)

# 注册路由
app.include_router(file_router, prefix="/api/v1")
app.include_router(text_router, prefix="/api/v1/text")
app.include_router(json_router, prefix="/api/v1/json")
app.include_router(markdown_router, prefix="/api/v1/markdown")
app.include_router(html_router, prefix="/api/v1/html")
app.include_router(xml_router, prefix="/api/v1/xml")
app.include_router(csv_router, prefix="/api/v1/csv")
app.include_router(binary_router, prefix="/api/v1/binary")
app.include_router(pdf_router, prefix="/api/v1/pdf")
app.include_router(tex_router, prefix="/api/v1/tex")
app.include_router(docling_router, prefix="/api/v1")
app.include_router(editor_router, prefix="/api/v1")
app.include_router(health_router)


@app.get(
    "/",
    response_model=dict,
    summary="服务根端点",
    description="返回服务基本信息",
    tags=["health"],
    operation_id="getRoot",
)
def read_root():
    """服务根端点 - 返回服务基本信息"""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "docs_url": "/docs",
        "redoc_url": "/redoc",
    }


if __name__ == "__main__":
    import uvicorn

    # 配置 uvicorn 日志使用我们的配置
    log_config = uvicorn.config.LOGGING_CONFIG
    log_config["formatters"]["default"]["fmt"] = "%(asctime)s | %(levelname)-8s | %(message)s"
    log_config["formatters"]["access"]["fmt"] = "%(asctime)s | %(levelname)-8s | %(message)s"

    uvicorn.run(
        "main:app",
        host=settings.server.host,
        port=settings.server.port,
        reload=settings.server.reload,
        log_level=settings.server.log_level.lower(),
        log_config=log_config,
    )
