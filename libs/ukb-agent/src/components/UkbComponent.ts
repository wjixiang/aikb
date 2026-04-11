import { z } from 'zod';
import { injectable } from 'inversify';
import { ToolComponent, type ToolDef } from 'agent-lib/components';
import type { ToolCallResult, TUIElement } from 'agent-lib/components';
import { UkbMcpClient } from '../client/UkbMcpClient.js';
import type {
  CohortCreateRequest,
  DatabaseQueryRequest,
  ExtractFieldsRequest,
  AssociationQuery,
  ExportRequest,
} from '../client/types.js';

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
在查询前，建议先用 list_fields 或 query_field_dict 了解可用的字段。`;

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
      list_databases: {
        desc: '列出可用的 UKB 数据库',
        paramsSchema: z.object({
          name: z
            .string()
            .optional()
            .describe('按名称过滤数据库'),
          refresh: z
            .boolean()
            .optional()
            .describe('是否强制刷新缓存'),
        }),
      },
      describe_database: {
        desc: '获取数据库的详细描述信息（表结构、字段统计等）',
        paramsSchema: z.object({
          database_id: z
            .string()
            .describe('数据库 ID，如 database-xxxx'),
          refresh: z
            .boolean()
            .optional()
            .describe('是否强制刷新缓存'),
        }),
      },
      list_tables: {
        desc: '列出数据库中的所有数据表',
        paramsSchema: z.object({
          database_id: z.string().describe('数据库 ID'),
          refresh: z
            .boolean()
            .optional()
            .describe('是否强制刷新缓存'),
        }),
      },
      list_fields: {
        desc: '列出数据库中的字段（可按 entity 或名称过滤）',
        paramsSchema: z.object({
          database_id: z.string().describe('数据库 ID'),
          entity: z
            .string()
            .optional()
            .describe('按实体名过滤，如 participant'),
          name: z
            .string()
            .optional()
            .describe('按字段名模糊搜索'),
          refresh: z
            .boolean()
            .optional()
            .describe('是否强制刷新缓存'),
        }),
      },
      query_field_dict: {
        desc: '在字段字典中搜索字段（按条件搜索，支持名称、描述、概念等）',
        paramsSchema: z.object({
          condition: z
            .string()
            .describe(
              '搜索条件，如 "blood pressure"、"diabetes"、"ICD10"',
            ),
          page: z.number().optional().describe('页码，默认 1'),
          page_size: z
            .number()
            .optional()
            .describe('每页条数，默认 20'),
        }),
      },
      list_field_dict: {
        desc: '浏览字段字典（分页列表）',
        paramsSchema: z.object({
          page: z.number().optional().describe('页码，默认 1'),
          page_size: z
            .number()
            .optional()
            .describe('每页条数，默认 20'),
        }),
      },
      list_cohorts: {
        desc: '列出已创建的队列',
        paramsSchema: z.object({
          name: z.string().optional().describe('按名称过滤'),
          limit: z.number().optional().describe('返回数量限制'),
          refresh: z
            .boolean()
            .optional()
            .describe('是否强制刷新缓存'),
        }),
      },
      get_cohort: {
        desc: '获取队列的详细信息',
        paramsSchema: z.object({
          cohort_id: z.string().describe('队列 ID'),
          refresh: z
            .boolean()
            .optional()
            .describe('是否强制刷新缓存'),
        }),
      },
      create_cohort: {
        desc: '创建一个新的研究队列',
        paramsSchema: z.object({
          name: z.string().describe('队列名称'),
          filters: z
            .record(z.unknown())
            .describe('筛选条件（vizserver pheno_filters 格式）'),
          description: z
            .string()
            .optional()
            .describe('队列描述'),
          folder: z
            .string()
            .optional()
            .describe('目标文件夹路径，默认 "/"'),
          entity_fields: z
            .array(z.string())
            .optional()
            .describe(
              '关联字段列表，格式 "entity.field_name"',
            ),
        }),
      },
      extract_cohort_data: {
        desc: '从队列中提取指定字段的数据',
        paramsSchema: z.object({
          cohort_id: z.string().describe('队列 ID'),
          entity_fields: z
            .array(z.string())
            .describe(
              '要提取的字段列表，格式 "entity.field_name"',
            ),
          refresh: z
            .boolean()
            .optional()
            .describe('是否跳过缓存'),
        }),
      },
      query_database: {
        desc: '直接查询数据库中的指定字段数据',
        paramsSchema: z.object({
          database_id: z.string().describe('数据库 ID'),
          entity_fields: z
            .array(z.string())
            .describe(
              '要查询的字段列表，格式 "entity.field_name"',
            ),
          dataset_ref: z
            .string()
            .optional()
            .describe('数据集引用'),
          refresh: z
            .boolean()
            .optional()
            .describe('是否强制刷新缓存'),
        }),
      },
      query_association: {
        desc: '查询生物标志物与结局之间的关联分析结果',
        paramsSchema: z.object({
          biomarker_id: z
            .string()
            .describe('生物标志物字段 ID'),
          outcome_id: z
            .string()
            .optional()
            .describe('结局字段或 ICD 编码'),
          limit: z
            .number()
            .optional()
            .describe('返回结果数量限制，默认 100'),
        }),
      },
      export_data: {
        desc: '导出数据为 CSV 或 Parquet 格式',
        paramsSchema: z.object({
          fields: z
            .array(z.string())
            .describe('导出字段 ID 列表'),
          cohort_id: z
            .string()
            .optional()
            .describe('队列 ID，为空则导出全量'),
          format: z
            .enum(['csv', 'parquet'])
            .optional()
            .describe('导出格式，默认 csv'),
          refresh: z
            .boolean()
            .optional()
            .describe('是否强制刷新缓存'),
        }),
      },
    };
  }

  renderImply = async (): Promise<TUIElement[]> => {
    return [];
  };

  // ==================== Tool Handlers ====================

  async onList_databases(params: {
    name?: string;
    refresh?: boolean;
  }): Promise<ToolCallResult<UkbState['currentDatabases']>> {
    const dbs = await this.client.listDatabases({
      ...(params.name && { name: params.name }),
      ...(params.refresh && { refresh: params.refresh }),
    });
    this.reactive.currentDatabases = dbs.map((d) => ({
      id: d.id,
      name: d.name,
      state: d.state,
    }));
    return {
      success: true,
      data: this.reactive.currentDatabases,
      summary: `找到 ${dbs.length} 个数据库`,
    };
  }

  async onDescribe_database(params: {
    database_id: string;
    refresh?: boolean;
  }): Promise<ToolCallResult<unknown>> {
    const opts = params.refresh ? { refresh: params.refresh } : {};
    const result = await this.client.describeDatabase(
      params.database_id,
      opts,
    );
    return {
      success: true,
      data: result,
      summary: `已获取数据库 ${params.database_id} 的详细描述`,
    };
  }

  async onList_tables(params: {
    database_id: string;
    refresh?: boolean;
  }): Promise<ToolCallResult<{ name: string }[]>> {
    const opts = params.refresh ? { refresh: params.refresh } : {};
    const tables = await this.client.listTables(
      params.database_id,
      opts,
    );
    return {
      success: true,
      data: tables,
      summary: `数据库 ${params.database_id} 包含 ${tables.length} 个表: ${tables.map((t) => t.name).join(', ')}`,
    };
  }

  async onList_fields(params: {
    database_id: string;
    entity?: string;
    name?: string;
    refresh?: boolean;
  }): Promise<ToolCallResult<UkbState['currentFields']>> {
    const fields = await this.client.listFields(params.database_id, {
      ...(params.entity && { entity: params.entity }),
      ...(params.name && { name: params.name }),
      ...(params.refresh && { refresh: params.refresh }),
    });
    this.reactive.currentFields = fields.map((f) => ({
      entity: f.entity,
      name: f.name,
      type: f.type,
      title: f.title,
    }));
    return {
      success: true,
      data: this.reactive.currentFields,
      summary: `找到 ${fields.length} 个字段`,
    };
  }

  async onQuery_field_dict(params: {
    condition: string;
    page?: number;
    page_size?: number;
  }): Promise<ToolCallResult<UkbState['currentFieldDictPage']>> {
    const result = await this.client.queryFieldsDict({
      condition: params.condition,
      ...(params.page && { page: params.page }),
      ...(params.page_size && { page_size: params.page_size }),
    });
    this.reactive.currentFieldDictPage = {
      total: result.total,
      page: result.page,
      pageSize: result.page_size,
      data: result.data.map((d) => ({
        entity: d.entity,
        name: d.name,
        type: d.type,
        title: d.title ?? null,
        description: d.description ?? null,
        units: d.units ?? null,
        coding_name: d.coding_name ?? null,
        concept: d.concept ?? null,
      })),
    };
    return {
      success: true,
      data: this.reactive.currentFieldDictPage,
      summary: `搜索 "${params.condition}" 共 ${result.total} 条结果，当前第 ${result.page} 页`,
    };
  }

  async onList_field_dict(params: {
    page?: number;
    page_size?: number;
  }): Promise<ToolCallResult<UkbState['currentFieldDictPage']>> {
    const result = await this.client.listFieldsDict({
      ...(params.page && { page: params.page }),
      ...(params.page_size && { page_size: params.page_size }),
    });
    this.reactive.currentFieldDictPage = {
      total: result.total,
      page: result.page,
      pageSize: result.page_size,
      data: result.data.map((d) => ({
        entity: d.entity,
        name: d.name,
        type: d.type,
        title: d.title ?? null,
        description: d.description ?? null,
        units: d.units ?? null,
        coding_name: d.coding_name ?? null,
        concept: d.concept ?? null,
      })),
    };
    return {
      success: true,
      data: this.reactive.currentFieldDictPage,
      summary: `字段字典共 ${result.total} 条，当前第 ${result.page} 页（${result.data.length} 条）`,
    };
  }

  async onList_cohorts(params: {
    name?: string;
    limit?: number;
    refresh?: boolean;
  }): Promise<ToolCallResult<UkbState['currentCohorts']>> {
    const cohorts = await this.client.listCohorts({
      ...(params.name && { name: params.name }),
      ...(params.limit && { limit: params.limit }),
      ...(params.refresh && { refresh: params.refresh }),
    });
    this.reactive.currentCohorts = cohorts.map((c) => ({
      id: c.id,
      name: c.name,
      state: c.state,
    }));
    return {
      success: true,
      data: this.reactive.currentCohorts,
      summary: `找到 ${cohorts.length} 个队列`,
    };
  }

  async onGet_cohort(params: {
    cohort_id: string;
    refresh?: boolean;
  }): Promise<ToolCallResult<unknown>> {
    const opts = params.refresh ? { refresh: params.refresh } : {};
    const detail = await this.client.getCohort(
      params.cohort_id,
      opts,
    );
    this.reactive.currentCohortDetail = {
      id: detail.id,
      name: detail.name,
      description:
        (detail.details?.description as string) ?? detail.name,
      participantCount:
        (detail.details?.participant_count as number) ?? 0,
    };
    return {
      success: true,
      data: detail,
      summary: `队列: ${detail.name} (ID: ${detail.id}, 状态: ${detail.state})`,
    };
  }

  async onCreate_cohort(
    params: CohortCreateRequest,
  ): Promise<ToolCallResult<unknown>> {
    const result = await this.client.createCohort(params);
    return {
      success: true,
      data: result,
      summary: `已创建队列 "${params.name}" (ID: ${result.id}, 参与者: ${result.participant_count})`,
    };
  }

  async onExtract_cohort_data(
    params: ExtractFieldsRequest & { cohort_id: string },
  ): Promise<ToolCallResult<unknown>> {
    const req: ExtractFieldsRequest = {
      entity_fields: params.entity_fields,
      ...(params.refresh && { refresh: params.refresh }),
    };
    const result = await this.client.extractCohortFields(
      params.cohort_id,
      req,
    );
    this.reactive.lastQueryResult = result as Record<string, unknown>;
    return {
      success: true,
      data: result,
      summary: `已从队列 ${params.cohort_id} 提取 ${params.entity_fields.length} 个字段的数据`,
    };
  }

  async onQuery_database(
    params: DatabaseQueryRequest & { database_id: string },
  ): Promise<ToolCallResult<unknown>> {
    const req: DatabaseQueryRequest = {
      ...(params.entity_fields && { entity_fields: params.entity_fields }),
      ...(params.dataset_ref && { dataset_ref: params.dataset_ref }),
      ...(params.refresh && { refresh: params.refresh }),
    };
    const result = await this.client.queryDatabase(
      params.database_id,
      req,
    );
    this.reactive.lastQueryResult = result as Record<string, unknown>;
    return {
      success: true,
      data: result,
      summary: `已查询 ${params.entity_fields?.length ?? 0} 个字段`,
    };
  }

  async onQuery_association(
    params: AssociationQuery,
  ): Promise<ToolCallResult<unknown>> {
    const result = await this.client.queryAssociation(params);
    this.reactive.lastAssociationResult =
      result as Record<string, unknown>;
    return {
      success: true,
      data: result,
      summary: `已查询 ${params.biomarker_id} 的关联分析${params.outcome_id ? `（结局: ${params.outcome_id}）` : ''}`,
    };
  }

  async onExport_data(
    params: ExportRequest & { format?: 'csv' | 'parquet' },
  ): Promise<ToolCallResult<unknown>> {
    const format = params.format ?? 'csv';
    const result =
      format === 'csv'
        ? await this.client.exportCsv(params)
        : await this.client.exportParquet(params);
    return {
      success: true,
      data: result,
      summary: `已导出 ${format.toUpperCase()} 格式数据`,
    };
  }
}
