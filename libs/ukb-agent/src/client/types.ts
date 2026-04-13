// ==================== Request Types ====================

export interface CohortCreateRequest {
  name: string;
  filters: Record<string, unknown>;
  dataset_ref?: string | null;
  folder?: string;
  description?: string;
  entity_fields?: string[];
}

export interface ExtractFieldsRequest {
  entity_fields: string[];
  refresh?: boolean;
  limit?: number;
  offset?: number;
}

export interface AssociationQuery {
  biomarker_id: string;
  outcome_id?: string;
  limit?: number;
}

export interface DatabaseQueryRequest {
  entity_fields?: string[];
  dataset_ref?: string | null;
  refresh?: boolean;
  limit?: number;
  offset?: number;
}

export interface ExportRequest {
  fields?: string[];
  cohort_id?: string;
  refresh?: boolean;
}

// ==================== Response Types ====================

export interface DatabaseInfo {
  id: string;
  name: string;
  state: string;
  project: string;
  created: number;
  modified: number;
}

export interface DatabaseTableInfo {
  name: string;
}

export interface DatabaseFieldInfo {
  entity: string;
  name: string;
  type: string;
  title: string;
}

export interface CohortListItem {
  id: string;
  name: string;
  project: string;
  state: string;
  created: number;
  modified: number;
}

export interface CohortInfo {
  id: string;
  name: string;
  project: string;
  folder: string;
  state: string;
  description: string;
  created: number;
  modified: number;
  participant_count: number;
  entity_fields: string[];
}

export interface CohortDetail {
  id: string;
  name: string;
  project: string;
  state: string;
  created: number;
  modified: number;
  details: Record<string, unknown>;
}

export interface FieldDictItem {
  entity: string;
  name: string;
  type: string;
  primary_key_type?: string | null;
  title?: string | null;
  description?: string | null;
  coding_name?: string | null;
  concept?: string | null;
  folder_path?: string | null;
  is_multi_select?: boolean | null;
  is_sparse_coding?: boolean | null;
  linkout?: string | null;
  longitudinal_axis_type?: string | null;
  referenced_entity_field?: string | null;
  relationship?: string | null;
  units?: string | null;
}

export interface FieldDictResponse {
  total: number;
  page: number;
  page_size: number;
  data: FieldDictItem[];
}
