from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum

import polars as pl
import pyarrow as pa
from pydantic import BaseModel
from .catalog import get_catalog, scan_table

__all__ = [
    "StudyStatus",
    "AnalysisStatus",
    "STUDY_RECORD_SCHEMA",
    "ANALYSIS_RECORD_SCHEMA",
    "create_study_if_not_exist",
    "get_study",
    "list_studies",
    "update_study",
    "delete_study",
    "create_analysis",
    "get_analysis",
    "list_analyses",
    "update_analysis",
    "delete_analysis",
]

STUDY_NAME_SPACE = "study"
STUDY_RECORD_TABLE = "study.study_record"
ANALYSIS_RECORD_TABLE = "study.analysis_record"

"""
Status Machine
```
stateDiagram-v2
    [*] --> Draft: 创建研究
    Draft --> Active: 启动
    Active --> Paused: 暂停
    Paused --> Active: 恢复
    Active --> Completed: 正常结束
    Active --> Failed: 异常结束
    Completed --> [*]
    Failed --> Active: 重试
    Failed --> [*]

    note right of Draft: 规划阶段，尚未投入资源
    note right of Active: 正在执行分析
    note right of Paused: 资源不足或等待数据
    note right of Completed: 全部成果已归档
```
"""


class StudyStatus(str, Enum):
    """研究的完整生命周期状态"""

    # --- 核心状态 ---
    DRAFT = "DRAFT"  # 规划中，尚未正式启动
    ACTIVE = "ACTIVE"  # 执行中
    PAUSED = "PAUSED"  # 暂停（资源不足/等待数据/手动暂停）
    COMPLETED = "COMPLETED"  # 全部分析完成
    FAILED = "FAILED"  # 失败（不可恢复）
    ABANDONED = "ABANDONED"  # 放弃（手动终止）

    # --- 辅助状态（子状态） ---
    PENDING = "PENDING"  # 等待调度
    RUNNING = "RUNNING"  # 正在运行


class AnalysisStatus(str, Enum):
    """分析任务的完整生命周期"""

    REGISTERED = "REGISTERED"  # 已注册，待调度
    PENDING = "PENDING"  # 等待资源
    RUNNING = "RUNNING"  # 执行中
    COMPLETED = "COMPLETED"  # 成功完成
    FAILED = "FAILED"  # 执行失败
    CANCELLED = "CANCELLED"  # 被取消
    SKIPPED = "SKIPPED"  # 跳过（前置依赖失败）

    # --- 长期保留的中间状态 ---
    CHECKPOINT = "CHECKPOINT"  # 检查点（人工复核点）


"""
Schema
"""

STUDY_RECORD_SCHEMA = pa.schema(
    [
        # --- 身份 ---
        pa.field("id", pa.string(), nullable=False),
        pa.field("study_name", pa.string(), nullable=False),
        pa.field("describe", pa.string(), nullable=True),
        # --- 状态机 ---
        pa.field("status", pa.string(), nullable=False),
        # --- 审计 ---
        pa.field("create_ts", pa.timestamp("us", "UTC"), nullable=False),
        pa.field("update_ts", pa.timestamp("us", "UTC"), nullable=False),
        pa.field("activate_ts", pa.timestamp("us", "UTC"), nullable=True),
        pa.field("complete_ts", pa.timestamp("us", "UTC"), nullable=True),
        pa.field("create_by", pa.string(), nullable=True),
    ]
)

ANALYSIS_RECORD_SCHEMA = pa.schema(
    [
        # --- 身份 ---
        pa.field("id", pa.string(), nullable=False),
        pa.field("study_id", pa.string(), nullable=False),
        pa.field("describe", pa.string(), nullable=True),
        # --- 状态机 ---
        pa.field("status", pa.string(), nullable=False),
        # --- 审计 ---
        pa.field("create_ts", pa.timestamp("us", "UTC"), nullable=False),
        pa.field("update_ts", pa.timestamp("us", "UTC"), nullable=False),
        pa.field("activate_ts", pa.timestamp("us", "UTC"), nullable=True),
        pa.field("complete_ts", pa.timestamp("us", "UTC"), nullable=True),
        pa.field("create_by", pa.string(), nullable=True),
    ]
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_study_tables():
    catalog = get_catalog()
    catalog.create_namespace_if_not_exists(STUDY_NAME_SPACE)
    catalog.create_table_if_not_exists(STUDY_RECORD_TABLE, schema=STUDY_RECORD_SCHEMA)

    # Migrate old analysis table schema (study_name -> study_id) if needed
    try:
        existing = catalog.load_table(ANALYSIS_RECORD_TABLE)
        existing_schema = existing.schema()
        field_names = {f.name for f in existing_schema.fields}
        if "study_name" in field_names and "study_id" not in field_names:
            catalog.drop_table(ANALYSIS_RECORD_TABLE)
            catalog.create_table_if_not_exists(
                ANALYSIS_RECORD_TABLE, schema=ANALYSIS_RECORD_SCHEMA
            )
    except Exception:
        catalog.create_table_if_not_exists(
            ANALYSIS_RECORD_TABLE, schema=ANALYSIS_RECORD_SCHEMA
        )


# ── Study CRUD ──────────────────────────────────────────────


class Study(BaseModel):
    id: str
    study_name: str
    describe: str | None
    status: StudyStatus
    create_ts: datetime
    update_ts: datetime
    activate_ts: datetime | None
    complete_ts: datetime | None
    create_by: str | None


def create_study_if_not_exist(
    study_name: str,
    desc: str = "",
    create_by: str | None = None,
) -> Study:
    """
    Study entity management: create new Study record, return Study object

    :study_name: Serve as primary key of study record table, must be unique
    """
    _ensure_study_tables()

    study_tb = scan_table(STUDY_RECORD_TABLE)
    existed_rows = (
        study_tb.sql(f"SELECT * FROM self WHERE study_name = '{study_name}' LIMIT 1")
        .collect()
        .to_dicts()
    )

    if len(existed_rows) > 0:
        row = existed_rows[0]
        return Study(
            id=row["id"],
            study_name=row["study_name"],
            describe=row["describe"],
            status=StudyStatus(row["status"]),
            create_ts=row["create_ts"],
            update_ts=row["update_ts"],
            activate_ts=row["activate_ts"],
            complete_ts=row["complete_ts"],
            create_by=row["create_by"],
        )

    now = _now()
    study_id = str(uuid.uuid4())
    study = Study(
        id=study_id,
        study_name=study_name,
        describe=desc,
        status=StudyStatus.DRAFT,
        create_ts=now,
        update_ts=now,
        activate_ts=None,
        complete_ts=None,
        create_by=create_by,
    )
    record = study.model_dump()
    tb = get_catalog().load_table(STUDY_RECORD_TABLE)
    tb.append(pa.Table.from_pylist([record], schema=STUDY_RECORD_SCHEMA))
    return study


def get_study(study_id: str) -> dict | None:
    lf = scan_table(STUDY_RECORD_TABLE)
    rows = lf.filter(pl.col("id") == study_id).collect()
    if rows.is_empty():
        return None
    return rows.to_dicts()[0]


def list_studies(
    status: StudyStatus | None = None,
) -> list[dict]:
    lf = scan_table(STUDY_RECORD_TABLE)
    if status is not None:
        lf = lf.filter(pl.col("status") == status.value)
    return lf.sort("create_ts", descending=True).collect().to_dicts()


def update_study(
    study_id: str,
    *,
    study_name: str | None = None,
    describe: str | None = None,
    status: StudyStatus | None = None,
) -> bool:
    existing = get_study(study_id)
    if existing is None:
        return False
    now = _now()

    update_vals = {}
    if study_name is not None:
        update_vals["study_name"] = study_name
    if describe is not None:
        update_vals["describe"] = describe
    if status is not None:
        update_vals["status"] = status

    existing_study = Study(
        id=existing["id"],
        study_name=existing["study_name"],
        describe=existing["describe"],
        status=StudyStatus(existing["status"]),
        create_ts=existing["create_ts"],
        update_ts=now,
        activate_ts=existing["activate_ts"],
        complete_ts=existing["complete_ts"],
        create_by=existing["create_by"],
    )
    updated_study = existing_study.model_copy(update=update_vals)

    if status is not None:
        if status == StudyStatus.ACTIVE and existing["activate_ts"] is None:
            updated_study.activate_ts = now
        if status in (StudyStatus.COMPLETED, StudyStatus.ABANDONED):
            updated_study.complete_ts = now

    record = updated_study.model_dump()
    tb = get_catalog().load_table(STUDY_RECORD_TABLE)
    tb.append(pa.Table.from_pylist([record], schema=STUDY_RECORD_SCHEMA))
    return True


def delete_study(study_id: str) -> bool:
    tb = get_catalog().load_table(STUDY_RECORD_TABLE)
    tb.delete(f"id = '{study_id}'")
    return True


# ── Analysis CRUD ───────────────────────────────────────────


class Analysis(BaseModel):
    id: str
    study_id: str
    describe: str | None
    status: AnalysisStatus
    create_ts: datetime
    update_ts: datetime
    activate_ts: datetime | None
    complete_ts: datetime | None
    create_by: str | None


def create_analysis(
    study_id: str,
    desc: str = "",
    create_by: str | None = None,
) -> Analysis:
    _ensure_study_tables()
    now = _now()
    analysis_id = str(uuid.uuid4())
    analysis = Analysis(
        id=analysis_id,
        study_id=study_id,
        describe=desc,
        status=AnalysisStatus.REGISTERED,
        create_ts=now,
        update_ts=now,
        activate_ts=None,
        complete_ts=None,
        create_by=create_by,
    )
    record = analysis.model_dump()
    tb = get_catalog().load_table(ANALYSIS_RECORD_TABLE)
    tb.append(pa.Table.from_pylist([record], schema=ANALYSIS_RECORD_SCHEMA))
    return analysis


def get_analysis(analysis_id: str) -> dict | None:
    lf = scan_table(ANALYSIS_RECORD_TABLE)
    rows = lf.filter(pl.col("id") == analysis_id).collect()
    if rows.is_empty():
        return None
    return rows.to_dicts()[0]


def list_analyses(
    study_id: str | None = None,
    status: AnalysisStatus | None = None,
) -> list[dict]:
    lf = scan_table(ANALYSIS_RECORD_TABLE)
    if study_id is not None:
        lf = lf.filter(pl.col("study_id") == study_id)
    if status is not None:
        lf = lf.filter(pl.col("status") == status.value)
    return lf.sort("create_ts", descending=True).collect().to_dicts()


def update_analysis(
    analysis_id: str,
    *,
    describe: str | None = None,
    status: AnalysisStatus | None = None,
) -> bool:
    existing = get_analysis(analysis_id)
    if existing is None:
        return False
    now = _now()

    update_vals = {}
    if describe is not None:
        update_vals["describe"] = describe
    if status is not None:
        update_vals["status"] = status

    existing_analysis = Analysis(
        id=existing["id"],
        study_id=existing["study_id"],
        describe=existing["describe"],
        status=AnalysisStatus(existing["status"]),
        create_ts=existing["create_ts"],
        update_ts=now,
        activate_ts=existing["activate_ts"],
        complete_ts=existing["complete_ts"],
        create_by=existing["create_by"],
    )
    updated_analysis = existing_analysis.model_copy(update=update_vals)

    if status is not None:
        if status == AnalysisStatus.RUNNING and existing["activate_ts"] is None:
            updated_analysis.activate_ts = now
        if status in (
            AnalysisStatus.COMPLETED,
            AnalysisStatus.FAILED,
            AnalysisStatus.CANCELLED,
            AnalysisStatus.SKIPPED,
        ):
            updated_analysis.complete_ts = now

    record = updated_analysis.model_dump()
    tb = get_catalog().load_table(ANALYSIS_RECORD_TABLE)
    tb.append(pa.Table.from_pylist([record], schema=ANALYSIS_RECORD_SCHEMA))
    return True


def delete_analysis(analysis_id: str) -> bool:
    tb = get_catalog().load_table(ANALYSIS_RECORD_TABLE)
    tb.delete(f"id = '{analysis_id}'")
    return True
