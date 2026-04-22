import gc
from typing import List

import numpy as np
import pyarrow as pa
import polars as pl
import statsmodels.api as sm

from datalake import (
    AnalysisStatus,
    Study,
    create_analysis,
    create_study_if_not_exist,
    get_catalog,
    scan_table,
    update_analysis,
)
from joblib import Parallel, delayed

import narwhals as nw

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
RESULT_TABLE = "method.stats.regression.logistic.binary_logistic"

RESULT_SCHEMA = pa.schema(
    [
        ("analysis.id", pa.string(), False),
        ("exposure", pa.string(), False),
        ("variable", pa.string(), False),
        ("coef", pa.float64(), False),
        ("std_err", pa.float64(), False),
        ("z", pa.float64(), False),
        ("pvalue", pa.float64(), False),
        ("ci_lower", pa.float64(), False),
        ("ci_upper", pa.float64(), False),
    ]
)


def load_data() -> pl.DataFrame:
    olink_lf = scan_table(OLINK_TABLE).with_columns(pl.col("eid").cast(pl.String))
    cov_lf = scan_table(COV_TABLE)
    protein_fields = list(olink_lf.collect_schema().keys())
    protein_fields.remove("eid")

    df = olink_lf.join(cov_lf, left_on="eid", right_on="participant.eid", how="inner")
    return df.select(
        ["eid", OUTCOME_FIELD, *COVARIANCE_FIELDS, *protein_fields]
    ).collect()


def get_protein_fields(df: pl.DataFrame) -> List[str]:
    reserved = {"eid", OUTCOME_FIELD, *COVARIANCE_FIELDS}
    return [name for name in df.columns if name not in reserved]


def _logistic_reg_worker(
    exposure_col: np.ndarray,
    cov_matrix: np.ndarray,
    outcome: np.ndarray,
):
    valid_mask = ~(
        np.isnan(exposure_col)
        | np.isnan(cov_matrix).any(axis=1)
        | np.isnan(outcome.ravel())
    )
    n_valid = valid_mask.sum()
    if n_valid == 0:
        return None

    X = np.column_stack([exposure_col[valid_mask], cov_matrix[valid_mask]])
    X = sm.add_constant(X)
    y = outcome[valid_mask]

    model = sm.Logit(y, X)
    result = model.fit(disp=False, maxiter=100)
    return result


def extract_result(
    result,
    analysis_id: str,
    exposure_field: str,
    covariance_fields: List[str],
) -> list[dict]:
    params = result.params
    bse = result.bse
    conf_int = result.conf_int()
    pvalues = result.pvalues

    var_names = ["const", exposure_field, *covariance_fields]

    rows = []
    for idx, var in enumerate(var_names):
        rows.append(
            {
                "analysis.id": analysis_id,
                "exposure": exposure_field,
                "variable": var,
                "coef": float(params[idx]),
                "std_err": float(bse[idx]),
                "z": float(params[idx] / bse[idx]),
                "pvalue": float(pvalues[idx]),
                "ci_lower": float(conf_int[idx][0]),
                "ci_upper": float(conf_int[idx][1]),
            }
        )
    return rows


def _process_single_exposure(
    analysis_id: str,
    exposure_name: str,
    exposure_col: np.ndarray,
    cov_matrix: np.ndarray,
    outcome: np.ndarray,
    covariance_fields: List[str],
) -> list[dict] | None:
    try:
        result = _logistic_reg_worker(exposure_col, cov_matrix, outcome)
        if result is None:
            return None
        return extract_result(result, analysis_id, exposure_name, covariance_fields)
    except Exception as e:
        print(f"Failed for {exposure_name}: {e}")
        return None


def batch_logistic(
    df: pl.DataFrame,
    exposure_fields: List[str],
    outcome_field: str,
    covariance_fields: List[str],
    study: Study,
    analysis_desc: str = "",
    n_jobs: int = -1,
):
    """
    Execute batch logistic regression with given list of exposure fields and single outcome field.
    Data is pre-collected into numpy arrays; large arrays are memory-mapped across worker processes.
    Results are written to a shared flat table indexed by analysis.id and study_name.
    """
    analysis = create_analysis(study_id=study.id, desc=analysis_desc)
    print(f"Analysis created: {analysis.id}")

    update_analysis(analysis.id, status=AnalysisStatus.RUNNING)

    try:
        catalog = get_catalog()
        catalog.create_table_if_not_exists(RESULT_TABLE, schema=RESULT_SCHEMA)

        cov_matrix = (
            df.select(pl.col(covariance_fields).cast(pl.Float64))
            .fill_nan(np.nan)
            .fill_null(np.nan)
            .to_numpy()
        )
        outcome = (
            df.select(pl.col(outcome_field).cast(pl.Float64))
            .fill_nan(np.nan)
            .fill_null(np.nan)
            .to_numpy()
        )

        all_exposure_data = (
            df.select(pl.col(exposure_fields).cast(pl.Float64))
            .fill_nan(np.nan)
            .fill_null(np.nan)
            .to_numpy()
        )
        exposure_cols = [
            all_exposure_data[:, i] for i in range(all_exposure_data.shape[1])
        ]

        results = Parallel(n_jobs=n_jobs, verbose=10, max_nbytes=1e6)(
            delayed(_process_single_exposure)(
                analysis.id,
                name,
                col,
                cov_matrix,
                outcome,
                covariance_fields,
            )
            for name, col in zip(exposure_fields, exposure_cols)
        )

        valid_results = [r for r in results if r is not None]

        if not valid_results:
            print("No valid results.")
            update_analysis(analysis.id, status=AnalysisStatus.FAILED)
            return

        all_rows = []
        for rows in valid_results:
            all_rows.extend(rows)

        result_df = pl.DataFrame(all_rows)
        arrow_table = result_df.to_arrow().cast(RESULT_SCHEMA)
        result_table = catalog.load_table(RESULT_TABLE)
        result_table.append(arrow_table)
        del result_df
        gc.collect()

        update_analysis(analysis.id, status=AnalysisStatus.COMPLETED)
        print("Done.")
    except Exception as e:
        print(f"Batch failed: {e}")
        update_analysis(analysis.id, status=AnalysisStatus.FAILED)
        raise


if __name__ == "__main__":
    df = load_data()

    protein_fields = get_protein_fields(df)
    print(f"Total proteins: {len(protein_fields)}")

    # retrieve study
    study = create_study_if_not_exist(
        study_name="hpt_protein_association",
        desc="Binary logistic regression: OLINK proteins vs hypertension",
    )

    batch_logistic(
        df=df,
        exposure_fields=protein_fields,
        outcome_field=OUTCOME_FIELD,
        covariance_fields=COVARIANCE_FIELDS,
        study=study,
        analysis_desc="Binary logistic regression: OLINK proteins vs hypertension",
    )
