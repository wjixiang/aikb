"""
Task service - async task orchestration with background execution.

Manages task lifecycle: create → submit → execute (background) → query status/results.
Blocking operations (Docling conversion, S3 I/O) run in ThreadPoolExecutor.
"""

import asyncio
import logging
import tempfile
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy import select, func, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models.database import Task, SyncSessionLocal, AsyncSessionLocal
from services.conversion_service import get_conversion_service
from services.chunking_service import get_chunking_service
from services.s3_storage_service import get_s3_storage_service
from services.file_service import get_file_service
from lib.s3_key_generator import derive_output_key

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=settings.task.max_workers)


class TaskService:
    """Async task orchestration service"""

    # --- CRUD (async, for FastAPI endpoints) ---

    async def create_task(
        self,
        db: AsyncSession,
        task_type: str,
        input_params: dict,
    ) -> Task:
        """Create a new task record."""
        task = Task(
            task_type=task_type,
            status="pending",
            input_params=input_params,
        )
        db.add(task)
        await db.commit()
        await db.refresh(task)
        logger.info(f"Task created: {task.id} (type={task_type})")
        return task

    async def get_task(self, db: AsyncSession, task_id: str) -> Optional[Task]:
        """Get task by ID."""
        result = await db.execute(select(Task).where(Task.id == task_id))
        return result.scalar_one_or_none()

    async def list_tasks(
        self,
        db: AsyncSession,
        task_type: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Task], int]:
        """List tasks with optional filters. Returns (tasks, total_count)."""
        query = select(Task)
        count_query = select(func.count(Task.id))

        if task_type:
            query = query.where(Task.task_type == task_type)
            count_query = count_query.where(Task.task_type == task_type)
        if status:
            query = query.where(Task.status == status)
            count_query = count_query.where(Task.status == status)

        total = (await db.execute(count_query)).scalar() or 0

        query = query.order_by(Task.created_at.desc()).offset(offset).limit(limit)
        tasks = list((await db.execute(query)).scalars().all())

        return tasks, total

    async def delete_task(self, db: AsyncSession, task_id: str) -> bool:
        """Delete a task. Returns True if found and deleted."""
        await db.execute(sa_delete(Task).where(Task.id == task_id))
        await db.commit()
        return True

    # --- Background execution ---

    def submit_task(self, task_id: str) -> None:
        """Fire off background execution. Non-blocking."""
        asyncio.create_task(self._execute_task(task_id))

    async def _execute_task(self, task_id: str) -> None:
        """Background coroutine: update status, run in executor, store result."""
        logger.info(f"Task execution started: {task_id}")

        async with AsyncSessionLocal() as db:
            task = await self.get_task(db, task_id)
            if not task:
                logger.error(f"Task not found: {task_id}")
                return

            task.status = "processing"
            task.started_at = datetime.now(timezone.utc)
            await db.commit()

            try:
                loop = asyncio.get_running_loop()

                if task.task_type == "conversion":
                    result = await loop.run_in_executor(
                        _executor,
                        _sync_run_conversion,
                        task.input_params,
                    )
                elif task.task_type == "chunking":
                    result = await loop.run_in_executor(
                        _executor,
                        _sync_run_chunking,
                        task.input_params,
                    )
                else:
                    raise ValueError(f"Unknown task type: {task.task_type}")

                task.status = "completed"
                task.result = result
                task.progress = 100.0
                task.completed_at = datetime.now(timezone.utc)
                await db.commit()
                logger.info(f"Task completed: {task_id}")

            except Exception as e:
                logger.error(f"Task {task_id} failed: {e}", exc_info=True)
                task.status = "failed"
                task.error_message = str(e)
                task.completed_at = datetime.now(timezone.utc)
                await db.commit()


# --- Sync runners (executed inside ThreadPoolExecutor) ---


def _sync_run_conversion(input_params: dict) -> dict:
    """Synchronous conversion: S3/local → Docling → S3. Runs in thread."""
    conversion_service = get_conversion_service()
    s3_service = get_s3_storage_service()
    file_service = get_file_service()

    source = input_params.get("source", "file_id")
    output_format = input_params.get("output_format", "markdown")
    enable_ocr = input_params.get("enable_ocr")
    store_in_s3 = input_params.get("store_in_s3", False)

    tmp_path = None
    try:
        if source == "s3_key":
            s3_key = input_params["s3_key"]
            tmp_path = tempfile.mktemp(suffix=".pdf")
            s3_service.download_to_file(s3_key, tmp_path)
            file_path = tmp_path
        elif source == "file_id":
            file_id = input_params["file_id"]
            file_path = file_service.get_file_path(file_id)
            if not file_path:
                raise FileNotFoundError(f"File not found: {file_id}")
        elif source == "file_path":
            file_path = input_params["file_path"]
        else:
            raise ValueError(f"Unknown source type: {source}")

        content, metadata = conversion_service.convert_document(
            file_path=file_path,
            output_format=output_format,
            enable_ocr=enable_ocr,
        )

        result = {
            "content": content,
            "metadata": metadata,
            "output_format": output_format,
        }

        if store_in_s3 and source == "s3_key":
            output_s3_key = input_params.get(
                "output_s3_key"
            ) or derive_output_key(input_params["s3_key"], output_format)
            content_type_map = {
                "markdown": "text/markdown",
                "text": "text/plain",
                "json": "application/json",
            }
            s3_service.upload(
                data=content,
                key=output_s3_key,
                content_type=content_type_map.get(output_format, "application/octet-stream"),
            )
            result["output_s3_key"] = output_s3_key
            try:
                result["presigned_url"] = s3_service.get_presigned_url(output_s3_key)
            except Exception:
                pass

        return result

    finally:
        if tmp_path:
            Path(tmp_path).unlink(missing_ok=True)


def _sync_run_chunking(input_params: dict) -> dict:
    """Synchronous chunking. Runs in thread."""
    chunking_service = get_chunking_service()

    text = input_params.get("text", "")
    strategy = input_params.get("strategy", "fixed")
    chunk_size = input_params.get("chunk_size")
    chunk_overlap = input_params.get("chunk_overlap")

    chunks, metadata = chunking_service.chunk_text(
        text=text,
        strategy=strategy,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )

    return {
        "chunks": chunks,
        "chunk_count": len(chunks),
        "metadata": metadata,
    }


# Singleton
_task_service: Optional[TaskService] = None


def get_task_service() -> TaskService:
    """Get or create task service singleton"""
    global _task_service
    if _task_service is None:
        _task_service = TaskService()
    return _task_service
