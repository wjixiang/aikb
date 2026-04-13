#!/usr/bin/env bash
# spark_sql_runner.sh — DNAnexus dxspark App entry point
#
# IMPORTANT: For dxspark apps, ONLY the entry point script (runSpec.file) is
# deployed to the driver node. The resources/ directory is NOT extracted.
# Solution: embed the Python code inline and write it to a temp file before
# calling spark-submit.

set -e -o pipefail

echo "=== spark-sql-runner starting ==="
date
echo "Key environment variables:"
echo "  sqlfile:           '${sqlfile:-not set}'"
echo "  substitutions:     '${substitutions:-not set}'"
echo "  database_name:   '${database_name:-not set}'"
echo "  export:           '${export:-not set}'"
echo "  export_options:   '${export_options:-not set}'"
echo "  collect_logs:     '${collect_logs:-not set}'"
echo "  executor_memory:  '${executor_memory:-not set}'"
echo "  executor_cores:   '${executor_cores:-not set}'"
echo "  driver_memory:    '${driver_memory:-not set}'"
echo "  log_level:        '${log_level:-not set}'"
echo ""
echo "HADOOP_HOME: ${HADOOP_HOME:-not set}"
echo "SPARK_HOME:  ${SPARK_HOME:-not set}"

# ── Parse inputs ─────────────────────────────────────────────────────────
SQLFILE_ID="${sqlfile:-}"
SUBSTITUTIONS_ID="${substitutions:-}"
DATABASE_NAME="${database_name:-}"
EXPORT="${export:-false}"
EXPORT_OPTIONS_ID="${export_options:-}"
COLLECT_LOGS="${collect_logs:-false}"
EXECUTOR_MEMORY="${executor_memory:-4g}"
EXECUTOR_CORES="${executor_cores:-2}"
DRIVER_MEMORY="${driver_memory:-4g}"
LOG_LEVEL="${log_level:-WARN}"

echo "Parsed inputs:"
echo "  sqlfile:          $SQLFILE_ID"
echo "  database_name:  $DATABASE_NAME"
echo "  export:         $EXPORT"
echo "  executor_memory: $EXECUTOR_MEMORY"
echo "  executor_cores: $EXECUTOR_CORES"
echo "  driver_memory:  $DRIVER_MEMORY"
echo "  log_level:     $LOG_LEVEL"

# ── Download input files ────────────────────────────────────────────────────
echo ""
echo "=== Downloading input files ==="

mkdir -p /home/dnanexus/in/sqlfile
if [ -n "$SQLFILE_ID" ]; then
    echo "Downloading sqlfile: $SQLFILE_ID"
    dx download "$SQLFILE_ID" -o /home/dnanexus/in/sqlfile/query.sql
    SQLFILE_LOCAL="/home/dnanexus/in/sqlfile/query.sql"
else
    echo "ERROR: No sqlfile provided"
    exit 1
fi

SUBSTITUTIONS_LOCAL=""
if [ -n "$SUBSTITUTIONS_ID" ]; then
    mkdir -p /home/dnanexus/in/substitutions
    echo "Downloading substitutions: $SUBSTITUTIONS_ID"
    dx download "$SUBSTITUTIONS_ID" -o /home/dnanexus/in/substitutions/subs.json
    SUBSTITUTIONS_LOCAL="/home/dnanexus/in/substitutions/subs.json"
fi

EXPORT_OPTIONS_LOCAL=""
if [ -n "$EXPORT_OPTIONS_ID" ]; then
    mkdir -p /home/dnanexus/in/export_options
    echo "Downloading export_options: $EXPORT_OPTIONS_ID"
    dx download "$EXPORT_OPTIONS_ID" -o /home/dnanexus/in/export_options/opts.json
    EXPORT_OPTIONS_LOCAL="/home/dnanexus/in/export_options/opts.json"
fi

# ── Distribute SQL file to HDFS ──────────────────────────────────────────────
HDFS_BASE="/hdfs/spark_sql_runner"
HDFS_SQL="$HDFS_BASE/query.sql"
HADOOP_CMD="$HADOOP_HOME/bin/hadoop fs"

echo ""
echo "=== Distributing SQL to HDFS ==="
$HADOOP_CMD -mkdir -p "$HDFS_BASE"
echo "SQL content:"
cat "$SQLFILE_LOCAL"
echo "---"
$HADOOP_CMD -put -f "$SQLFILE_LOCAL" "$HDFS_SQL"

# ── Prepare outputs ─────────────────────────────────────────────────────────
mkdir -p /home/dnanexus/out/export_output

# ── Write Python script to temp file ────────────────────────────────────────────
PYTHON_APP="/tmp/spark_sql_runner.py"
cat > "$PYTHON_APP" << 'PYEOF'
#!/usr/bin/env python3
"""spark_sql_runner.py — PySpark SQL runner for DNAnexus dxspark App."""

import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import pyspark


def read_file(path):
    if not path or not os.path.exists(path):
        return ""
    with open(path, encoding="utf-8") as f:
        return f.read()


def parse_sql(content):
    stmts = []
    for line in content.splitlines():
        line = re.sub(r"--.*", "", line).strip()
        if line:
            stmts.append(line)
    return stmts


def substitute(sql, subs):
    for k, v in subs.items():
        sql = sql.replace(f"${{{k}}}", str(v))
    return sql


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--hdfs-sql", required=True)
    parser.add_argument("--export", default="false")
    parser.add_argument("--output-dir", default="/home/dnanexus/out/export_output")
    parser.add_argument("--database", default="")
    parser.add_argument("--substitutions", default=None)
    parser.add_argument("--export-options", default=None)
    parser.add_argument("--collect-logs", action="store_true")
    parser.add_argument("--log-level", default="WARN")
    args = parser.parse_args()

    print("=" * 60)
    print("spark_sql_runner.py starting")
    print(f"  hdfs_sql:       {args.hdfs_sql}")
    print(f"  database:       {args.database}")
    print(f"  export:          {args.export}")
    print("=" * 60)

    # Create Spark session FIRST (needed to read from HDFS)
    print("Creating SparkSession...")
    spark = (
        pyspark.sql.SparkSession.builder
        .appName("spark-sql-runner")
        .enableHiveSupport()
        .config("spark.driver.memory", os.environ.get("DRIVER_MEMORY", "4g"))
        .config("spark.executor.memory", os.environ.get("EXECUTOR_MEMORY", "4g"))
        .config("spark.executor.cores", os.environ.get("EXECUTOR_CORES", "2"))
        .config("spark.sql.adaptive.enabled", "true")
        .config("spark.sql.adaptive.coalescePartitions.enabled", "true")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel(args.log_level or "WARN")
    print(f"Spark version: {spark.version}")

    # Read SQL from HDFS via Spark
    sql_rows = spark.read.text(args.hdfs_sql).collect()
    sql_content = "\n".join(row[0] for row in sql_rows)
    statements = parse_sql(sql_content)
    if not statements:
        raise RuntimeError("SQL file has no executable statements")
    print(f"Loaded {len(statements)} statement(s)")

    # Substitutions
    subs = {}
    if args.substitutions and os.path.exists(args.substitutions):
        try:
            subs = json.loads(read_file(args.substitutions))
            print(f"Substitutions: {list(subs.keys())}")
        except Exception as e:
            print(f"[WARN] Substitutions load failed: {e}")

    # Export options
    do_export = args.export.lower() == "true"
    export_config = {"num_files": 1, "fileprefix": "result", "header": True}
    if do_export and args.export_options and os.path.exists(args.export_options):
        try:
            export_config = json.loads(read_file(args.export_options))
            print(f"Export config: {export_config}")
        except Exception as e:
            print(f"[WARN] Export options load failed: {e}")

    # Use database
    if args.database:
        print(f"Using database: {args.database}")
        spark.sql(f"USE {args.database}")

    # Execute
    hdfs_export = "/hdfs/spark_sql_runner/export"
    report = {
        "app": "spark-sql-runner",
        "started_at": datetime.utcnow().isoformat(),
        "database": args.database or None,
        "export": do_export,
        "statements": [],
        "summary": {"total": len(statements), "success": 0, "failed": 0},
    }

    if do_export:
        try:
            fs = spark.sparkContext._jvm.org.apache.hadoop.fs.FileSystem.get(
                spark.sparkContext._jsc.hadoopConfiguration()
            )
            fs.delete(spark.sparkContext._jvm.org.apache.hadoop.fs.Path(hdfs_export), True)
        except Exception:
            pass

    for idx, raw_sql in enumerate(statements):
        stmt = {"index": idx, "sql": raw_sql[:100], "status": "pending",
               "duration_seconds": None, "error": None}
        start = time.time()
        sql = substitute(raw_sql, subs)
        print(f"\n[{idx+1}/{len(statements)}] {sql[:80]}{'...' if len(sql) > 80 else ''}")

        try:
            result_df = spark.sql(sql)
            is_query = sql.strip().upper().startswith(("SELECT", "SHOW", "DESCRIBE", "WITH"))

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
                    out_path = f"{hdfs_export}/{prefix}-{idx}"
                    print(f"  Exporting to HDFS: {out_path}")
                    (result_df.write.mode("overwrite")
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

    report["finished_at"] = datetime.utcnow().isoformat()
    report["total_duration_seconds"] = round(
        sum(s["duration_seconds"] or 0 for s in report["statements"]), 3)

    print("\n" + "=" * 60)
    print("SUMMARY")
    print(f"  Total:    {report['summary']['total']}")
    print(f"  Success:  {report['summary']['success']}")
    print(f"  Failed:   {report['summary']['failed']}")
    print(f"  Duration: {report['total_duration_seconds']}s")
    print("=" * 60)

    # Write report
    Path("/home/dnanexus/out").mkdir(parents=True, exist_ok=True)
    with open("/home/dnanexus/out/report", "w") as f:
        json.dump(report, f, indent=2, default=str)
    print("Report written.")

    spark.stop()
    print("Done.")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"FATAL ERROR in main(): {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        # Write error report
        Path("/home/dnanexus/out").mkdir(parents=True, exist_ok=True)
        with open("/home/dnanexus/out/report", "w") as f:
            json.dump({"app": "spark-sql-runner", "error": str(e), "traceback": traceback.format_exc()}, f, indent=2)
        sys.exit(1)
PYEOF

echo "Python script written to $PYTHON_APP ($(wc -c < "$PYTHON_APP") bytes)"

# ── Build spark-submit command ──────────────────────────────────────────
echo ""
echo "=== Running spark-submit ==="

SPARK_ARGS=(
    --executor-memory "$EXECUTOR_MEMORY"
    --executor-cores "$EXECUTOR_CORES"
    --driver-memory "$DRIVER_MEMORY"
    --conf spark.sql.adaptive.enabled=true
    --conf spark.sql.adaptive.coalescePartitions.enabled=true
)

PYTHON_ARGS=(
    --hdfs-sql "$HDFS_SQL"
    --export "$EXPORT"
    --output-dir "/home/dnanexus/out/export_output"
    --database "$DATABASE_NAME"
)
[ -n "$SUBSTITUTIONS_LOCAL" ]   && PYTHON_ARGS+=(--substitutions "$SUBSTITUTIONS_LOCAL")
[ -n "$EXPORT_OPTIONS_LOCAL" ] && PYTHON_ARGS+=(--export-options "$EXPORT_OPTIONS_LOCAL")
[ "$COLLECT_LOGS" = "true" ]  && PYTHON_ARGS+=(--collect-logs)
PYTHON_ARGS+=(--log-level "${LOG_LEVEL}")

echo "spark-submit ${SPARK_ARGS[*]} $PYTHON_APP ${PYTHON_ARGS[*]}"

set +e
"$SPARK_HOME/bin/spark-submit" "${SPARK_ARGS[@]}" "$PYTHON_APP" "${PYTHON_ARGS[@]}"
SPARK_EXIT=$?
set -e

echo ""
echo "spark-submit exited with code: $SPARK_EXIT"
echo "Files in /home/dnanexus/out/:"
ls -la /home/dnanexus/out/ 2>/dev/null || echo "  (directory empty or not found)"

# ── Download exported CSV from HDFS to local ────────────────────────────────
if [ "$SPARK_EXIT" -eq 0 ] && [ "$EXPORT" = "true" ]; then
    HDFS_EXPORT="/hdfs/spark_sql_runner/export"
    echo ""
    echo "=== Downloading exported CSV from HDFS ==="
    if $HADOOP_CMD -test -d "$HDFS_EXPORT" 2>/dev/null; then
        $HADOOP_CMD -get "$HDFS_EXPORT" /home/dnanexus/out/export_output/ 2>/dev/null || echo "WARN: HDFS get failed or no files to download"
        echo "Exported files:"
        ls -la /home/dnanexus/out/export_output/ 2>/dev/null || echo "  (none)"
    else
        echo "No HDFS export directory found"
    fi
fi

# ── Upload outputs ──────────────────────────────────────────────────────────
echo ""
echo "=== Uploading outputs ==="

# Always upload report (required output). If spark-submit failed, create a failure report.
if [ ! -f /home/dnanexus/out/report ]; then
    echo '{"app":"spark-sql-runner","error":"spark-submit did not produce a report","spark_exit_code":'"$SPARK_EXIT"'}' > /home/dnanexus/out/report
fi

echo "Uploading report..."
REPORT_ID=$(dx upload /home/dnanexus/out/report --brief --destination "spark-sql-report.json")
dx-jobutil-add-output report "$REPORT_ID" --class=file

# Upload exported CSV files (if any)
if [ "$EXPORT" = "true" ] && [ -d /home/dnanexus/out/export_output ]; then
    FILE_COUNT=$(ls /home/dnanexus/out/export_output/ 2>/dev/null | wc -l)
    echo "Found $FILE_COUNT exported file(s)"
    if [ "$FILE_COUNT" -gt 0 ]; then
        dx-jobutil-add-output export_output /home/dnanexus/out/export_output --class=array:file
    fi
fi

# ── Collect cluster logs ────────────────────────────────────────────────────
if [ "$COLLECT_LOGS" = "true" ]; then
    echo "Collecting cluster logs..."
    /cluster/log_collector.sh /home/dnanexus/out/cluster_runtime_logs_tarball || true
    if [ -f /home/dnanexus/out/cluster_runtime_logs_tarball ]; then
        LOGS_ID=$(dx upload /home/dnanexus/out/cluster_runtime_logs_tarball --brief --destination "cluster_runtime_logs.tar.gz")
        dx-jobutil-add-output cluster_runtime_logs_tarball "$LOGS_ID" --class=file
    fi
fi

echo "=== spark-sql-runner finished ==="
date
exit $SPARK_EXIT
