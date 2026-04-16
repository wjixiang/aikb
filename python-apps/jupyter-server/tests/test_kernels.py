from __future__ import annotations

import pytest
from httpx import AsyncClient


async def test_start_kernel_default(client: AsyncClient):
    resp = await client.post("/api/kernels", json={"name": "python3"})
    assert resp.status_code == 201
    body = resp.json()
    assert "id" in body
    assert body["name"] == "python3"
    assert body["status"] == "alive"


async def test_start_kernel_returns_unique_ids(client: AsyncClient):
    resp1 = await client.post("/api/kernels", json={"name": "python3"})
    resp2 = await client.post("/api/kernels", json={"name": "python3"})
    assert resp1.json()["id"] != resp2.json()["id"]


async def test_start_kernel_missing_body(client: AsyncClient):
    resp = await client.post("/api/kernels", json={})
    assert resp.status_code == 201
    assert resp.json()["name"] == "python3"


async def test_list_kernels_empty(client: AsyncClient):
    resp = await client.get("/api/kernels")
    assert resp.status_code == 200
    assert resp.json()["kernels"] == []


async def test_list_kernels_after_start(client: AsyncClient, kernel_id: str):
    resp = await client.get("/api/kernels")
    assert resp.status_code == 200
    kernels = resp.json()["kernels"]
    assert len(kernels) >= 1
    ids = [k["id"] for k in kernels]
    assert kernel_id in ids


async def test_list_kernels_includes_metadata(client: AsyncClient, kernel_id: str):
    resp = await client.get("/api/kernels")
    kernel = next(k for k in resp.json()["kernels"] if k["id"] == kernel_id)
    assert kernel["name"] == "python3"
    assert kernel["status"] == "alive"
    assert "created_at" in kernel


async def test_shutdown_kernel(client: AsyncClient, kernel_id: str):
    resp = await client.delete(f"/api/kernels/{kernel_id}")
    assert resp.status_code == 204

    resp = await client.get("/api/kernels")
    ids = [k["id"] for k in resp.json()["kernels"]]
    assert kernel_id not in ids


async def test_shutdown_nonexistent_kernel(client: AsyncClient):
    resp = await client.delete("/api/kernels/nonexistent-id")
    assert resp.status_code == 404


async def test_shutdown_already_shutdown_kernel(client: AsyncClient, kernel_id: str):
    resp = await client.delete(f"/api/kernels/{kernel_id}")
    assert resp.status_code == 204

    resp = await client.delete(f"/api/kernels/{kernel_id}")
    assert resp.status_code == 404


async def test_restart_kernel(client: AsyncClient, kernel_id: str):
    resp = await client.post(f"/api/kernels/{kernel_id}/restart")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == kernel_id
    assert body["status"] == "alive"


async def test_restart_nonexistent_kernel(client: AsyncClient):
    resp = await client.post("/api/kernels/nonexistent-id/restart")
    assert resp.status_code == 404


async def test_restart_kernel_resets_state(client: AsyncClient, kernel_id: str):
    await client.post(
        "/api/execute",
        json={"code": "x = 999", "kernel_id": kernel_id},
    )

    await client.post(f"/api/kernels/{kernel_id}/restart")

    resp = await client.post(
        "/api/execute",
        json={"code": "print(x)", "kernel_id": kernel_id},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "error"


async def test_interrupt_kernel(client: AsyncClient, kernel_id: str):
    resp = await client.post(f"/api/kernels/{kernel_id}/interrupt")
    assert resp.status_code == 204


async def test_interrupt_nonexistent_kernel(client: AsyncClient):
    resp = await client.post("/api/kernels/nonexistent-id/interrupt")
    assert resp.status_code == 404
