import os
import sys
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

dotenv_path = Path(__file__).resolve().parent.parent / ".env"
if dotenv_path.exists():
    with open(dotenv_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip().strip("\"'")
                os.environ.setdefault(key, value)

S3_CONFIG = Config(
    connect_timeout=30,
    read_timeout=60,
    retries={"max_attempts": 5, "mode": "adaptive"},
)

SOURCE = {
    "endpoint_url": os.environ.get(
        "ICEBERG_S3_ENDPOINT_PUBLIC", "http://localhost:9900"
    ),
    "aws_access_key_id": os.environ.get("ICEBERG_S3_ACCESS_KEY_ID", "admin"),
    "aws_secret_access_key": os.environ.get("ICEBERG_S3_SECRET_ACCESS_KEY", "password"),
    "region_name": os.environ.get("ICEBERG_S3_REGION", "us-east-1"),
}

DEST = {
    "endpoint_url": "http://192.168.123.98:3900",
    "aws_access_key_id": "GK8ce6384a8b85bdf9d02544ef",
    "aws_secret_access_key": "40514871820daa868256d43858ebb2c27984badc6417906315c45ff82eb0c6e7",
    "region_name": "garage",
}

BUCKET = "warehouse"


def create_clients():
    src = boto3.client("s3", **SOURCE, config=S3_CONFIG)
    dst = boto3.client("s3", **DEST, config=S3_CONFIG)
    return src, dst


def ensure_bucket(dst):
    try:
        dst.head_bucket(Bucket=BUCKET)
        print(f"[OK] Bucket '{BUCKET}' already exists on Garage")
    except ClientError as e:
        if e.response["Error"]["Code"] in ("404", "NoSuchBucket"):
            print(
                f"[WARN] Bucket '{BUCKET}' not found. Please create it and grant key permissions via Garage CLI first."
            )
            sys.exit(1)
        else:
            raise


def list_all_objects(src):
    paginator = src.get_paginator("list_objects_v2")
    objects = []
    for page in paginator.paginate(Bucket=BUCKET):
        for obj in page.get("Contents", []):
            objects.append((obj["Key"], obj["Size"]))
    return objects


def copy_object(src, dst, key):
    response = src.get_object(Bucket=BUCKET, Key=key)
    body = response["Body"].read()
    content_type = response.get("ContentType", "application/octet-stream")
    dst.put_object(
        Bucket=BUCKET,
        Key=key,
        Body=body,
        ContentType=content_type,
    )
    return key


def migrate(dry_run=False, max_workers=8):
    src, dst = create_clients()

    if not dry_run:
        ensure_bucket(dst)

    print("[...] Listing objects in MinIO...")
    objects = list_all_objects(src)
    total = len(objects)
    total_size = sum(size for _, size in objects)
    print(f"[OK] Found {total} objects ({total_size / (1024**2):.2f} MB)")

    if dry_run:
        print("\n--- DRY RUN (no data copied) ---")
        for key, size in objects[:20]:
            print(f"  {key}  ({size} bytes)")
        if total > 20:
            print(f"  ... and {total - 20} more objects")
        return

    copied = 0
    failed = []
    start = time.time()

    print(f"\n[...] Migrating with {max_workers} workers...")
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(copy_object, src, dst, key): key for key, _ in objects
        }
        for future in as_completed(futures):
            key = futures[future]
            try:
                future.result()
                copied += 1
                if copied % 50 == 0 or copied == total:
                    elapsed = time.time() - start
                    rate = copied / elapsed if elapsed > 0 else 0
                    print(
                        f"  Progress: {copied}/{total} "
                        f"({copied / total * 100:.1f}%) "
                        f"- {rate:.1f} obj/s"
                    )
            except Exception as e:
                failed.append((key, str(e)))
                print(f"  [FAIL] {key}: {e}")

    elapsed = time.time() - start
    print(f"\n{'=' * 50}")
    print(f"Migration complete in {elapsed:.1f}s")
    print(f"  Copied: {copied}/{total}")
    if failed:
        print(f"  Failed: {len(failed)}")
        for key, err in failed[:10]:
            print(f"    - {key}: {err}")
        if len(failed) > 10:
            print(f"    ... and {len(failed) - 10} more")
    else:
        print("  Failed: 0")


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    migrate(dry_run=dry_run)
