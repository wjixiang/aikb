use std::sync::Arc;

use anyhow::{Ok, Result};
use datafusion::{catalog::{CatalogProviderList, MemoryCatalogProviderList}, prelude::SessionContext};
use iceberg::{Catalog, CatalogBuilder, NamespaceIdent};
use iceberg_catalog_rest::RestCatalog;
use iceberg_storage_opendal::OpenDalStorageFactory;
use iceberg_datafusion::IcebergCatalogProvider;
use crate::config::IcebergConfig;

pub async fn create_rest_catalog(config: &IcebergConfig) -> Result<RestCatalog> {
    let builder = iceberg_catalog_rest::RestCatalogBuilder::default()
        .with_storage_factory(Arc::new(OpenDalStorageFactory::S3 {
            configured_scheme: "s3".to_string(),
            customized_credential_load: None,
        }));

    Ok(builder.load("rest", config.to_properties()).await?)
}

pub async fn list_all_tables(
    catalog: &RestCatalog,
) -> Result<Vec<(Vec<String>, String)>> {
    let namespaces = catalog.list_namespaces(None).await?;
    let mut result = Vec::new();

    for ns in &namespaces {
        let tables = catalog.list_tables(ns).await?;
        for t in tables {
            result.push((t.namespace.inner(), t.name));
        }
    }

    Ok(result)
}

pub async fn list_tables_in_namespace(
    catalog: &RestCatalog,
    namespace: &NamespaceIdent,
) -> Result<Vec<iceberg::TableIdent>> {
    Ok(catalog.list_tables(namespace).await?)
}


pub async fn get_ctx() -> Result<SessionContext>{
    let config: IcebergConfig = IcebergConfig::default();
    let rest_catalog = create_rest_catalog(&config).await?;

    let catalog_provider =
        IcebergCatalogProvider::try_new(Arc::new(rest_catalog)).await?;

    let catalog_list = MemoryCatalogProviderList::new();
    catalog_list.register_catalog("iceberg".to_string(), Arc::new(catalog_provider));

    let ctx = SessionContext::new();
    ctx.register_catalog_list(Arc::new(catalog_list));

    Ok(ctx)
}