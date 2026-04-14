import { z } from 'zod';
import type { ToolDef, ToolCallResult } from 'agent-lib/components';
import type { CohortCreateRequest } from '../../client/types.js';
import type { UkbMcpClient } from '../../client/UkbMcpClient.js';

// ── Vizserver native pheno_filters schema ──────────────────────────────

const VIZ_CONDITIONS = [
  'is',
  'is-not',
  'in',
  'not-in',
  'contains',
  'greater-than',
  'greater-than-eq',
  'less-than',
  'less-than-eq',
  'between',
  'is-empty',
  'exists',
] as const;

const VizFilterConditionSchema = z.object({
  condition: z.enum(VIZ_CONDITIONS).describe(
    '条件类型：is, is-not, in, not-in, contains, greater-than, greater-than-eq, less-than, less-than-eq, between, is-empty（字段为空）, exists（字段非空）',
  ),
  values: z.unknown().optional(),
});

const VizCompoundFilterEntrySchema = z.object({
  name: z.string().describe('分组名称，通常为 "phenotype"'),
  logic: z.enum(['and', 'or']),
  filters: z.record(z.array(VizFilterConditionSchema)),
});

const VizPhenoFiltersSchema = z.object({
  logic: z.enum(['and', 'or']),
  pheno_filters: z.object({
    logic: z.enum(['and', 'or']),
    compound: z.array(VizCompoundFilterEntrySchema),
  }),
});

// ── LLM-friendly rules schema ──────────────────────────────────────────

const FilterRuleSchema = z.object({
  field: z.string().describe('字段名，"entity.field_name" 格式'),
  operator: z.string().optional().describe(
    '操作符：is_not_null, eq, gt, in, not-in 等',
  ),
  type: z.string().nullable().optional().describe(
    '操作符别名（与 operator 二选一）',
  ),
  value: z.unknown().optional().describe('条件值（单值）'),
  values: z.array(z.unknown()).optional().describe('条件值（列表）'),
});

const RulesFilterSchema = z.object({
  logic: z.enum(['and', 'or', 'AND', 'OR']).optional(),
  logical: z.enum(['and', 'or', 'AND', 'OR']).optional(),
  rules: z.array(FilterRuleSchema).describe('筛选规则列表'),
});

// ── Discriminated union ────────────────────────────────────────────────

const CohortFiltersSchema = z.union([
  VizPhenoFiltersSchema.describe(
    'Vizserver 原生 pheno_filters 格式（当条件复杂时使用）。' +
    '示例：{"logic":"and","pheno_filters":{"logic":"and","compound":[{"name":"phenotype","logic":"and","filters":{"participant$p131286":[{"condition":"exists","values":[]}]}}]}}',
  ),
  RulesFilterSchema.describe(
    '简化 rules 格式（推荐）。' +
    '示例：{"logical":"AND","rules":[{"field":"participant.p131286","operator":"is_not_null"},{"field":"participant.p31","operator":"in","values":["Female"]}]}',
  ),
  FilterRuleSchema.describe(
    '单条规则快捷格式。' +
    '示例：{"field":"participant.p131286","operator":"is_not_null"}',
  ),
]);

const FILTER_GUIDE = [
  '筛选条件，使用 vizserver pheno_filters 格式。',
  '',
  '【字段名格式】所有字段名必须使用 "entity.field_name" 格式（如 "participant.p31"），禁止裸字段名（如 "p31"）。',
  '',
  '【条件选择 — 必须根据字段数据类型选择正确的 condition，否则会导致 422 错误】',
  '- integer / double / integer_categorical（数值型，如 participant.p21003_i0 年龄、participant.p48_i0 腰围）：',
  '  可用: is, is-not, in, not-in, greater-than, greater-than-eq, less-than, less-than-eq, between',
  '  示例: {"participant.p21003_i0": [{"condition": "greater-than", "values": [50]}]}',
  '- string / string_categorical（字符串型，如 participant.eid）：',
  '  可用: is, is-not, in, not-in, contains',
  '  示例: {"participant.eid": [{"condition": "in", "values": ["1000010", "1000011"]}]}',
  '- date / date_categorical（日期型，如 participant.p53_i0）：',
  '  可用: is, is-not, in, not-in（注意：日期字段不支持 greater-than / less-than / between）',
  '  示例: {"participant.p53_i0": [{"condition": "in", "values": ["2010-01-01", "2015-01-01"]}]}',
  '- integer_categorical_multi / hierarchical（多选/层级编码，如 participant.p6138_i0 学历、participant.p20001_i0 癌症编码）：',
  '  可用: any, not-any, all, not-all（注意：不能用 is / in）',
  '  示例: {"participant.p6138_i0": [{"condition": "any", "values": [1, 2]}]}',
  '- date_categorical_sparse / double_categorical_sparse（稀疏日期/稀疏数值，如 participant.p131286 高血压诊断日期）：',
  '  可用: is, is-not, in, not-in（注意：稀疏字段不支持 exists / is-empty / greater-than / less-than / between）',
  '  示例: {"participant.p131286": [{"condition": "in", "values": ["2018-01-01", "2019-01-01"]}]}',
  '',
  '【空值检查】',
  '- exists（字段非空/存在）：不需要 values，示例: {"participant.p670_i0": [{"condition": "exists"}]}',
  '- is-empty（字段为空/不存在）：不需要 values，示例: {"participant.p20049_i0_a0": [{"condition": "is-empty"}]}',
  '- 注意：exists / is-empty 仅适用于非稀疏字段（integer, string, date 等常规类型）',
  '',
  '【禁止事项】',
  '- 禁止使用 not-exists 条件（已移除，请用 is-empty 代替）',
  '- 日期字段（date）不支持 greater-than / less-than / between，请用 in 代替',
  '- 多选/层级字段不支持 is / in，请用 any / all',
  '- 需要 values 的条件（is, is-not, in 等）不能传空 values',
  '',
  '【完整示例】筛选女性且年龄50-60岁且2018年后确诊高血压的参与者：',
  '{"logic":"and","pheno_filters":{"logic":"and","compound":[{"name":"phenotype","logic":"and","filters":{"participant.p31":[{"condition":"is","values":0}],"participant.p21003_i0":[{"condition":"between","values":[50,60]}],"participant.p131286":[{"condition":"greater-than-eq","values":["2018-01-01"]}]}}]}}',
  '',
  '也支持简化 rules 格式，系统会自动转换：',
  '{"logical":"AND","rules":[{"field":"participant.p31","operator":"eq","value":0},{"field":"participant.p21003_i0","operator":"between","values":[50,60]}]}',
  '',
  'rules 格式中的空值检查（无需 value）：',
  '{"logical":"AND","rules":[{"field":"participant.p670_i0","operator":"is_not_null"},{"field":"participant.p20049_i0_a0","operator":"is_null"}]}',
].join('\n');

export const CreateCohortToolDef: ToolDef = {
  desc: '创建一个新的研究队列',
  paramsSchema: z.object({
    name: z.string().describe('队列名称'),
    filters: CohortFiltersSchema.describe(
      '筛选条件。推荐使用简化 rules 格式，系统会自动转换为 vizserver 格式。\n\n' + FILTER_GUIDE,
    ),
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
};

export async function handleCreateCohort(
  client: UkbMcpClient,
  params: CohortCreateRequest,
): Promise<ToolCallResult<unknown>> {
  try {
    const result = await client.createCohort(params);
    return {
      success: true,
      data: result,
      summary: `已创建队列 "${params.name}" (ID: ${result.id}, 参与者: ${result.participant_count})`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      data: null,
      error: message,
      summary: `创建队列失败: ${message}`,
    };
  }
}
