from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from jupyter_client import BlockingKernelClient, KernelManager

from jupyter_backend.config import settings

logger = logging.getLogger(__name__)


@dataclass
class ManagedKernel:
    kernel_id: str
    manager: KernelManager
    client: BlockingKernelClient
    name: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def is_alive(self) -> bool:
        return self.manager.is_alive()


class KernelPool:
    def __init__(self) -> None:
        self._kernels: dict[str, ManagedKernel] = {}
        self._lock = asyncio.Lock()

    @property
    def count(self) -> int:
        return len(self._kernels)

    async def start_kernel(self, name: str | None = None) -> ManagedKernel:
        async with self._lock:
            if self.count >= settings.max_kernels:
                raise RuntimeError(
                    f"Max kernels ({settings.max_kernels}) reached. "
                    f"Shutdown existing kernels first."
                )
            kernel_name = name or settings.default_kernel_name
            loop = asyncio.get_event_loop()
            managed = await loop.run_in_executor(None, self._start_kernel_sync, kernel_name)
            self._kernels[managed.kernel_id] = managed
            logger.info("Started kernel %s (%s)", managed.kernel_id, kernel_name)
            return managed

    def _start_kernel_sync(self, kernel_name: str) -> ManagedKernel:
        km = KernelManager(kernel_name=kernel_name)
        km.start_kernel()
        kc: BlockingKernelClient = km.client()
        kc.start_channels()
        kc.wait_for_ready(timeout=settings.kernel_startup_timeout)
        return ManagedKernel(
            kernel_id=str(uuid.uuid4()),
            manager=km,
            client=kc,
            name=kernel_name,
        )

    def get_kernel(self, kernel_id: str) -> ManagedKernel | None:
        kernel = self._kernels.get(kernel_id)
        if kernel is not None and not kernel.is_alive:
            logger.warning("Kernel %s is dead, removing", kernel_id)
            self._remove_kernel_sync(kernel_id)
            return None
        return kernel

    def _remove_kernel_sync(self, kernel_id: str) -> None:
        kernel = self._kernels.pop(kernel_id, None)
        if kernel is not None:
            try:
                kernel.client.stop_channels()
                kernel.manager.shutdown_kernel(now=True)
            except Exception:
                logger.exception("Error shutting down kernel %s", kernel_id)

    async def shutdown_kernel(self, kernel_id: str) -> bool:
        async with self._lock:
            kernel = self._kernels.pop(kernel_id, None)
            if kernel is None:
                return False
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, self._shutdown_kernel_sync, kernel)
            logger.info("Shutdown kernel %s", kernel_id)
            return True

    @staticmethod
    def _shutdown_kernel_sync(kernel: ManagedKernel) -> None:
        try:
            kernel.client.stop_channels()
            kernel.manager.shutdown_kernel()
        except Exception:
            logger.exception("Error shutting down kernel %s", kernel.kernel_id)

    async def restart_kernel(self, kernel_id: str) -> ManagedKernel | None:
        async with self._lock:
            kernel = self._kernels.get(kernel_id)
            if kernel is None:
                return None
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, self._restart_kernel_sync, kernel)
            logger.info("Restarted kernel %s", kernel_id)
            return kernel

    @staticmethod
    def _restart_kernel_sync(kernel: ManagedKernel) -> None:
        kernel.manager.restart_kernel(now=True)
        kernel.client.wait_for_ready(timeout=settings.kernel_startup_timeout)

    async def interrupt_kernel(self, kernel_id: str) -> bool:
        kernel = self.get_kernel(kernel_id)
        if kernel is None:
            return False
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, kernel.manager.interrupt_kernel)
        logger.info("Interrupted kernel %s", kernel_id)
        return True

    async def list_kernels(self) -> list[ManagedKernel]:
        dead_ids = [kid for kid, k in self._kernels.items() if not k.is_alive]
        for kid in dead_ids:
            self._remove_kernel_sync(kid)
            logger.warning("Removed dead kernel %s", kid)
        return list(self._kernels.values())

    async def shutdown_all(self) -> None:
        async with self._lock:
            kernel_ids = list(self._kernels.keys())
            if not kernel_ids:
                return
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: [self._remove_kernel_sync(kid) for kid in kernel_ids],
            )
            logger.info("Shutdown all %d kernels", len(kernel_ids))


kernel_pool = KernelPool()
