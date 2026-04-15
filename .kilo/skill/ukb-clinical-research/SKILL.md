---
name: ukb-clinical-research
description: >-
  This skill should be used when users need to perform clinical research tasks using UK Biobank data, including querying data fields, constructing cohorts with specific criteria, searching biomarkers, and exporting research datasets. Use when users ask about finding UKB fields, building study cohorts, querying associations between biomarkers and outcomes, or extracting data for analysis.
---

# UK Biobank Clinical Research Skill

Query and analyze UK Biobank data via the API server at `http://127.0.0.1:8000`.

## API Base

- **Base URL**: `http://127.0.0.1:8000`
- **API Docs**: `http://127.0.0.1:8000/docs`

## Standard Workflow

1. **Discover databases** using `list_databases`
2. **Explore fields** using `query_field_dict` or `list_fields`
3. **Create cohort** using `create_cohort` with filter conditions
4. **Preview data** using `preview_cohort_data`
5. **Export data** using `download_cohort` or `export_data`

## Field Naming

- **Filter format**: `entity$field` (e.g., `participant$p31`)
- **Query format**: `entity.field` (e.g., `participant.eid`)

## Filter Conditions

Supported conditions by field type:

| Field Type | Valid Conditions |
|------------|------------------|
| integer/double | `is`, `is-not`, `in`, `not-in`, `greater-than`, `greater-than-eq`, `less-than`, `less-than-eq`, `between` |
| string | `is`, `is-not`, `in`, `not-in`, `contains` |
| date | `is`, `is-not`, `in`, `not-in` |
| multi/hierarchical | `any`, `all`, `not-any`, `not-all` |
| Null checks | `exists` (non-null), `is-empty` (null) |

## Cohort Filter Formats

### RulesFilter (Recommended - LLM-Friendly)

```json
{
  "logic": "AND",
  "rules": [
    {"field": "participant.p31", "operator": "eq", "value": 0},
    {"field": "participant.p21003_i0", "operator": "between", "values": [50, 60]}
  ]
}
```

### VizPhenoFilters (Native Format)

```json
{
  "logic": "and",
  "pheno_filters": {
    "logic": "and",
    "compound": [{
      "name": "phenotype",
      "logic": "and",
      "filters": {
        "participant$p131286": [{"condition": "exists", "values": []}],
        "participant$p31": [{"condition": "is", "values": [0]}]
      }
    }]
  }
}
```

## Common Tasks

### Search Fields by Keyword

Use `query_field_dict` with `condition` parameter to search for fields:

```
olink, blood pressure, cholesterol, diabetes, cardiovascular, BMI, smoking, alcohol, liver, kidney, etc.
```

### Create Cohort with Age Range

```json
{
  "logic": "AND",
  "rules": [
    {"field": "participant.p21003_i0", "operator": "between", "values": [40, 60]}
  ]
}
```

### Create Cohort with Sex Selection

```json
{
  "logic": "AND",
  "rules": [
    {"field": "participant.p31", "operator": "eq", "value": 0}
  ]
}
```

### Create Cohort with Multiple Conditions (AND)

```json
{
  "logic": "AND",
  "rules": [
    {"field": "participant.p31", "operator": "eq", "value": 0},
    {"field": "participant.p21003_i0", "operator": "between", "values": [40, 60]},
    {"field": "participant.p131286", "operator": "exists", "value": ""}
  ]
}
```

### Create Cohort with OR Logic

```json
{
  "logic": "OR",
  "rules": [
    {"field": "participant.p131350", "operator": "eq", "value": 1},
    {"field": "participant.p131351", "operator": "eq", "value": 1}
  ]
}
```

### Query Biomarker-Outcome Associations

Use `query_association` to find associations between biomarkers and outcomes.

### Export Cohort Data

Use `download_cohort` for full data export or `export_data` for specific fields as CSV/Parquet.

## Key Fields Reference

See `references/field_codes.md` for common UKB field codes and categories.

## Notes

- Field `p31` = sex (0=male, 1=female)
- Field `p21003_i0` = age at assessment (array field, use `_i0` index)
- Field `p131286` = diabetes diagnosis
- Use `participant.eid` to include participant ID in queries
- Cohort must be `close_cohort` before `download_cohort`
