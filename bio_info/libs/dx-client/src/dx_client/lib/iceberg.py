import os

import pandas as pd
from pyiceberg.catalog import load_catalog
import pyarrow as pa

catalog = load_catalog(
    "default",
    **{
        "type": "rest",
        "uri": os.environ["ICEBERG_REST_URI"],
        "s3.endpoint": os.environ["ICEBERG_S3_ENDPOINT_PUBLIC"],
        "s3.access-key-id": os.environ["ICEBERG_S3_ACCESS_KEY_ID"],
        "s3.secret-access-key": os.environ["ICEBERG_S3_SECRET_ACCESS_KEY"],
    },
)


def upload_pddf_iceberg(namespace: str, table_name: str, df: pd.DataFrame) -> None:
    catalog.create_namespace_if_not_exists(namespace)
    table = catalog.create_table_if_not_exists(
        f"{namespace}.{table_name}", pa.Schema.from_pandas(df)
    )
    table.append(pa.Table.from_pandas(df))
