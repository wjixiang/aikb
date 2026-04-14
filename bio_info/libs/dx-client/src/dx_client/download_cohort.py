#!/usr/bin/env python3
"""Download cohort data using extract_dataset + Spark.

Combines SQL generation and Spark job submission into a single command.

Usage:
    python download_cohort.py --cohort-id <cohort_record_id>
    python download_cohort.py --cohort-name "My Cohort"
    python download_cohort.py --cohort-id <id> --wait
"""

import argparse
import logging
import os
import subprocess
import sys
from pathlib import Path

import dxpy

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def convert_fields(fields: list[str]) -> list[str]:
    """将字段列表转换为 entity.field 格式。"""
    result = []
    for f in fields:
        if "$" in f:
            result.append(f.replace("$", "."))
        elif "." not in f:
            result.append(f"participant.{f}")
        else:
            result.append(f)
    return result


def get_cohort_fields(cohort_id: str) -> list[str]:
    """从 cohort record 获取所有关联字段。"""
    try:
        desc: dict = dxpy.describe(
            cohort_id, fields={"properties", "details"}, default_fields=True
        )
    except Exception as e:
        raise RuntimeError(f"Failed to describe cohort '{cohort_id}': {e}") from e

    details: dict = desc.get("details") or {}
    fields: list = details.get("fields", [])
    if not fields:
        raise RuntimeError(f"Cohort '{cohort_id}' has no associated fields.")
    return convert_fields(fields)


def find_cohort_in_project(project_id: str, name_pattern: str | None = None) -> dict:
    """在项目中查找 Cohort。"""
    try:
        results: list = list(
            dxpy.find_data_objects(
                project=project_id,
                type="record",
                name=name_pattern or "*",
                describe=True,
            )
        )
    except Exception as e:
        raise RuntimeError(
            f"Failed to find cohort in project '{project_id}': {e}"
        ) from e

    cohorts: list = [
        r for r in results if "CohortBrowser" in r["describe"].get("types", [])
    ]
    if not cohorts:
        raise RuntimeError(f"No cohort found in project '{project_id}'")
    return cohorts[0]["describe"]


def extract_dataset_sql(dataset_ref: str, field_name: str) -> str:
    """调用 dx extract_dataset 生成 SQL。"""
    cmd = [
        "dx",
        "extract_dataset",
        dataset_ref,
        "--fields",
        f"participant.{field_name}",
        "--sql",
        "-o",
        "-",
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"dx extract_dataset failed: {e.stderr}") from e


def submit_spark_submit(
    spark_app: str, sql: str, field_name: str, project_id: str
) -> str:
    """调用 dx-spark-submit 提交 Spark job。"""
    cmd = ["dx-spark-submit", spark_app, sql, field_name]
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, check=True, cwd="/"
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"dx-spark-submit failed: {e.stderr}") from e


def download_and_process(
    cohort_id: str | None = None,
    cohort_name: str | None = None,
    project_id: str | None = None,
    spark_app: str = "/pyspark_app.py",
    wait: bool = False,
) -> dict:
    """下载 cohort 数据并提交 Spark job。"""
    if project_id is None:
        project_id = os.environ.get("DX_PROJECT_CONTEXT_ID")
    if not project_id:
        raise ValueError("Must provide --project or set DX_PROJECT_CONTEXT_ID")

    if cohort_id is None and cohort_name is None:
        raise ValueError("Must provide --cohort-id or --cohort-name")

    cohort_desc: dict = {}
    if cohort_id:
        cohort_desc = dict(
            dxpy.describe(cohort_id, fields={"details"}, default_fields=True)
        )
        cohort_project = project_id
    else:
        assert cohort_name is not None
        cohort_info = find_cohort_in_project(project_id, cohort_name)
        cohort_id = cohort_info["id"]
        cohort_desc = cohort_info
        cohort_project = cohort_info.get("project", project_id)

    cohort_name_val = cohort_desc.get("name", "unnamed")
    logger.info("Using cohort: %s (%s)", cohort_id, cohort_name_val)

    assert cohort_id is not None
    fields = get_cohort_fields(cohort_id)
    logger.info("Cohort has %d fields", len(fields))

    dataset_record = cohort_desc.get("details", {}).get("dataset", {})
    if isinstance(dataset_record, dict) and "$dnanexus_link" in dataset_record:
        dataset_id = dataset_record["$dnanexus_link"].get("id", cohort_id)
    else:
        dataset_id = cohort_id
    dataset_ref = f"{project_id}:{dataset_id}"

    field_name = "all_fields"
    sql = extract_dataset_sql(dataset_ref, field_name)
    logger.info("Generated SQL with %d fields", len(fields))

    job_output = submit_spark_submit(spark_app, sql, field_name, project_id)
    logger.info("Spark job submitted: %s", job_output)

    result = {
        "cohort_id": cohort_id,
        "cohort_name": cohort_desc.get("name"),
        "field_count": len(fields),
        "dataset_ref": dataset_ref,
        "job_output": job_output,
    }

    if wait:
        logger.info("Waiting for Spark job to complete...")
        job_id = job_output.strip().split("\n")[-1] if job_output else None
        if job_id and job_id.startswith("job-"):
            job = dxpy.DXJob(job_id)
            job.wait_on_done()
            logger.info("Spark job completed")
            result["job_id"] = job_id

    return result


def main():
    parser = argparse.ArgumentParser(
        description="Download cohort data using extract_dataset + Spark"
    )
    parser.add_argument("--cohort-id", help="Cohort record ID (record-xxxx)")
    parser.add_argument("--cohort-name", help="Cohort name pattern")
    parser.add_argument(
        "--project", default=os.environ.get("DX_PROJECT_CONTEXT_ID"), help="Project ID"
    )
    parser.add_argument("--spark-app", default="/pyspark_app.py", help="Spark app path")
    parser.add_argument(
        "--wait", action="store_true", help="Wait for Spark job to complete"
    )

    args = parser.parse_args()

    try:
        result = download_and_process(
            cohort_id=args.cohort_id,
            cohort_name=args.cohort_name,
            project_id=args.project,
            spark_app=args.spark_app,
            wait=args.wait,
        )
        print(result)
    except Exception as e:
        logger.error("Error: %s", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
