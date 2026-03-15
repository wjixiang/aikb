"""
File Renderer Service - 为Agent提供云端文件读写服务
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from config import settings
from routers import (
    binary_router,
    csv_router,
    file_router,
    html_router,
    json_router,
    markdown_router,
    pdf_router,
    text_router,
    xml_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时
    print(f"Starting {settings.app_name} v{settings.app_version}")
    print(f"S3 Bucket: {settings.s3.bucket}")
    print(f"S3 Endpoint: {settings.s3.endpoint}")
    yield
    # 关闭时
    print(f"Shutting down {settings.app_name}")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)

# 注册路由
app.include_router(file_router)
app.include_router(text_router, prefix="/text")
app.include_router(json_router, prefix="/json")
app.include_router(markdown_router, prefix="/markdown")
app.include_router(html_router, prefix="/html")
app.include_router(xml_router, prefix="/xml")
app.include_router(csv_router, prefix="/csv")
app.include_router(binary_router, prefix="/binary")
app.include_router(pdf_router, prefix="/pdf")


@app.get("/")
def read_root():
    """健康检查"""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "running"
    }


@app.get("/health")
def health_check():
    """健康检查端点"""
    return {
        "status": "healthy",
        "s3_connected": bool(settings.s3.bucket),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.server.host,
        port=settings.server.port,
        reload=settings.server.reload,
        log_level=settings.server.log_level.lower(),
    )
