from pathlib import Path
import os
from dx_client.dx_client import DXClient, DXClientConfig, upload_sql_file, run_spark_sql
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[4] / ".env")

# Re-read env at runtime (default_dx_client_config is captured at import time,
# before load_dotenv runs, so we must reconstruct it after loading .env)
dxclient = DXClient(
    config=DXClientConfig(
        auth_token=os.getenv("DX_AUTH_TOKEN", ""),
        project_context_id=os.getenv("DX_PROJECT_CONTEXT_ID", ""),
    )
)


def test_get_cohort_sql():
    dxclient.connect()
    sql = dxclient.generate_cohort_sql("record-J7JbJJjJj70bf1QgJ3yqgPf7")
    print(sql)
    pass


def test_upload_cohort_sql():
    sql = "SELECT `participant_0001_1`.`eid` AS `eid` FROM `database_j77jyvjjvpqqx189jkjb87qg__app917657_20260402210224`.`participant_0001` AS `participant_0001_1` WHERE (EXISTS (SELECT `hesin_1`.`eid` AS `eid`, `hesin_1`.`dnx_hesin_id` AS `dnx_hesin_id` FROM `database_j77jyvjjvpqqx189jkjb87qg__app917657_20260402210224`.`hesin` AS `hesin_1` WHERE `participant_0001_1`.`eid` = `hesin_1`.`eid` AND (EXISTS (SELECT `hesin_diag_1`.`dnx_hesin_id` AS `dnx_hesin_id` FROM `database_j77jyvjjvpqqx189jkjb87qg__app917657_20260402210224`.`hesin_diag` AS `hesin_diag_1` WHERE ARRAY_CONTAINS(`hesin_diag_1`.`dnx_diag_icd10_hierarchy`, 'I10') AND `hesin_diag_1`.`dnx_hesin_id` = `hesin_1`.`dnx_hesin_id`)))) AND (EXISTS (SELECT `olink_instance_0_0001_1`.`eid` AS `eid` FROM `database_j77jyvjjvpqqx189jkjb87qg__app917657_20260402210224`.`olink_instance_0_0001` AS `olink_instance_0_0001_1` WHERE `olink_instance_0_0001_1`.`eid` = `participant_0001_1`.`eid`));"
    dxfile = upload_sql_file(sqlstr=sql, fileName="uploaded_sql")
    print(dxfile)


def test_spark():
    file_id = "file-J7JpB5QJj70Q86Fj8qbQ1y1q"
    result = run_spark_sql(file_id)
    print(result)


test_spark()
