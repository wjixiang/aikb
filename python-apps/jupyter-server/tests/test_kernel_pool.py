from __future__ import annotations

import pytest

from jupyter_backend.config import settings
from jupyter_backend.kernel.manager import KernelPool


@pytest.fixture
def pool():
    return KernelPool()


async def test_start_and_get_kernel(pool: KernelPool):
    kernel = await pool.start_kernel(name="python3")
    assert kernel.kernel_id is not None
    assert kernel.name == "python3"
    assert kernel.is_alive

    retrieved = pool.get_kernel(kernel.kernel_id)
    assert retrieved is not None
    assert retrieved.kernel_id == kernel.kernel_id


async def test_start_kernel_increments_count(pool: KernelPool):
    assert pool.count == 0
    await pool.start_kernel()
    assert pool.count == 1
    await pool.start_kernel()
    assert pool.count == 2


async def test_shutdown_kernel(pool: KernelPool):
    kernel = await pool.start_kernel()
    assert pool.count == 1

    removed = await pool.shutdown_kernel(kernel.kernel_id)
    assert removed is True
    assert pool.count == 0


async def test_shutdown_nonexistent_kernel(pool: KernelPool):
    removed = await pool.shutdown_kernel("nonexistent")
    assert removed is False


async def test_shutdown_kernel_twice(pool: KernelPool):
    kernel = await pool.start_kernel()
    assert await pool.shutdown_kernel(kernel.kernel_id) is True
    assert await pool.shutdown_kernel(kernel.kernel_id) is False


async def test_get_nonexistent_kernel(pool: KernelPool):
    assert pool.get_kernel("nonexistent") is None


async def test_restart_kernel(pool: KernelPool):
    kernel = await pool.start_kernel()
    restarted = await pool.restart_kernel(kernel.kernel_id)
    assert restarted is not None
    assert restarted.kernel_id == kernel.kernel_id
    assert restarted.is_alive


async def test_restart_nonexistent_kernel(pool: KernelPool):
    result = await pool.restart_kernel("nonexistent")
    assert result is None


async def test_interrupt_kernel(pool: KernelPool):
    kernel = await pool.start_kernel()
    interrupted = await pool.interrupt_kernel(kernel.kernel_id)
    assert interrupted is True


async def test_interrupt_nonexistent_kernel(pool: KernelPool):
    interrupted = await pool.interrupt_kernel("nonexistent")
    assert interrupted is False


async def test_list_kernels(pool: KernelPool):
    k1 = await pool.start_kernel()
    k2 = await pool.start_kernel()
    kernels = await pool.list_kernels()
    assert len(kernels) == 2
    ids = {k.kernel_id for k in kernels}
    assert ids == {k1.kernel_id, k2.kernel_id}


async def test_list_kernels_empty(pool: KernelPool):
    kernels = await pool.list_kernels()
    assert kernels == []


async def test_shutdown_all(pool: KernelPool):
    await pool.start_kernel()
    await pool.start_kernel()
    assert pool.count == 2

    await pool.shutdown_all()
    assert pool.count == 0


async def test_shutdown_all_empty(pool: KernelPool):
    await pool.shutdown_all()
    assert pool.count == 0


async def test_max_kernels_limit(pool: KernelPool, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "max_kernels", 2)
    await pool.start_kernel()
    await pool.start_kernel()

    with pytest.raises(RuntimeError, match="Max kernels"):
        await pool.start_kernel()


async def test_default_kernel_name(pool: KernelPool):
    kernel = await pool.start_kernel()
    assert kernel.name == settings.default_kernel_name


async def test_custom_kernel_name(pool: KernelPool):
    kernel = await pool.start_kernel(name="python3")
    assert kernel.name == "python3"
