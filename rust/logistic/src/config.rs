use std::collections::HashMap;

use iceberg_catalog_rest::{REST_CATALOG_PROP_URI, REST_CATALOG_PROP_WAREHOUSE};

pub struct IcebergConfig {
    pub catalog_uri: String,
    pub warehouse: String,
    pub s3_endpoint: String,
    pub s3_region: String,
    pub s3_access_key_id: String,
    pub s3_secret_access_key: String,
}

impl IcebergConfig {
    pub fn to_properties(&self) -> HashMap<String, String> {
        HashMap::from([
            (REST_CATALOG_PROP_URI.to_string(), self.catalog_uri.clone()),
            (
                REST_CATALOG_PROP_WAREHOUSE.to_string(),
                self.warehouse.clone(),
            ),
            ("s3.endpoint".to_string(), self.s3_endpoint.clone()),
            ("s3.region".to_string(), self.s3_region.clone()),
            (
                "s3.access-key-id".to_string(),
                self.s3_access_key_id.clone(),
            ),
            (
                "s3.secret-access-key".to_string(),
                self.s3_secret_access_key.clone(),
            ),
        ])
    }
}

impl Default for IcebergConfig {
    fn default() -> Self {
        Self {
            catalog_uri: "http://192.168.123.98:8181".to_string(),
            warehouse: "s3://warehouse".to_string(),
            s3_endpoint: "http://localhost:3900".to_string(),
            s3_region: "garage".to_string(),
            s3_access_key_id: "GK8ce6384a8b85bdf9d02544ef".to_string(),
            s3_secret_access_key: "40514871820daa868256d43858ebb2c27984badc6417906315c45ff82eb0c6e7".to_string(),
        }
    }
}
