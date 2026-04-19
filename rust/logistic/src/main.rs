mod catalog;
mod config;
mod logistic;

use anyhow::Result;

#[tokio::main]
async fn main() -> Result<()> {
    
    let ctx = catalog::get_ctx().await?;
    
    let hp_cov_df = ctx
        .sql("
        SELECT *
        FROM iceberg.ukb.hpt_cov_clean
        ")
        .await?;
    
    let olink_df = ctx
        .sql("
        SELECT * FROM iceberg.ukb.olink_instance_0
        ").await?;

    // df.limit(0, Some(10)).unwrap().show().await;
    let cols = hp_cov_df.schema().columns();
    println!("{:#?}", &cols[..10]);

    let df1 = ctx.sql("
        SELECT * 
        FROM iceberg.ukb.hpt_cov_clean a
        INNER JOIN iceberg.ukb.olink_instance_0 b
        ON a.\"participant.eid\" = b.eid
    ").await?;

    // df1.limit(0, Some(10))?.show().await;
    let exp_field = "a1bg".to_string();
    let outcome_field = "hpt".to_string();
    let cov_fields: Vec<&str> = vec![
        "sex",
        "age",
        "bmi",
        "smoking_current",
        "smoking_past",
        "smoking_pack_years",
        "education",
        "income"];

    Ok(())
}
