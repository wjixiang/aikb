import gc
from typing import List

import numpy as np
import polars as pl
import statsmodels.api as sm
from tqdm import tqdm

from datalake import get_catalog, scan_table

COVARIANCE_FIELDS = [
    "sex",
    "age",
    "bmi",
    "smoking_current",
    "smoking_past",
    "smoking_pack_years",
    "education",
    "income",
]

OUTCOME_FIELD = "hpt"

OLINK_TABLE = "ukb.olink_instance_0"
COV_TABLE = "ukb.hpt_cov_clean"
RESULT_TABLE = "ukb.pwas_hypertension_logit"


def load_data() -> pl.LazyFrame:
    olink_lf = scan_table(OLINK_TABLE).with_columns(pl.col("eid").cast(pl.String))
    cov_lf = scan_table(COV_TABLE)

    df = olink_lf.join(cov_lf, left_on="eid", right_on="participant.eid", how="inner")
    return df


def get_protein_fields(df: pl.LazyFrame) -> List[str]:
    schema = df.collect_schema()
    reserved = {"eid", OUTCOME_FIELD, *COVARIANCE_FIELDS}
    return [name for name in schema.names() if name not in reserved]


def logit_protein(
    df: pl.LazyFrame,
    protein: str,
    outcome_field: str,
    covariance_fields: List[str],
):
    fields = [protein, *covariance_fields, outcome_field]
    try:
        clean_df = df.select(pl.col(fields)).drop_nans().drop_nulls()
        X = (
            clean_df.select(pl.col([protein, *covariance_fields]).cast(pl.Float64))
            .collect()
            .to_numpy()
        )
    except Exception as e:
        print(df.schema)
        raise e
    X = sm.add_constant(X)
    y = clean_df.select([outcome_field]).collect().to_numpy()

    model = sm.Logit(y, X)
    result = model.fit(disp=False, maxiter=100)
    return result


def extract_result(result, protein: str, covariance_fields: List[str]) -> pl.DataFrame:
    params = result.params
    bse = result.bse
    conf_int = result.conf_int()
    pvalues = result.pvalues

    var_names = ["const", protein, *covariance_fields]

    rows = []
    for idx, var in enumerate(var_names):
        rows.append(
            {
                "protein": protein,
                "variable": var,
                "coef": float(params[idx]),
                "std_err": float(bse[idx]),
                "z": float(params[idx] / bse[idx]),
                "pvalue": float(pvalues[idx]),
                "ci_lower": float(conf_int[idx][0]),
                "ci_upper": float(conf_int[idx][1]),
            }
        )
    return pl.DataFrame(rows)


def run():
    catalog = get_catalog()
    df = load_data()
    protein_fields = get_protein_fields(df)
    print(f"Total proteins: {len(protein_fields)}")

    if RESULT_TABLE in [f"{ns}.{name}" for ns, name in catalog.list_tables("ukb")]:
        catalog.drop_table(RESULT_TABLE)

    first_result = logit_protein(
        df, protein_fields[0], OUTCOME_FIELD, COVARIANCE_FIELDS
    )
    first_df = extract_result(first_result, protein_fields[0], COVARIANCE_FIELDS)
    result_table = catalog.create_table(RESULT_TABLE, schema=first_df.schema.to_arrow())
    first_df.write_iceberg(result_table, "append")
    del first_result, first_df
    gc.collect()

    for protein in tqdm(protein_fields[1:], total=len(protein_fields) - 1):
        try:
            result = logit_protein(df, protein, OUTCOME_FIELD, COVARIANCE_FIELDS)
            result_df = extract_result(result, protein, COVARIANCE_FIELDS)
            result_df.write_iceberg(result_table, "append")
            del result, result_df
            gc.collect()
        except Exception as e:
            print(f"Failed for {protein}: {e}")

    print("Done.")


if __name__ == "__main__":
    run()
