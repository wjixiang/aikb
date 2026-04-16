from __future__ import annotations

import sys
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from jupyter_backend.api.execute import router as execute_router
from jupyter_backend.api.health import router as health_router
from jupyter_backend.api.kernels import router as kernels_router
from jupyter_backend.config import settings
from jupyter_backend.kernel.manager import kernel_pool


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await kernel_pool.shutdown_all()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Jupyter Backend",
        description="Lightweight Jupyter kernel server with REST API for agent integration",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health_router)
    app.include_router(kernels_router)
    app.include_router(execute_router)

    return app


def main() -> None:
    sys.exit(
        uvicorn.run(
            "jupyter_backend.app:create_app",
            factory=True,
            host=settings.host,
            port=settings.port,
        )
    )


if __name__ == "__main__":
    main()
