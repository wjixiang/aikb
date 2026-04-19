import polars as pl

from catalog import get_catalog, scan_table

rename_map = {
    "participant.p131286": "htn_date",
    "participant.p31": "sex",
    "participant.p21003_i0": "age",
    "participant.p21001_i0": "bmi",
    "participant.p1239_i0": "smoking_current",
    "participant.p1249_i0": "smoking_past",
    "participant.p20117_i0": "smoking_pack_years",
    "participant.p6138_i0": "education",
    "participant.p738_i0": "income",
    "participant.p22189": "townsend_di",
    "participant.p54_i0": "assessment_centre",
    "participant.p4080_i0_a0": "systolic_bp_1",
    "participant.p4079_i0_a0": "diastolic_bp_1",
    "participant.p4080_i0_a1": "systolic_bp_2",
    "participant.p4079_i0_a1": "diastolic_bp_2",
    "participant.p2966_i0": "age_htn_diagnosed",
}


def rename_hp_df(hp_df: pl.DataFrame):
    return hp_df.rename(rename_map)


def main():
    hp_df = (
        scan_table("ukb.hypertension_cohort")
        .rename(rename_map)  # Rename field: ukb code to readable name
        .with_columns(  # Processing education field
            pl.col("education")
            .str.strip_chars("[]")
            .str.split(",")
            .list.eval(pl.element().cast(pl.Int32))
            .list.min()
            .replace(-7, 0)  # -7 (无学历) 映射为 0
        )
    )

    olink_df = scan_table("ukb.hypertension_cohort").with_columns(
        pl.col("eid").cast(pl.String)
    )  # convert eid datatype
