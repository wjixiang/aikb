import os
from pathlib import Path

import polars as pl
from dotenv import load_dotenv
from pyiceberg.catalog import Catalog, load_catalog

load_dotenv(Path(__file__).resolve().parents[3] / ".env")

os.environ["AWS_ACCESS_KEY_ID"] = os.environ["ICEBERG_S3_ACCESS_KEY_ID"]
os.environ["AWS_SECRET_ACCESS_KEY"] = os.environ["ICEBERG_S3_SECRET_ACCESS_KEY"]
os.environ["AWS_ENDPOINT_URL"] = os.environ["ICEBERG_S3_ENDPOINT_PUBLIC"]
os.environ["AWS_REGION"] = os.environ["ICEBERG_S3_REGION"]
os.environ["AWS_ALLOW_HTTP"] = "true"

_catalog = None


def get_catalog() -> Catalog:
    global _catalog
    if _catalog is None:
        _catalog = load_catalog(
            "default",
            **{
                "type": "rest",
                "uri": os.environ["ICEBERG_REST_URI"],
                "s3.endpoint": os.environ["ICEBERG_S3_ENDPOINT_PUBLIC"],
                "s3.access-key-id": os.environ["ICEBERG_S3_ACCESS_KEY_ID"],
                "s3.secret-access-key": os.environ["ICEBERG_S3_SECRET_ACCESS_KEY"],
            },
        )
    return _catalog


def list_tables(namespace: str = "ukb") -> list[tuple[str, str]]:
    return [(t[0], t[-1]) for t in get_catalog().list_tables(namespace)]


def load_table(table_fqn: str):
    return get_catalog().load_table(table_fqn)


def scan_table(table_fqn: str) -> pl.LazyFrame:
    return pl.scan_iceberg(load_table(table_fqn))


if __name__ == "__main__":
    tables = list_tables()
    for ns, name in tables:
        print(f"{ns}.{name}")
