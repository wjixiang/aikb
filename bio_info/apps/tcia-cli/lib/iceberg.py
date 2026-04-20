import os
from datetime import datetime, timezone
from pathlib import Path
from typing import List

import minio
import pyarrow as pa
from pydantic import BaseModel

client = minio.Minio(
    os.getenv("ICEBERG_S3_ENDPOINT_PUBLIC", "").replace("http://", ""),
    os.getenv("ICEBERG_S3_ACCESS_KEY_ID"),
    os.getenv("ICEBERG_S3_SECRET_ACCESS_KEY"),
    region="garage",
)

S3_BUCKET = os.getenv("ICEBERG_S3_BUCKET", "warehouse")
S3_PREFIX = "tcia/dcm"

dcm_metadata_schema = pa.schema(
    [
        pa.field("collection_id", pa.string(), nullable=False),
        pa.field("collection_name", pa.string(), nullable=False),
        pa.field("patient_id", pa.string(), nullable=False),
        pa.field("series_uid", pa.string(), nullable=False),
        pa.field("file_s3_key", pa.string(), nullable=False),
        pa.field("license_s3_key", pa.string(), nullable=True),
        pa.field("modality", pa.string(), nullable=True),
        pa.field("body_part", pa.string(), nullable=True),
        pa.field("image_count", pa.int32(), nullable=True),
        pa.field("file_size", pa.int64(), nullable=True),
        pa.field("study_date", pa.timestamp("us"), nullable=True),
        pa.field("manufacturer", pa.string(), nullable=True),
        pa.field("download_ts", pa.timestamp("us"), nullable=False),
    ]
)

TCIA_NAMESPACE = "tcia"
TABLE_NAME = "dcm"


def create_tcia_iceberg_table():
    from datalake import get_catalog

    catalog = get_catalog()
    catalog.create_namespace_if_not_exists(TCIA_NAMESPACE)
    return catalog.create_table_if_not_exists(
        f"{TCIA_NAMESPACE}.{TABLE_NAME}", dcm_metadata_schema
    )


class TciaLocalDataIndex(BaseModel):
    patient: str
    series: List[Path]


def extract_dcm_path(series_path: Path) -> List[Path]:
    dcm_path_list = [i for i in series_path.iterdir() if i.suffix == ".dcm"]
    return dcm_path_list


def _upload_dir_to_s3(local_dir: Path, s3_key_prefix: str) -> tuple[str, int, int]:
    files = [f for f in local_dir.iterdir() if f.is_file()]
    dcm_files = [f for f in files if f.suffix == ".dcm"]
    license_files = [f for f in files if f.name.startswith("LICENSE")]

    if not client.bucket_exists(S3_BUCKET):
        client.make_bucket(S3_BUCKET)

    license_s3_key = None
    if license_files:
        lic = license_files[0]
        lic_key = f"{s3_key_prefix}/{lic.name}"
        client.fput_object(S3_BUCKET, lic_key, str(lic))
        license_s3_key = f"s3://{S3_BUCKET}/{lic_key}"

    for dcm_file in dcm_files:
        dcm_key = f"{s3_key_prefix}/{dcm_file.name}"
        client.fput_object(S3_BUCKET, dcm_key, str(dcm_file))

    file_s3_key = f"s3://{S3_BUCKET}/{s3_key_prefix}"
    file_size = sum(f.stat().st_size for f in files)
    image_count = len(dcm_files)

    return file_s3_key, image_count, file_size


def _read_dicom_meta(dcm_path: Path) -> dict:
    import pydicom

    ds = pydicom.dcmread(str(dcm_path), stop_before_pixels=True, force=True)

    study_date = None
    raw_date = ds.get("StudyDate")
    if raw_date and raw_date.value:
        try:
            study_date = datetime.strptime(str(raw_date.value), "%Y%m%d").replace(
                tzinfo=timezone.utc
            )
        except ValueError:
            pass

    return {
        "modality": str(ds.get("Modality", "")) or None,
        "body_part": str(ds.get("BodyPartExamined", "")) or None,
        "manufacturer": str(ds.get("Manufacturer", "")) or None,
        "study_date": study_date,
    }


def _discover_series(collection_path: Path) -> list[tuple[str, str, Path]]:
    series_list = []
    for entry in sorted(collection_path.iterdir()):
        if not entry.is_dir():
            continue
        if "." in entry.name and len(entry.name) > 20:
            series_list.append(("unknown", "unknown", entry))
            continue
        for patient_dir in sorted(entry.iterdir()):
            if not patient_dir.is_dir():
                continue
            for series_dir in sorted(patient_dir.iterdir()):
                if not series_dir.is_dir():
                    continue
                series_list.append((entry.name, patient_dir.name, series_dir))
    return series_list


def load_local_collection(collection_path: str):
    import pyarrow as pa

    root = Path(collection_path)
    collection_name = root.name
    now = datetime.now(timezone.utc)

    table = create_tcia_iceberg_table()

    series_entries = _discover_series(root)
    if not series_entries:
        print(f"No series found in {collection_path}")
        return

    records = []
    for coll_name, patient_id, series_dir in series_entries:
        dcm_files = extract_dcm_path(series_dir)
        if not dcm_files:
            continue

        series_uid = series_dir.name
        s3_prefix = f"{S3_PREFIX}/{collection_name}/{patient_id}/{series_uid}"

        file_s3_key, image_count, file_size = _upload_dir_to_s3(series_dir, s3_prefix)

        meta = _read_dicom_meta(dcm_files[0])

        records.append(
            {
                "collection_name": collection_name,
                "patient_id": patient_id,
                "series_uid": series_uid,
                "file_s3_key": file_s3_key,
                "license_s3_key": None,
                "modality": meta["modality"],
                "body_part": meta["body_part"],
                "image_count": image_count,
                "file_size": file_size,
                "study_date": meta["study_date"],
                "manufacturer": meta["manufacturer"],
                "download_ts": now,
            }
        )

        if records and len(records) % 100 == 0:
            arrow_table = pa.Table.from_pylist(records, schema=dcm_metadata_schema)
            table.append(arrow_table)
            print(f"  Appended {len(records)} records ({series_uid})")
            records = []

    if records:
        arrow_table = pa.Table.from_pylist(records, schema=dcm_metadata_schema)
        table.append(arrow_table)
        print(f"  Appended {len(records)} records (final batch)")

    print(f"Done. Total series uploaded: {len(series_entries)}")
