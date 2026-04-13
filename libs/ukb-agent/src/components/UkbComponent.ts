import { injectable } from 'inversify';
import { ToolComponent, type ToolDef } from 'agent-lib/components';
import type { ToolCallResult, TUIElement } from 'agent-lib/components';
import { UkbMcpClient } from '../client/UkbMcpClient.js';
import type {
  CohortFilters,
  DatabaseQueryRequest,
  ExtractFieldsRequest,
  AssociationQuery,
  ExportRequest,
} from '../client/types.js';
import {
  ListDatabasesToolDef,
  handleListDatabases,
  type DatabaseInfo,
  renderDatabasesAsMarkdown,
  DescribeDatabaseToolDef,
  handleDescribeDatabase,
  ListTablesToolDef,
  renderTablesAsMarkdown,
  ListFieldsToolDef,
  type FieldInfo,
  renderFieldsAsMarkdown,
  QueryFieldDictToolDef,
  handleQueryFieldDict,
  type FieldDictPage,
  renderFieldDictAsMarkdown,
  ListFieldDictToolDef,
  handleListFieldDict,
  ListCohortsToolDef,
  handleListCohorts,
  type CohortInfo,
  renderCohortsAsMarkdown,
  GetCohortToolDef,
  handleGetCohort,
  CreateCohortToolDef,
  handleCreateCohort,
  CloseCohortToolDef,
  handleCloseCohort,
  ExtractCohortDataToolDef,
  QueryDatabaseToolDef,
  QueryAssociationToolDef,
  handleQueryAssociation,
  ExportDataToolDef,
  handleExportData,
} from './tools/index.js';

export interface UkbState {
  currentDatabases: Array<{
    id: string;
    name: string;
    state: string;
  }>;
  currentFields: Array<{
    entity: string;
    name: string;
    type: string;
    title: string;
  }>;
  currentFieldDictPage: {
    total: number;
    page: number;
    pageSize: number;
    data: Array<{
      entity: string;
      name: string;
      type: string;
      title: string | null;
      description: string | null;
      units: string | null;
      coding_name: string | null;
      concept: string | null;
    }>;
  };
  currentCohorts: Array<{
    id: string;
    name: string;
    state: string;
  }>;
  currentCohortDetail: {
    id: string;
    name: string;
    description: string;
    participantCount: number;
  } | null;
  lastQueryResult: Record<string, unknown> | null;
  lastAssociationResult: Record<string, unknown> | null;
}

@injectable()
export class UkbComponent extends ToolComponent<UkbState> {
  private client: UkbMcpClient;

  readonly componentId = 'ukb-data';
  readonly displayName = 'UKB Data Explorer';
  readonly description =
    'UK Biobank 数据库探索组件，支持数据库浏览、字段查询、队列管理和关联分析';
  readonly componentPrompt = `你拥有 UK Biobank (UKB) 数据库的访问能力。你可以：
- 浏览和查询 UKB 数据库的表和字段
- 搜索字段字典（按名称、描述、概念等）
- 创建和管理研究队列（cohort）
- 从队列中提取指定字段的数据
- 执行生物标志物与结局的关联分析
- 导出数据为 CSV 或 Parquet 格式

字段格式为 "entity.field_name"，例如 "participant.eid"（参与者ID）、"participant.p31"（性别）。

【重要】字段字典搜索（query_field_dict）请发送原始关键词，不要写 SQL！
- 正确示例：condition: "olink"
- 正确示例：condition: "blood pressure"
- 正确示例：condition: "diabetes protein"
- 错误示例：condition: "name LIKE '%olink%'"（不要这样写！）

【重要】每次操作数据库前，必须先调用 list_databases 获取当前有效的 database_id！
旧的 database_id 已失效，必须使用 list_databases 返回的最新 ID。
在查询前，建议先用 list_fields 或 list_field_dict 了解可用的字段。`;

  constructor(baseUrlOrClient?: string | UkbMcpClient) {
    super();
    if (typeof baseUrlOrClient === 'string') {
      this.client = new UkbMcpClient(baseUrlOrClient);
    } else if (baseUrlOrClient instanceof UkbMcpClient) {
      this.client = baseUrlOrClient;
    } else {
      this.client = new UkbMcpClient();
    }
  }

  protected initialState(): UkbState {
    return {
      currentDatabases: [],
      currentFields: [],
      currentFieldDictPage: {
        total: 0,
        page: 1,
        pageSize: 20,
        data: [],
      },
      currentCohorts: [],
      currentCohortDetail: null,
      lastQueryResult: null,
      lastAssociationResult: null,
    };
  }

  toolDefs(): Record<string, ToolDef> {
    return {
      list_databases: ListDatabasesToolDef,
      describe_database: DescribeDatabaseToolDef,
      list_tables: ListTablesToolDef,
      list_fields: ListFieldsToolDef,
      query_field_dict: QueryFieldDictToolDef,
      list_field_dict: ListFieldDictToolDef,
      list_cohorts: ListCohortsToolDef,
      get_cohort: GetCohortToolDef,
      create_cohort: CreateCohortToolDef,
      close_cohort: CloseCohortToolDef,
      extract_cohort_data: ExtractCohortDataToolDef,
      query_database: QueryDatabaseToolDef,
      query_association: QueryAssociationToolDef,
      export_data: ExportDataToolDef,
    };
  }

  renderImply = async (): Promise<TUIElement[]> => {
    return [];
  };

  // ==================== Tool Handlers ====================

  async onList_databases(params: {
    name?: string;
    refresh?: boolean;
  }): Promise<ToolCallResult<string>> {
    const result = await handleListDatabases(this.client, params);
    this.reactive.currentDatabases = result.data;
    return {
      success: true,
      data: renderDatabasesAsMarkdown(result.data),
      summary: result.summary ?? '',
    };
  }

  async onDescribe_database(params: {
    database_id: string;
    refresh?: boolean;
  }): Promise<ToolCallResult<unknown>> {
    return handleDescribeDatabase(this.client, params);
  }

  async onList_tables(params: {
    database_id: string;
    refresh?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ToolCallResult<string>> {
    try {
      const result = await this.client.listTables(params.database_id, {
        ...(params.refresh && { refresh: params.refresh }),
        ...(params.limit && { limit: params.limit }),
        ...(params.offset && { offset: params.offset }),
      });
      return {
        success: true,
        data: renderTablesAsMarkdown(result as any),
        summary: `共 ${result.total} 条，当前 ${result.offset + 1}-${Math.min(result.offset + result.limit, result.total)} 条`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        data: '',
        error: message,
        summary: `列出数据表失败: ${message}`,
      };
    }
  }

  async onList_fields(params: {
    database_id: string;
    entity?: string;
    name?: string;
    refresh?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ToolCallResult<string>> {
    try {
      const result = await this.client.listFields(params.database_id, {
        ...(params.entity && { entity: params.entity }),
        ...(params.name && { name: params.name }),
        ...(params.refresh && { refresh: params.refresh }),
        ...(params.limit && { limit: params.limit }),
        ...(params.offset && { offset: params.offset }),
      });
      this.reactive.currentFields = result.data.map((f) => ({
        entity: f.entity,
        name: f.name,
        type: f.type,
        title: f.title,
      }));
      return {
        success: true,
        data: renderFieldsAsMarkdown(result),
        summary: `共 ${result.total} 条，当前 ${result.offset + 1}-${Math.min(result.offset + result.limit, result.total)} 条`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        data: '',
        error: message,
        summary: `列出字段失败: ${message}`,
      };
    }
  }

  async onQuery_field_dict(params: {
    condition: string;
    page?: number;
    page_size?: number;
  }): Promise<ToolCallResult<string>> {
    const result = await handleQueryFieldDict(this.client, params);
    this.reactive.currentFieldDictPage = {
      total: result.data.total,
      page: result.data.page,
      pageSize: result.data.pageSize,
      data: result.data.data,
    };
    const page = result.data;
    const totalPages = Math.ceil(page.total / page.pageSize) || 1;
    return {
      success: true,
      data: renderFieldDictAsMarkdown(page),
      summary: `搜索 "${params.condition}" 共 ${page.total} 条，第 ${page.page}/${totalPages} 页`,
    };
  }

  async onList_field_dict(params: {
    page?: number;
    page_size?: number;
  }): Promise<ToolCallResult<string>> {
    const result = await handleListFieldDict(this.client, params);
    const page: { total: number; page: number; pageSize: number; data: unknown[] } = {
      total: result.data.total,
      page: result.data.page,
      pageSize: result.data.pageSize,
      data: result.data.data,
    };
    const totalPages = Math.ceil(page.total / page.pageSize) || 1;
    return {
      success: true,
      data: renderFieldDictAsMarkdown(page as any),
      summary: `字段字典共 ${page.total} 条，第 ${page.page}/${totalPages} 页`,
    };
  }

  async onList_cohorts(params: {
    name?: string;
    limit?: number;
    refresh?: boolean;
  }): Promise<ToolCallResult<string>> {
    const result = await handleListCohorts(this.client, params);
    this.reactive.currentCohorts = result.data;
    return {
      success: true,
      data: renderCohortsAsMarkdown(result.data),
      summary: result.summary ?? '',
    };
  }

  async onGet_cohort(params: {
    cohort_id: string;
    refresh?: boolean;
  }): Promise<ToolCallResult<unknown>> {
    const result = await handleGetCohort(this.client, params);
    const detail = result.data as {
      id: string;
      name: string;
      state: string;
      details?: { description?: string; participant_count?: number };
    };
    this.reactive.currentCohortDetail = {
      id: detail.id,
      name: detail.name,
      description:
        (detail.details?.description as string) ?? detail.name,
      participantCount:
        (detail.details?.participant_count as number) ?? 0,
    };
    return result;
  }

  async onCreate_cohort(params: {
    name: string;
    filters: CohortFilters;
    description?: string;
    folder?: string;
    entity_fields?: string[];
  }): Promise<ToolCallResult<unknown>> {
    return handleCreateCohort(this.client, params);
  }

  async onClose_cohort(params: {
    cohort_id: string;
  }): Promise<ToolCallResult<unknown>> {
    return handleCloseCohort(this.client, params);
  }

  async onExtract_cohort_data(
    params: ExtractFieldsRequest & { cohort_id: string },
  ): Promise<ToolCallResult<unknown>> {
    try {
      const result = await this.client.extractCohortFields(params.cohort_id, {
        entity_fields: params.entity_fields,
        ...(params.refresh && { refresh: params.refresh }),
        ...(params.limit && { limit: params.limit }),
        ...(params.offset && { offset: params.offset }),
      });
      this.reactive.lastQueryResult = result.data as unknown as Record<string, unknown>;
      return {
        success: true,
        data: result.data,
        summary: `提取到 ${result.total} 条，当前 ${result.offset + 1}-${Math.min(result.offset + result.limit, result.total)} 条`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        data: null,
        error: message,
        summary: `提取队列数据失败: ${message}`,
      };
    }
  }

  async onQuery_database(
    params: DatabaseQueryRequest & { database_id: string },
  ): Promise<ToolCallResult<unknown>> {
    try {
      const result = await this.client.queryDatabase(params.database_id, {
        ...(params.entity_fields && { entity_fields: params.entity_fields }),
        ...(params.dataset_ref && { dataset_ref: params.dataset_ref }),
        ...(params.refresh && { refresh: params.refresh }),
        ...(params.limit && { limit: params.limit }),
        ...(params.offset && { offset: params.offset }),
      });
      this.reactive.lastQueryResult = result.data as unknown as Record<string, unknown>;
      return {
        success: true,
        data: result.data,
        summary: `查询到 ${result.total} 条，当前 ${result.offset + 1}-${Math.min(result.offset + result.limit, result.total)} 条`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        data: null,
        error: message,
        summary: `查询数据库失败: ${message}`,
      };
    }
  }

  async onQuery_association(
    params: AssociationQuery,
  ): Promise<ToolCallResult<unknown>> {
    const result = await handleQueryAssociation(this.client, params);
    this.reactive.lastAssociationResult = result.data as Record<string, unknown>;
    return result;
  }

  async onExport_data(
    params: ExportRequest & { format?: 'csv' | 'parquet' },
  ): Promise<ToolCallResult<unknown>> {
    return handleExportData(this.client, params);
  }
}
