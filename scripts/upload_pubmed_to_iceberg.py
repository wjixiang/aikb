import gc
import os
import sys
import time

import duckdb
import pandas as pd
import pyarrow as pa
from pyiceberg.catalog import load_catalog

NAMESPACE = "pubmed"
BATCH_SIZE = 100_000
DUCKDB_PATH = os.path.expanduser("~/data/pubmed.duckdb")

TABLES = ["articles", "article_keywords", "article_mesh"]

catalog = load_catalog(
    "default",
    **{
        "type": "rest",
        "uri": os.environ["ICEBERG_REST_URI"],
        "s3.endpoint": os.environ["ICEBERG_S3_ENDPOINT_PUBLIC"],
        "s3.access-key-id": os.environ["ICEBERG_S3_ACCESS_KEY_ID"],
        "s3.secret-access-key": os.environ["ICEBERG_S3_SECRET_ACCESS_KEY"],
        "s3.region": os.environ.get("ICEBERG_S3_REGION", "garage"),
        "s3.path-style-access": "true",
    },
)

catalog.create_namespace_if_not_exists(NAMESPACE)


def upload_table(table_name: str):
    fqn = f"{NAMESPACE}.{table_name}"
    print(f"\n{'=' * 60}")
    print(f"Uploading: {fqn}")
    print(f"{'=' * 60}")

    con = duckdb.connect(DUCKDB_PATH, read_only=True)
    total_rows = con.execute(f'SELECT COUNT(*) FROM "{table_name}"').fetchone()[0]
    print(f"Total rows: {total_rows:,}")

    iceberg_table = None

    offset = 0
    batch_num = 0
    start_time = time.time()
    while offset < total_rows:
        batch_num += 1
        elapsed_total = time.time() - start_time
        progress = offset / total_rows * 100
        eta = (elapsed_total / offset * (total_rows - offset)) if offset > 0 else 0
        print(
            f"\nBatch {batch_num}: rows {offset:,} - {min(offset + BATCH_SIZE, total_rows):,} | "
            f"Progress: {progress:.1f}% | Elapsed: {elapsed_total / 60:.1f}min | ETA: {eta / 60:.1f}min"
        )

        t0 = time.time()
        df = con.execute(
            f'SELECT * FROM "{table_name}" LIMIT {BATCH_SIZE} OFFSET {offset}'
        ).fetchdf()
        elapsed = time.time() - t0
        row_count = len(df)
        mem_mb = df.memory_usage(deep=True).sum() / 1024**2
        print(f"  DuckDB read: {elapsed:.1f}s, {row_count:,} rows, {mem_mb:.0f} MB")

        t0 = time.time()
        arrow_table = pa.Table.from_pandas(df, preserve_index=False)
        del df
        gc.collect()
        elapsed_arrow = time.time() - t0
        print(f"  PyArrow convert: {elapsed_arrow:.1f}s")

        if iceberg_table is None:
            iceberg_table = catalog.create_table(fqn, schema=arrow_table.schema)
            print(f"  Created Iceberg table: {fqn}")

        t0 = time.time()
        max_retries = 5
        for retry in range(max_retries):
            try:
                iceberg_table.append(arrow_table)
                break
            except Exception as e:
                if (
                    "507" in str(e)
                    or "minimum free drive" in str(e).lower()
                    or "Storage" in str(e)
                ):
                    print(f"  Storage error (batch {batch_num}), waiting 60s for GC...")
                    time.sleep(60)
                    gc.collect()
                else:
                    raise
        elapsed_write = time.time() - t0
        print(f"  Iceberg append: {elapsed_write:.1f}s")

        del arrow_table
        gc.collect()

        offset += BATCH_SIZE

    con.close()
    print(f"\nDone: {fqn} ({total_rows:,} rows)")


if __name__ == "__main__":
    targets = sys.argv[1:] if len(sys.argv) > 1 else TABLES
    for t in targets:
        if t not in TABLES:
            print(f"Unknown table: {t}, skipping")
            continue
        upload_table(t)
