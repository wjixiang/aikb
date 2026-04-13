import { z } from 'zod';
import type { ToolDef, ToolCallResult } from 'agent-lib/components';
import type { CohortCreateRequest } from '../../client/types.js';
import type { UkbMcpClient } from '../../client/UkbMcpClient.js';

// ── Vizserver native pheno_filters schema ──────────────────────────────

const VizFilterConditionSchema = z.object({
  condition: z.string().describe(
    '条件类型：exists, is, in, not-in, greater-than, less-than, between 等',
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

export const CreateCohortToolDef: ToolDef = {
  desc: '创建一个新的研究队列',
  paramsSchema: z.object({
    name: z.string().describe('队列名称'),
    filters: CohortFiltersSchema.describe(
      '筛选条件。推荐使用简化 rules 格式，系统会自动转换为 vizserver 格式。',
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
