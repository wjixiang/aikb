#!/usr/bin/env python3
"""
spark_sql_runner.py — PySpark SQL runner for DNAnexus dxspark App.

For dxspark apps (interpreter: python3):
  - DNAnexus runs this script on the Spark **driver node**
  - Input files are automatically downloaded to /home/dnanexus/in/{input_name}/
  - pyspark is available via execDepends
  - SparkSession.builder.getOrCreate() connects to the dxspark cluster Hive Metastore

Arguments (positional, from DNAnexus python3 app invocation):
  $1  entry point name ('main') — ignored
  $2  sqlfile local path
  $3  substitutions local path (optional)
  $4  database_name
  $5  export ('true'/'false')
  $6  export_options local path (optional)
  $7  collect_logs ('true'/'false')
  $8  executor_memory
  $9  executor_cores
  $10 driver_memory
  $11 log_level
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

import pyspark


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("entry", nargs="?", default="main")   # $1 — ignored
    parser.add_argument("sqlfile", nargs="?", default=None)   # $2
    parser.add_argument("substitutions", nargs="?", default=None)  # $3
    parser.add_argument("database_name", nargs="?", default="")  # $4
    parser.add_argument("export", nargs="?", default="false")  # $5
    parser.add_argument("export_options", nargs="?", default=None)  # $6
    parser.add_argument("collect_logs", nargs="?", default="false")  # $7
    parser.add_argument("executor_memory", nargs="?", default="4g")  # $8
    parser.add_argument("executor_cores", nargs="?", default="2")  # $9
    parser.add_argument("driver_memory", nargs="?", default="4g")  # $10
    parser.add_argument("log_level", nargs="?", default="WARN")  # $11
    return parser.parse_args()


def read_file(path: str) -> str:
    if not path or not os.path.exists(path):
        return ""
    with open(path, encoding="utf-8") as f:
        return f.read()


def parse_sql(content: str):
    statements = []
    for line in content.splitlines():
        line = re.sub(r"--.*", "", line).strip()
        if line:
            statements.append(line)
    return statements


def substitute(sql: str, subs: dict) -> str:
    for k, v in subs.items():
        sql = sql.replace(f"${{{k}}}", str(v))
    return sql


def copy_hdfs_to_local(hdfs_dir: str, local_dir: str):
    """Recursively copy HDFS directory contents to local filesystem."""
    import pydoop.hdfs as hdfs
    Path(local_dir).mkdir(parents=True, exist_ok=True)
    try:
        for entry in hdfs.ls(hdfs_dir):
            if hdfs.path.isdir(entry):
                copy_hdfs_to_local(entry, local_dir)
            elif "part-" in entry:
                fname = Path(entry).name
                out_path = Path(local_dir) / fname
                with hdfs.open(entry, "rt") as hf:
                    content = hf.read()
                with open(out_path, "w") as lf:
                    lf.write(content)
                print(f"  Copied: {fname}")
    except Exception as e:
        print(f"[WARN] HDFS copy failed: {e}")


def main():
    args = parse_args()

    print("=" * 60)
    print("spark_sql_runner.py starting")
    print(f"  sqlfile:          {args.sqlfile}")
    print(f"  substitutions:    {args.substitutions}")
    print(f"  database_name:    {args.database_name}")
    print(f"  export:           {args.export}")
    print(f"  export_options:  {args.export_options}")
    print(f"  executor_memory:  {args.executor_memory}")
    print(f"  executor_cores:  {args.executor_cores}")
    print(f"  driver_memory:   {args.driver_memory}")
    print(f"  log_level:       {args.log_level}")
    print("=" * 60)

    # Verify sqlfile exists
    if not args.sqlfile or not os.path.exists(args.sqlfile):
        raise RuntimeError(f"SQL file not found: {args.sqlfile}")

    sql_content = read_file(args.sqlfile)
    statements = parse_sql(sql_content)
    if not statements:
        raise RuntimeError("SQL file contains no executable statements")
    print(f"Loaded {len(statements)} statement(s)")

    # Load substitutions
    substitutions = {}
    if args.substitutions and os.path.exists(args.substitutions):
        try:
            substitutions = json.loads(read_file(args.substitutions))
            print(f"Substitutions: {list(substitutions.keys())}")
        except Exception as e:
            print(f"[WARN] Substitutions load failed: {e}")

    # Load export options
    do_export = args.export.lower() == "true"
    export_config = {"num_files": 1, "fileprefix": "result", "header": True}
    if do_export and args.export_options and os.path.exists(args.export_options):
        try:
            export_config = json.loads(read_file(args.export_options))
            print(f"Export config: {export_config}")
        except Exception as e:
            print(f"[WARN] Export options load failed: {e}")

    # Log level for pyspark
    log_level_map = {"WARN": "WARN", "INFO": "INFO", "DEBUG": "DEBUG", "TRACE": "TRACE"}
    pyspark_log_level = log_level_map.get(args.log_level, "WARN")

    # Create Spark session
    # For dxspark, getOrCreate() connects to the cluster Hive Metastore
    print("Creating SparkSession...")
    spark = (
        pyspark.sql.SparkSession.builder
        .appName("spark-sql-runner")
        .enableHiveSupport()
        .config("spark.driver.memory", args.driver_memory)
        .config("spark.executor.memory", args.executor_memory)
        .config("spark.executor.cores", args.executor_cores)
        .config("spark.sql.adaptive.enabled", "true")
        .config("spark.sql.adaptive.coalescePartitions.enabled", "true")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel(pyspark_log_level)
    print(f"Spark version: {spark.version}")
    if spark.sparkContext.uiWebUrl:
        print(f"Spark UI: {spark.sparkContext.uiWebUrl}")

    # Set database
    if args.database_name:
        print(f"Using database: {args.database_name}")
        spark.sql(f"USE {args.database_name}")

    # HDFS export base
    hdfs_export = "/hdfs/spark_sql_runner/export"
    hdfs_export_results = f"{hdfs_export}/results"

    report = {
        "app": "spark-sql-runner",
        "started_at": datetime.utcnow().isoformat(),
        "database": args.database_name or None,
        "export": do_export,
        "export_options": export_config if do_export else None,
        "statements": [],
        "summary": {"total": len(statements), "success": 0, "failed": 0},
    }

    if do_export:
        # Clear previous export
        try:
            fs = spark.sparkContext._jvm.org.apache.hadoop.fs.FileSystem.get(
                spark.sparkContext._jsc.hadoopConfiguration()
            )
            fs.delete(spark.sparkContext._jvm.org.apache.hadoop.fs.Path(hdfs_export), True)
        except Exception:
            pass

    # Execute statements
    for idx, raw_sql in enumerate(statements):
        stmt = {
            "index": idx,
            "sql": raw_sql[:100],
            "status": "pending",
            "duration_seconds": None,
            "error": None,
        }
        start = time.time()
        sql = substitute(raw_sql, substitutions)
        print(f"\n[{idx+1}/{len(statements)}] {sql[:80]}{'...' if len(sql) > 80 else ''}")

        try:
            result_df = spark.sql(sql)
            is_query = sql.strip().upper().startswith(
                ("SELECT", "SHOW", "DESCRIBE", "WITH")
            )

            if is_query:
                row_count = result_df.count()
                duration = time.time() - start
                stmt["status"] = "success"
                stmt["row_count"] = row_count
                stmt["duration_seconds"] = round(duration, 3)
                print(f"  -> OK, {row_count} rows in {duration:.3f}s")

                if do_export:
                    prefix = export_config.get("fileprefix", "result")
                    header = export_config.get("header", True)
                    out_path = f"{hdfs_export_results}/{prefix}-{idx}"
                    print(f"  Exporting to HDFS: {out_path}")
                    (result_df
                        .write
                        .mode("overwrite")
                        .option("header", str(header).lower())
                        .csv(out_path))
                    stmt["exported_hdfs"] = out_path
            else:
                duration = time.time() - start
                stmt["status"] = "success"
                stmt["duration_seconds"] = round(duration, 3)
                print(f"  -> OK (DML/DDL) in {duration:.3f}s")

            report["summary"]["success"] += 1

        except Exception as e:
            duration = time.time() - start
            stmt["status"] = "failed"
            stmt["duration_seconds"] = round(duration, 3)
            stmt["error"] = str(e)
            print(f"  -> FAILED: {e}")
            report["summary"]["failed"] += 1
            break

        report["statements"].append(stmt)

    # Finalize report
    report["finished_at"] = datetime.utcnow().isoformat()
    total_dur = sum(s["duration_seconds"] or 0 for s in report["statements"])
    report["total_duration_seconds"] = round(total_dur, 3)

    print("\n" + "=" * 60)
    print("SUMMARY")
    print(f"  Total:    {report['summary']['total']}")
    print(f"  Success:  {report['summary']['success']}")
    print(f"  Failed:   {report['summary']['failed']}")
    print(f"  Duration: {report['total_duration_seconds']}s")
    print("=" * 60)

    # Write report
    Path("/home/dnanexus/out").mkdir(parents=True, exist_ok=True)
    report_path = "/home/dnanexus/out/report"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2, default=str)
    print(f"Report: {report_path}")

    # Copy HDFS export to local
    if do_export:
        local_export = "/home/dnanexus/out/export_output"
        print(f"\nCopying HDFS export from {hdfs_export_results} to {local_export}...")
        copy_hdfs_to_local(hdfs_export_results, local_export)
        Path(local_export).mkdir(parents=True, exist_ok=True)
        Path(local_export, "_EXPORT_COMPLETE").touch()

    spark.stop()
    print("Done.")


if __name__ == "__main__":
    main()
