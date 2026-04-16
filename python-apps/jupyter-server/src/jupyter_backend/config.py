from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_prefix": "JUPYTER_BACKEND_"}

    host: str = "0.0.0.0"
    port: int = 8888

    default_kernel_name: str = "python3"
    max_kernels: int = 10
    kernel_startup_timeout: float = 60.0
    default_execution_timeout: float = 30.0

    cors_origins: list[str] = ["*"]


settings = Settings()
