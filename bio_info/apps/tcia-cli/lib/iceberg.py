import os
from datetime import datetime, timezone
from pathlib import Path
from typing import List
import minio
import pyarrow as pa
from tqdm import tqdm
from pydantic import BaseModel

client = minio.Minio(
    os.getenv("ICEBERG_S3_ENDPOINT_PUBLIC", "").replace("http://", ""),
    os.getenv("ICEBERG_S3_ACCESS_KEY_ID"),
    os.getenv("ICEBERG_S3_SECRET_ACCESS_KEY"),
    region="garage",
    secure=False,
)

S3_BUCKET = os.getenv("ICEBERG_S3_BUCKET", "warehouse")
S3_PREFIX = "tcia/dcm"

dcm_metadata_schema = pa.schema(
    [
        pa.field("collection_id", pa.string(), nullable=True),
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


def create_or_load_table():
    from datalake import get_catalog

    catalog = get_catalog()
    try:
        catalog.create_namespace_if_not_exists(TCIA_NAMESPACE)
        return catalog.create_table_if_not_exists(
            f"{TCIA_NAMESPACE}.{TABLE_NAME}", dcm_metadata_schema
        )
    except Exception:
        return catalog.load_table(f"{TCIA_NAMESPACE}.{TABLE_NAME}")


def get_existing_series_uids(table) -> set:
    try:
        import polars as pl

        lf = pl.scan_iceberg(table)
        existing = lf.select("series_uid").collect()
        return set(existing["series_uid"].to_list())
    except:
        raise
    # return set()


class SeriesEntry(BaseModel):
    collection_name: str
    patient_id: str
    series_uid: str
    series_path: Path


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
    if raw_date:
        try:
            study_date = datetime.strptime(str(raw_date), "%Y%m%d").replace(
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


def _discover_series(collection_path: Path) -> List[SeriesEntry]:
    series_list = []
    for entry in sorted(collection_path.iterdir()):
        if not entry.is_dir():
            continue
        if "." in entry.name and len(entry.name) > 20:
            series_list.append(
                SeriesEntry(
                    collection_name=collection_path.name,
                    patient_id="unknown",
                    series_uid=entry.name,
                    series_path=entry,
                )
            )
            continue
        for patient_dir in sorted(entry.iterdir()):
            if not patient_dir.is_dir():
                continue
            for series_dir in sorted(patient_dir.iterdir()):
                if series_dir.is_dir():
                    series_list.append(
                        SeriesEntry(
                            collection_name=collection_path.name,
                            patient_id=entry.name,
                            series_uid=series_dir.name,
                            series_path=series_dir,
                        )
                    )
                elif series_dir.suffix == ".dcm":
                    series_list.append(
                        SeriesEntry(
                            collection_name=collection_path.name,
                            patient_id=entry.name,
                            series_uid=patient_dir.name,
                            series_path=patient_dir,
                        )
                    )
                    break
    return series_list


def load_local_collection(collection_path: str):
    import pyarrow as pa

    root = Path(collection_path)
    collection_name = root.name
    now = datetime.now(timezone.utc)

    table = create_or_load_table()
    existing_uids = get_existing_series_uids(table)
    print(f"Found {len(existing_uids)} existing series in table, will skip them")

    series_entries = _discover_series(root)
    if not series_entries:
        print(f"No series found in {collection_path}")
        return

    records = []
    skipped = 0
    for series_entry in tqdm(series_entries, desc="Uploading series"):
        if series_entry.series_uid in existing_uids:
            skipped += 1
            continue
        series_dir = series_entry.series_path
        patient_id = series_entry.patient_id
        series_uid = series_entry.series_uid
        dcm_files = extract_dcm_path(series_dir)
        if not dcm_files:
            continue

        s3_prefix = f"{S3_PREFIX}/{collection_name}/{patient_id}/{series_uid}"

        file_s3_key, image_count, file_size = _upload_dir_to_s3(series_dir, s3_prefix)

        meta = _read_dicom_meta(dcm_files[0])

        records.append(
            {
                "collection_id": series_entry.collection_name,
                "collection_name": series_entry.collection_name,
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
            records = []

    if records:
        arrow_table = pa.Table.from_pylist(records, schema=dcm_metadata_schema)
        table.append(arrow_table)
        print(f"  Appended {len(records)} records (final batch)")

    print(
        f"Done. Total: {len(series_entries)} series, skipped {skipped} existing, uploaded new ones."
    )


load_local_collection("/mnt/disk2/dataset/radiomics/LIDC-IDRI")
