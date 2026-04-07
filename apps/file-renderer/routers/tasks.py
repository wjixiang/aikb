"""
Task status API router

Provides endpoints for querying async task status and results.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_async_db
from models.document import TaskDetailResponse, TaskListResponse
from services import get_task_service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/tasks",
    tags=["tasks"],
)


def _task_to_response(task) -> TaskDetailResponse:
    return TaskDetailResponse(
        task_id=task.id,
        task_type=task.task_type,
        status=task.status,
        progress=task.progress,
        input_params=task.input_params,
        result=task.result,
        error_message=task.error_message,
        created_at=task.created_at,
        started_at=task.started_at,
        completed_at=task.completed_at,
    )


@router.get(
    "/{task_id}",
    response_model=TaskDetailResponse,
    summary="Get task status",
    description="Get the status and result of an async task",
)
async def get_task(
    task_id: str,
    db: AsyncSession = Depends(get_async_db),
):
    """Get task status and result by ID."""
    task_service = get_task_service()
    task = await task_service.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task not found: {task_id}")
    return _task_to_response(task)


@router.get(
    "",
    response_model=TaskListResponse,
    summary="List tasks",
    description="List tasks with optional filters",
)
async def list_tasks(
    task_type: Optional[str] = Query(None, description="Filter by task type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_async_db),
):
    """List tasks with optional type/status filters."""
    task_service = get_task_service()
    tasks, total = await task_service.list_tasks(
        db, task_type=task_type, status=status, limit=limit, offset=offset
    )
    return TaskListResponse(
        tasks=[_task_to_response(t) for t in tasks],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.delete(
    "/{task_id}",
    summary="Delete task",
    description="Delete a task record",
)
async def delete_task(
    task_id: str,
    db: AsyncSession = Depends(get_async_db),
):
    """Delete a task by ID."""
    task_service = get_task_service()
    task = await task_service.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task not found: {task_id}")
    await task_service.delete_task(db, task_id)
    return {"message": f"Task {task_id} deleted"}
