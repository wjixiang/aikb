mod catalog;
mod config;

use std::sync::Arc;

use anyhow::Result;
use datafusion::catalog::{CatalogProviderList, MemoryCatalogProviderList};
use datafusion::execution::context::SessionContext;
use iceberg::NamespaceIdent;
use iceberg_datafusion::IcebergCatalogProvider;

use config::IcebergConfig;

#[tokio::main]
async fn main() -> Result<()> {
    let config: IcebergConfig = IcebergConfig::default();
    let rest_catalog = catalog::create_rest_catalog(&config).await?;

    let ukb_ns = NamespaceIdent::from_vec(vec!["ukb".to_string()])?;
    let tables = catalog::list_tables_in_namespace(&rest_catalog, &ukb_ns).await?;
    println!("Tables in 'ukb': {:#?}", tables);

    let all_tables = catalog::list_all_tables(&rest_catalog).await?;
    println!("All tables: {:#?}", all_tables);

    let catalog_provider =
        IcebergCatalogProvider::try_new(Arc::new(rest_catalog)).await?;

    let catalog_list = MemoryCatalogProviderList::new();
    catalog_list.register_catalog("iceberg".to_string(), Arc::new(catalog_provider));

    let ctx = SessionContext::new();
    ctx.register_catalog_list(Arc::new(catalog_list));

    let olink_df = ctx
        .sql("SELECT * FROM iceberg.ukb.olink_instance_0")
        .await?;
    
    let hpt_cov_df = ctx
        .sql("SELECT * FROM iceberg.ukb.hypertension_cohort")
        .await?;

    let df = ctx
        .sql("
        SELECT *
        FROM iceberg.ukb.olink_instance_0 a
        JOIN iceberg.ukb.hypertension_cohort b
        ON a.eid = b.\"participant.eid\"
        ")
        .await?;
    // df.limit(0, Option::from(10)).unwrap().show().await.unwrap();

    // hpt_cov_df.schema().columns().iter().for_each(|c| println!("{}", c.name()));

    hpt_cov_df.limit(0, Some(10)).unwrap().show().await;

    Ok(())
}
