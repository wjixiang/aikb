# UKB Agent SOP

## 概述

UKB Agent 是 UK Biobank 数据访问的 Agent 组件，提供数据库浏览、字段查询、队列管理和关联分析能力。

## 前提条件

- UKB API 服务运行于 `http://127.0.0.1:8000`
- DNAnexus 项目已配置（`DX_AUTH_TOKEN`、`DX_PROJECT_CONTEXT_ID`）

## 核心规则

### 字段名格式

所有字段名必须使用 `entity.field_name` 格式：
- ✅ 正确：`participant.eid`、`participant.p31`、`olink_instance_0.p131286`
- ❌ 错误：`eid`、`p31`、`p131286`（缺少 entity 前缀，会导致 422 错误）

### 数据库 ID

每次操作数据库前，必须先调用 `list_databases` 获取当前有效的 `database_id`。旧的 `database_id` 已失效。

## 工具清单

### 1. list_databases

列出当前 DNAnexus 项目中的数据库。

```typescript
list_databases({ name?: string, refresh?: boolean })
```

### 2. describe_database

获取数据库集群的完整描述。

```typescript
describe_database({ database_id: string, refresh?: boolean })
```

### 3. list_tables

列出数据库中的数据表。

```typescript
list_tables({ database_id: string, refresh?: boolean, limit?: number, offset?: number })
```

### 4. list_fields

列出数据集中的可用字段。

```typescript
list_fields({ database_id: string, entity?: string, name?: string, refresh?: boolean, limit?: number, offset?: number })
```

### 5. list_entities

列出数据集中的所有实体及其字段数量。

```typescript
list_entities({ database_id: string, refresh?: boolean })
```

### 6. query_field_dict

搜索字段字典。

```typescript
query_field_dict({ condition: string, page?: number, page_size?: number })
```

**注意**：发送原始关键词，不要写 SQL！
- ✅ 正确：`condition: "olink"`
- ❌ 错误：`condition: "name LIKE '%olink%'"`

### 7. list_field_dict

分页列出字段字典。

```typescript
list_field_dict({ page?: number, page_size?: number })
```

### 8. list_cohorts

列出当前项目中的队列。

```typescript
list_cohorts({ name?: string, limit?: number, refresh?: boolean })
```

### 9. get_cohort

获取队列详情。

```typescript
get_cohort({ cohort_id: string, refresh?: boolean })
```

### 10. create_cohort

基于筛选条件创建队列。

```typescript
create_cohort({
  name: string,
  filters: CohortFilters,
  description?: string,
  folder?: string,
  entity_fields?: string[]
})
```

#### 筛选条件格式

根据字段的数据类型（type）选择正确的 condition：

| 数据类型 | 支持的 condition |
|---------|-----------------|
| 数值型（integer/double） | `is`, `is-not`, `in`, `not-in`, `greater-than`, `greater-than-eq`, `less-than`, `less-than-eq`, `between` |
| 字符串型（string） | `is`, `is-not`, `in`, `not-in`, `contains` |
| 日期型（date） | `is`, `is-not`, `in`, `not-in` |
| 多选/层级型（multi/hierarchical） | `any`, `all` |
| 稀疏型（sparse） | `is`, `is-not`, `in`, `not-in` |
| 空值检查 | `exists`（字段非空）, `is-empty`（字段为空） |

**注意**：
- 禁止使用 `not-exists` 条件（请用 `is-empty` 代替）
- 需要 `values` 的条件（`is`, `is-not`, `in` 等）不能传空 `values`

#### LLM 常用格式（RulesFilter）

```json
{
  "logic": "and",
  "rules": [
    { "field": "participant.sex", "operator": "is", "value": 1 },
    { "field": "participant.age", "operator": "greater-than", "value": 50 }
  ]
}
```

### 11. close_cohort

锁定队列（关闭），使其变为只读状态。

```typescript
close_cohort({ cohort_id: string })
```

### 12. preview_cohort_data

预览队列中指定字段的数据（支持分页）。

```typescript
preview_cohort_data({
  cohort_id: string,
  entity_fields: string[],
  refresh?: boolean,
  limit?: number,
  offset?: number
})
```

### 13. download_cohort

下载队列全部关联字段的完整数据（注意：数据量可能很大）。

```typescript
download_cohort({ cohort_id: string, refresh?: boolean })
```

返回：
```typescript
{
  cohort_id: string,
  cohort_name: string,
  row_count: number,
  field_count: number,
  data: Record<string, unknown>[]
}
```

### 14. query_database

从数据库关联的数据集中提取指定字段。

```typescript
query_database({
  database_id: string,
  entity_fields?: string[],
  dataset_ref?: string,
  refresh?: boolean,
  limit?: number,
  offset?: number
})
```

### 15. query_association

查询生物标志物与结局的关联。

```typescript
query_association({ biomarker_id: string, outcome_id?: string, limit?: number })
```

### 16. export_data

导出数据为 CSV 或 Parquet 格式。

```typescript
export_data({ fields?: string[], cohort_id?: string, refresh?: boolean, format?: 'csv' | 'parquet' })
```

## 典型工作流

### 工作流 1：创建研究队列

1. `list_databases` - 获取可用数据库
2. `list_fields` - 浏览感兴趣的字段及其类型
3. `query_field_dict` - 搜索特定字段（如 "olink"）
4. `create_cohort` - 基于筛选条件创建队列
5. `get_cohort` - 查看队列详情（participant_count）

### 工作流 2：分析队列数据

1. `list_cohorts` - 查看已有队列
2. `get_cohort` - 获取队列详情
3. `preview_cohort_data` - 预览部分数据
4. `download_cohort` - 下载完整数据（如需要）
5. `query_association` - 执行关联分析

### 工作流 3：字段探索

1. `list_databases` - 选择数据库
2. `list_entities` - 查看可用实体
3. `list_fields` - 列出特定实体的字段
4. `query_field_dict` - 搜索感兴趣的字段
5. `query_database` - 提取字段数据

## 类型定义

### CohortFilters

支持三种输入格式：

1. **VizPhenoFilters** - Vizserver 原生格式
2. **RulesFilter** - LLM 常用格式，支持嵌套
3. **FilterRule** - 单条筛选规则

### DatabaseInfo

```typescript
interface DatabaseInfo {
  id: string;
  name: string;
  state: string;
  project: string;
  created: number;
  modified: number;
}
```

### CohortDetail

```typescript
interface CohortDetail {
  id: string;
  name: string;
  project: string;
  state: string;
  created: number;
  modified: number;
  details: Record<string, unknown>;
}
```
