from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ExecuteRequest(BaseModel):
    code: str
    kernel_id: str | None = None
    timeout: float | None = None
    kernel_name: str | None = None


class OutputItem(BaseModel):
    type: str
    name: str | None = None
    text: str | None = None
    data: dict[str, Any] | None = None
    execution_count: int | None = None
    ename: str | None = None
    evalue: str | None = None
    traceback: list[str] | None = None


class ErrorInfo(BaseModel):
    ename: str
    evalue: str
    traceback: list[str]


class ExecuteResponse(BaseModel):
    status: str
    kernel_id: str
    execution_count: int | None = None
    stdout: str = ""
    stderr: str = ""
    result: str | None = None
    outputs: list[OutputItem] = Field(default_factory=list)
    error: ErrorInfo | None = None


class StartKernelRequest(BaseModel):
    name: str = "python3"


class KernelInfo(BaseModel):
    id: str
    name: str
    status: str
    created_at: datetime


class KernelListResponse(BaseModel):
    kernels: list[KernelInfo]


class KernelResponse(BaseModel):
    id: str
    name: str
    status: str


class HealthResponse(BaseModel):
    status: str
    kernel_count: int
    version: str


class ErrorResponse(BaseModel):
    detail: str
