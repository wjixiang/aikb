from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from jupyter_backend.app import create_app
from jupyter_backend.kernel.manager import kernel_pool


@pytest.fixture
def app():
    return create_app()


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def kernel_id(client: AsyncClient) -> str:
    resp = await client.post("/api/kernels", json={"name": "python3"})
    assert resp.status_code == 201
    return resp.json()["id"]


@pytest.fixture(autouse=True)
async def cleanup_kernels():
    yield
    await kernel_pool.shutdown_all()
