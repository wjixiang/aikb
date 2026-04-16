from __future__ import annotations

import asyncio
import logging
from typing import Any

from jupyter_backend.config import settings
from jupyter_backend.kernel.manager import ManagedKernel, kernel_pool
from jupyter_backend.models.schemas import (
    ErrorInfo,
    ExecuteResponse,
    OutputItem,
)

logger = logging.getLogger(__name__)


def _execute_sync(
    kernel: ManagedKernel,
    code: str,
    timeout: float,
) -> dict[str, Any]:
    outputs: list[OutputItem] = []
    stdout_parts: list[str] = []
    stderr_parts: list[str] = []
    result_text: str | None = None
    error_info: ErrorInfo | None = None

    def capture_output(msg: dict[str, Any]) -> None:
        nonlocal result_text, error_info
        msg_type = msg["header"]["msg_type"]
        content = msg["content"]

        if msg_type == "stream":
            name = content.get("name", "stdout")
            text = content.get("text", "")
            outputs.append(OutputItem(type="stream", name=name, text=text))
            if name == "stdout":
                stdout_parts.append(text)
            else:
                stderr_parts.append(text)

        elif msg_type == "execute_result":
            data = content.get("data", {})
            outputs.append(
                OutputItem(
                    type="execute_result",
                    data=data,
                    execution_count=content.get("execution_count"),
                )
            )
            result_text = data.get("text/plain")

        elif msg_type == "display_data":
            data = content.get("data", {})
            outputs.append(OutputItem(type="display_data", data=data))

        elif msg_type == "error":
            error_info = ErrorInfo(
                ename=content.get("ename", ""),
                evalue=content.get("evalue", ""),
                traceback=content.get("traceback", []),
            )
            outputs.append(
                OutputItem(
                    type="error",
                    ename=error_info.ename,
                    evalue=error_info.evalue,
                    traceback=error_info.traceback,
                )
            )
            stderr_parts.extend(error_info.traceback)

    reply = kernel.client.execute_interactive(
        code,
        allow_stdin=False,
        timeout=timeout,
        output_hook=capture_output,
    )

    status = reply["content"]["status"]
    execution_count = reply["content"].get("execution_count")

    if status == "ok" and result_text is None and stdout_parts:
        result_text = "\n".join(stdout_parts).strip()

    return {
        "status": "ok" if status == "ok" else "error",
        "execution_count": execution_count,
        "stdout": "\n".join(stdout_parts),
        "stderr": "\n".join(stderr_parts),
        "result": result_text,
        "outputs": outputs,
        "error": error_info,
    }


async def execute_code(
    kernel_id: str | None,
    code: str,
    timeout: float | None = None,
    kernel_name: str | None = None,
) -> ExecuteResponse:
    if kernel_id is not None:
        kernel = kernel_pool.get_kernel(kernel_id)
        if kernel is None:
            return ExecuteResponse(
                status="error",
                kernel_id=kernel_id,
                error=ErrorInfo(
                    ename="KernelNotFound",
                    evalue=f"Kernel {kernel_id} not found or is dead",
                    traceback=[],
                ),
            )
    else:
        kernel = await kernel_pool.start_kernel(name=kernel_name)
        kernel_id = kernel.kernel_id

    effective_timeout = timeout or settings.default_execution_timeout
    loop = asyncio.get_event_loop()

    try:
        result = await loop.run_in_executor(None, _execute_sync, kernel, code, effective_timeout)
    except TimeoutError:
        await kernel_pool.interrupt_kernel(kernel_id)
        return ExecuteResponse(
            status="error",
            kernel_id=kernel_id,
            error=ErrorInfo(
                ename="TimeoutError",
                evalue=f"Execution timed out after {effective_timeout}s",
                traceback=[],
            ),
        )
    except Exception as exc:
        logger.exception("Execution failed on kernel %s", kernel_id)
        return ExecuteResponse(
            status="error",
            kernel_id=kernel_id,
            error=ErrorInfo(
                ename=type(exc).__name__,
                evalue=str(exc),
                traceback=[],
            ),
        )

    return ExecuteResponse(
        status=result["status"],
        kernel_id=kernel_id,
        execution_count=result["execution_count"],
        stdout=result["stdout"],
        stderr=result["stderr"],
        result=result["result"],
        outputs=result["outputs"],
        error=result["error"],
    )
