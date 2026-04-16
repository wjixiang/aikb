from __future__ import annotations

import pytest

from jupyter_backend.kernel.executor import _execute_sync
from jupyter_backend.kernel.manager import KernelPool, ManagedKernel


@pytest.fixture
async def managed_kernel():
    pool = KernelPool()
    kernel = await pool.start_kernel(name="python3")
    yield kernel
    await pool.shutdown_all()


async def test_execute_sync_simple(managed_kernel: ManagedKernel):
    result = _execute_sync(managed_kernel, "2 + 2", timeout=30)
    assert result["status"] == "ok"
    assert result["result"] == "4"
    assert result["execution_count"] == 1
    assert result["stdout"] == ""
    assert result["stderr"] == ""
    assert result["error"] is None


async def test_execute_sync_stdout(managed_kernel: ManagedKernel):
    result = _execute_sync(managed_kernel, "print('hello')", timeout=30)
    assert result["status"] == "ok"
    assert "hello" in result["stdout"]
    assert result["result"] == "hello"


async def test_execute_sync_stderr(managed_kernel: ManagedKernel):
    result = _execute_sync(managed_kernel, "import sys; sys.stderr.write('err\\n')", timeout=30)
    assert result["status"] == "ok"
    assert "err" in result["stderr"]


async def test_execute_sync_error(managed_kernel: ManagedKernel):
    result = _execute_sync(managed_kernel, "1/0", timeout=30)
    assert result["status"] == "error"
    assert result["error"] is not None
    assert result["error"].ename == "ZeroDivisionError"
    assert len(result["error"].traceback) > 0


async def test_execute_sync_syntax_error(managed_kernel: ManagedKernel):
    result = _execute_sync(managed_kernel, "def(", timeout=30)
    assert result["status"] == "error"
    assert result["error"].ename == "SyntaxError"


async def test_execute_sync_outputs_stream(managed_kernel: ManagedKernel):
    result = _execute_sync(managed_kernel, "print('a'); print('b')", timeout=30)
    stream_outputs = [o for o in result["outputs"] if o.type == "stream"]
    assert len(stream_outputs) >= 1


async def test_execute_sync_outputs_execute_result(managed_kernel: ManagedKernel):
    result = _execute_sync(managed_kernel, "42", timeout=30)
    result_outputs = [o for o in result["outputs"] if o.type == "execute_result"]
    assert len(result_outputs) == 1
    assert result_outputs[0].data["text/plain"] == "42"
    assert result_outputs[0].execution_count == 1


async def test_execute_sync_outputs_error(managed_kernel: ManagedKernel):
    result = _execute_sync(managed_kernel, "raise RuntimeError('boom')", timeout=30)
    error_outputs = [o for o in result["outputs"] if o.type == "error"]
    assert len(error_outputs) == 1
    assert error_outputs[0].ename == "RuntimeError"
    assert error_outputs[0].evalue == "boom"


async def test_execute_sync_no_result_for_assignment(managed_kernel: ManagedKernel):
    result = _execute_sync(managed_kernel, "x = 1", timeout=30)
    assert result["status"] == "ok"
    assert result["result"] is None


async def test_execute_sync_execution_count_increments(managed_kernel: ManagedKernel):
    r1 = _execute_sync(managed_kernel, "1", timeout=30)
    r2 = _execute_sync(managed_kernel, "2", timeout=30)
    assert r1["execution_count"] == 1
    assert r2["execution_count"] == 2


async def test_execute_sync_stateful(managed_kernel: ManagedKernel):
    _execute_sync(managed_kernel, "val = 99", timeout=30)
    result = _execute_sync(managed_kernel, "val * 2", timeout=30)
    assert result["status"] == "ok"
    assert result["result"] == "198"


async def test_execute_sync_empty_code(managed_kernel: ManagedKernel):
    result = _execute_sync(managed_kernel, "", timeout=30)
    assert result["status"] == "ok"


async def test_execute_sync_multiline_function(managed_kernel: ManagedKernel):
    code = """
def fib(n):
    if n <= 1:
        return n
    return fib(n-1) + fib(n-2)

fib(10)
"""
    result = _execute_sync(managed_kernel, code, timeout=30)
    assert result["status"] == "ok"
    assert result["result"] == "55"


async def test_execute_sync_display_data_not_captured_as_result(
    managed_kernel: ManagedKernel,
):
    result = _execute_sync(managed_kernel, "42", timeout=30)
    assert result["result"] == "42"


async def test_execute_sync_stderr_from_error_traceback(managed_kernel: ManagedKernel):
    result = _execute_sync(managed_kernel, "1/0", timeout=30)
    assert len(result["stderr"]) > 0
    assert "ZeroDivisionError" in result["stderr"]
