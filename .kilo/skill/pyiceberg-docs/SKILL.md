---
name: pyiceberg-docs
description: >-
  This skill should be used when users ask about PyIceberg API functionality, including
  catalog management, table operations, DSL queries, expressions, reading/writing data,
  or any other PyIceberg-specific operations. Use when answering questions about
  PyIceberg methods, parameters, or usage patterns.
---

# PyIceberg Documentation Skill

Answer questions about PyIceberg Python API by fetching the relevant documentation from `https://py.iceberg.apache.org/`.

## Documentation URLs

- **Main API**: `https://py.iceberg.apache.org/api/`
- **Expression DSL**: `https://py.iceberg.apache.org/expression-dsl/`
- **Row Filter Syntax**: `https://py.iceberg.apache.org/row-filter-syntax/`
- **Configuration**: `https://py.iceberg.apache.org/configuration/`
- **CLI**: `https://py.iceberg.apache.org/cli/`

## Core Concepts

### Catalog Management

```python
from pyiceberg.catalog import load_catalog

# Load catalog from config or properties
catalog = load_catalog(
    "default",
    **{
        "uri": "http://127.0.0.1:8181",
        "s3.endpoint": "http://127.0.0.1:9000",
        "s3.access-key-id": "admin",
        "s3.secret-access-key": "password",
    }
)

# Create namespace
catalog.create_namespace("my_namespace")

# List tables
tables = catalog.list_tables("my_namespace")

# Load table
table = catalog.load_table("my_namespace.my_table")

# Create table
table = catalog.create_table(
    identifier="my_namespace.my_table",
    schema=schema,
    partition_spec=partition_spec,
)
```

### Table Schema Definition

```python
from pyiceberg.schema import Schema
from pyiceberg.types import StringType, IntegerType, TimestampType, DoubleType, NestedField, StructType

schema = Schema(
    NestedField(field_id=1, name="id", field_type=IntegerType(), required=True),
    NestedField(field_id=2, name="name", field_type=StringType(), required=True),
    NestedField(field_id=3, name="timestamp", field_type=TimestampType(), required=True),
    NestedField(field_id=4, name="price", field_type=DoubleType(), required=False),
    NestedField(
        field_id=5,
        name="details",
        field_type=StructType(
            NestedField(field_id=6, name="created_by", field_type=StringType(), required=False),
        ),
        required=False,
    ),
    identifier_field_ids=[1]  # Primary key for upsert
)
```

### Partitioning

```python
from pyiceberg.partitioning import PartitionSpec, PartitionField

partition_spec = PartitionSpec(
    PartitionField(source_id=1, field_id=1000, transform="day", name="datetime_day"),
    PartitionField(source_id=2, field_id=1001, transform="identity", name="name_identity"),
)
```

### Writing Data (Apache Arrow)

```python
import pyarrow as pa

df = pa.Table.from_pylist([
    {"id": 1, "name": "Alice", "price": 100.0},
    {"id": 2, "name": "Bob", "price": 200.0},
])

# Append data
table.append(df)

# Overwrite all data
table.overwrite(df)

# Partial overwrite with filter
from pyiceberg.expressions import EqualTo
table.overwrite(df, overwrite_filter=EqualTo("status", "old"))

# Dynamic partition overwrite (auto-detect partitions)
table.dynamic_partition_overwrite(df)

# Upsert (merge based on identifier fields)
result = table.upsert(df)
# result.rows_updated, result.rows_inserted

# Delete with filter
table.delete(delete_filter="name == 'Alice'")
```

### Reading Data

```python
# Scan with Arrow output
arrow_table = table.scan().to_arrow()

# Scan with filter
from pyiceberg.expressions import EqualTo, GreaterThan, And
filtered = table.scan(
    row_filter=And(EqualTo("status", "active"), GreaterThan("age", 18))
).to_arrow()

# Batch reading (memory efficient)
for batch in table.scan().to_arrow_batch_reader():
    print(f"Buffer contains {len(batch)} rows")

# Time travel using snapshot_id
table.scan(snapshot_id=805611270568163028).to_arrow()
```

## Expression DSL (Query Filters)

### Basic Predicates

```python
from pyiceberg.expressions import (
    EqualTo, NotEqualTo, LessThan, LessThanOrEqual,
    GreaterThan, GreaterThanOrEqual, In, NotIn,
    IsNull, NotNull, StartsWith, NotStartsWith,
    And, Or, Not
)

# Literal predicates
EqualTo("age", 18)           # age == 18
NotEqualTo("age", 18)       # age != 18
LessThan("age", 18)         # age < 18
LessThanOrEqual("age", 18)   # age <= 18
GreaterThan("age", 18)       # age > 18
GreaterThanOrEqual("age", 18) # age >= 18

# Set predicates
In("status", ["active", "pending"])
NotIn("age", [18, 19, 20])

# Unary predicates
IsNull("name")
NotNull("name")

# String predicates
StartsWith("name", "John")
NotStartsWith("name", "Jo")
```

### Logical Combinations

```python
# AND: age >= 18 AND age <= 65
And(
    GreaterThanOrEqual("age", 18),
    LessThanOrEqual("age", 65)
)

# OR: status == 'active' OR status == 'pending'
Or(
    EqualTo("status", "active"),
    EqualTo("status", "pending")
)

# NOT: NOT (age < 18)
Not(LessThan("age", 18))

# Complex: (age >= 18 AND age <= 65) AND (status == 'active' OR status == 'pending')
And(
    And(
        GreaterThanOrEqual("age", 18),
        LessThanOrEqual("age", 65)
    ),
    Or(
        EqualTo("status", "active"),
        EqualTo("status", "pending")
    )
)
```

## Table Inspection

```python
# Inspect snapshots
table.inspect.snapshots()

# Inspect partitions
table.inspect.partitions()

# Inspect manifest entries
table.inspect.entries()

# Inspect references (branches/tags)
table.inspect.refs()

# Inspect manifests
table.inspect.manifests()

# Inspect metadata log
table.inspect.metadata_log_entries()
```

## Snapshot Management

```python
# Create tag
table.create_tag("v1", snapshot_id)

# Create branch
table.create_branch("branch_name", snapshot_id)

# Expire snapshots
table.expire_snapshotsOlderThan(timestamp)

# Set snapshot properties
table.set_snapshot_property(snapshot_id, "key", "value")
```

## Schema Evolution

```python
# Add column
with table.update_schema() as update:
    update.add_column(path="new_column", field_type="string")

# Rename column
with table.update_schema() as update:
    update.rename_column("old_name", "new_name")

# Move column
with table.update_schema() as update:
    update.move_first("column_to_move")

# Delete column
with table.update_schema() as update:
    update.delete_column("column_to_delete")

# Update column type
with table.update_schema() as update:
    update.update_column_type("column_name", "double")
```

## Static Table (Read-Only, No Catalog)

```python
from pyiceberg.table import StaticTable

static_table = StaticTable.from_metadata(
    "s3://warehouse/path/to/metadata.json"
)

# Or from table root (auto-resolve latest metadata)
static_table = StaticTable.from_metadata(
    "s3://warehouse/path/to/table"
)

# Read-only operations only
arrow_table = static_table.scan().to_arrow()
```

## Query Engines Integration

```python
# Polars (recommended for complex queries)
import polars as pl
lf = pl.scan_iceberg(table)
df = lf.filter(pl.col("age") > 18).select(["name", "age"]).collect()

# Pandas
df = table.scan().to_pandas()

# DuckDB
import duckdb
conn = duckdb.connect()
result = conn.execute("SELECT * FROM iceberg_scan('table_path')").df()

# Ray
import ray
ds = ray.data.from_iceberg(table)
```

## Workflow

1. Identify the relevant PyIceberg operation (catalog, table, expressions, scan, write)
2. Fetch the specific documentation page using WebFetch if needed
3. Parse documentation to answer the user's question
4. Provide method signature, parameters, return type, and usage example

## Documentation URL Pattern

Specific API pages follow this pattern:
```
https://py.iceberg.apache.org/api/
https://py.iceberg.apache.org/expression-dsl/
```

Code reference:
```
https://py.iceberg.apache.org/reference/pyiceberg/
```
