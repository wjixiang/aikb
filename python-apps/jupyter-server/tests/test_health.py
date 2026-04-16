from __future__ import annotations

from httpx import AsyncClient

from jupyter_backend import __version__


async def test_health_returns_ok(client: AsyncClient):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["version"] == __version__
    assert body["kernel_count"] >= 0


async def test_health_reflects_kernel_count(client: AsyncClient):
    resp = await client.get("/api/health")
    count_before = resp.json()["kernel_count"]

    await client.post("/api/kernels", json={"name": "python3"})

    resp = await client.get("/api/health")
    assert resp.json()["kernel_count"] == count_before + 1
