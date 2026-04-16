from __future__ import annotations

import time

import pytest
from httpx import AsyncClient

from jupyter_backend.kernel.manager import kernel_pool


async def test_execute_simple_expression(client: AsyncClient):
    resp = await client.post(
        "/api/execute",
        json={"code": "2 + 2"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["result"] == "4"
    assert body["execution_count"] == 1


async def test_execute_print(client: AsyncClient):
    resp = await client.post(
        "/api/execute",
        json={"code": "print('hello world')"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "hello world" in body["stdout"]


async def test_execute_stdout_and_result(client: AsyncClient):
    resp = await client.post(
        "/api/execute",
        json={"code": "print('output'); 42"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "output" in body["stdout"]
    assert body["result"] == "42"


async def test_execute_syntax_error(client: AsyncClient):
    resp = await client.post(
        "/api/execute",
        json={"code": "def broken("},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "error"
    assert body["error"] is not None
    assert "Error" in body["error"]["ename"]


async def test_execute_runtime_error(client: AsyncClient):
    resp = await client.post(
        "/api/execute",
        json={"code": "1 / 0"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "error"
    assert body["error"]["ename"] == "ZeroDivisionError"
    assert body["error"]["evalue"] == "division by zero"
    assert len(body["error"]["traceback"]) > 0


async def test_execute_name_error(client: AsyncClient):
    resp = await client.post(
        "/api/execute",
        json={"code": "undefined_variable"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "error"
    assert body["error"]["ename"] == "NameError"


async def test_execute_multiline(client: AsyncClient):
    code = """
def add(a, b):
    return a + b

result = add(10, 20)
result
"""
    resp = await client.post("/api/execute", json={"code": code})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["result"] == "30"


async def test_execute_stderr(client: AsyncClient):
    resp = await client.post(
        "/api/execute",
        json={"code": "import sys; sys.stderr.write('error msg\\n')"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "error msg" in body["stderr"]


async def test_execute_empty_code(client: AsyncClient):
    resp = await client.post(
        "/api/execute",
        json={"code": ""},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"


async def test_execute_none_result(client: AsyncClient):
    resp = await client.post(
        "/api/execute",
        json={"code": "x = 1"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["result"] is None


async def test_execute_with_existing_kernel(client: AsyncClient, kernel_id: str):
    resp = await client.post(
        "/api/execute",
        json={"code": "42", "kernel_id": kernel_id},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["kernel_id"] == kernel_id
    assert body["result"] == "42"


async def test_execute_with_nonexistent_kernel(client: AsyncClient):
    resp = await client.post(
        "/api/execute",
        json={"code": "1", "kernel_id": "nonexistent-id"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "error"
    assert body["error"]["ename"] == "KernelNotFound"


async def test_execute_stateful_across_calls(client: AsyncClient, kernel_id: str):
    resp1 = await client.post(
        "/api/execute",
        json={"code": "x = 100", "kernel_id": kernel_id},
    )
    assert resp1.json()["status"] == "ok"

    resp2 = await client.post(
        "/api/execute",
        json={"code": "x * 3", "kernel_id": kernel_id},
    )
    assert resp2.status_code == 200
    body = resp2.json()
    assert body["status"] == "ok"
    assert body["result"] == "300"
    assert body["execution_count"] == 2


async def test_execute_auto_creates_kernel(client: AsyncClient):
    resp = await client.post(
        "/api/execute",
        json={"code": "1 + 1"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["kernel_id"] is not None

    list_resp = await client.get("/api/kernels")
    ids = [k["id"] for k in list_resp.json()["kernels"]]
    assert body["kernel_id"] in ids


async def test_execute_execution_count_increments(client: AsyncClient, kernel_id: str):
    for i in range(1, 4):
        resp = await client.post(
            "/api/execute",
            json={"code": str(i), "kernel_id": kernel_id},
        )
        assert resp.json()["execution_count"] == i


async def test_execute_outputs_contain_stream(client: AsyncClient):
    resp = await client.post(
        "/api/execute",
        json={"code": "print('line1'); print('line2')"},
    )
    body = resp.json()
    stream_outputs = [o for o in body["outputs"] if o["type"] == "stream"]
    assert len(stream_outputs) >= 1
    assert any("line1" in o.get("text", "") for o in stream_outputs)


async def test_execute_outputs_contain_execute_result(client: AsyncClient):
    resp = await client.post(
        "/api/execute",
        json={"code": "123"},
    )
    body = resp.json()
    result_outputs = [o for o in body["outputs"] if o["type"] == "execute_result"]
    assert len(result_outputs) == 1
    assert result_outputs[0]["data"]["text/plain"] == "123"
    assert result_outputs[0]["execution_count"] == 1


async def test_execute_outputs_contain_error(client: AsyncClient):
    resp = await client.post(
        "/api/execute",
        json={"code": "raise ValueError('test')"},
    )
    body = resp.json()
    error_outputs = [o for o in body["outputs"] if o["type"] == "error"]
    assert len(error_outputs) == 1
    assert error_outputs[0]["ename"] == "ValueError"
    assert error_outputs[0]["evalue"] == "test"


async def test_execute_custom_timeout(client: AsyncClient, kernel_id: str):
    resp = await client.post(
        "/api/execute",
        json={"code": "1", "kernel_id": kernel_id, "timeout": 5.0},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


async def test_execute_timeout_triggers_interrupt(client: AsyncClient, kernel_id: str):
    resp = await client.post(
        "/api/execute",
        json={"code": "import time; time.sleep(100)", "kernel_id": kernel_id, "timeout": 2.0},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "error"
    assert body["error"]["ename"] == "TimeoutError"


async def test_execute_kernel_still_alive_after_timeout(client: AsyncClient, kernel_id: str):
    resp = await client.post(
        "/api/execute",
        json={"code": "import time; time.sleep(100)", "kernel_id": kernel_id, "timeout": 2.0},
    )
    assert resp.json()["status"] == "error"

    import asyncio

    await asyncio.sleep(0.5)

    resp = await client.post(
        "/api/execute",
        json={"code": "1 + 1", "kernel_id": kernel_id},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    assert resp.json()["result"] == "2"


async def test_execute_import_stdlib(client: AsyncClient):
    resp = await client.post(
        "/api/execute",
        json={"code": "import json; json.dumps({'a': 1})"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert '{"a": 1}' in body["result"]


async def test_execute_complex_types(client: AsyncClient):
    resp = await client.post(
        "/api/execute",
        json={"code": "[1, 2, 3, 4, 5]"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["result"] == "[1, 2, 3, 4, 5]"


async def test_execute_large_output(client: AsyncClient):
    resp = await client.post(
        "/api/execute",
        json={"code": "print('\\n'.join(str(i) for i in range(1000)))"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "999" in body["stdout"]


async def test_execute_unicode(client: AsyncClient):
    resp = await client.post(
        "/api/execute",
        json={"code": "print('你好世界 🌍')"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "你好世界" in body["stdout"]


async def test_execute_custom_kernel_name(client: AsyncClient):
    resp = await client.post(
        "/api/execute",
        json={"code": "1", "kernel_name": "python3"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


async def test_execute_missing_code_field(client: AsyncClient):
    resp = await client.post("/api/execute", json={})
    assert resp.status_code == 422


async def test_execute_empty_body(client: AsyncClient):
    resp = await client.post("/api/execute", content=b"")
    assert resp.status_code == 422
