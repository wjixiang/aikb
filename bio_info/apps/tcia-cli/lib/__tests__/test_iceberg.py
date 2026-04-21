import tempfile
from pathlib import Path

from ..iceberg import extract_dcm_path


def test_extract_dcm_path():
    with tempfile.TemporaryDirectory() as tmpdir:
        series_path = Path(tmpdir)
        (series_path / "file1.dcm").touch()
        (series_path / "file2.dcm").touch()
        (series_path / "file3.txt").touch()

        result = extract_dcm_path(series_path)

        assert len(result) == 2
        assert all(p.suffix == ".dcm" for p in result)
