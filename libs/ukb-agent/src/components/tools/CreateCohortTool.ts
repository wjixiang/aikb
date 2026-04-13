import { z } from 'zod';
import type { ToolDef, ToolCallResult } from 'agent-lib/components';
import type { CohortCreateRequest } from '../../client/types.js';
import type { UkbMcpClient } from '../../client/UkbMcpClient.js';

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
  '  可用: is, is-not, in, not-in（注意：稀疏字段不支持 exists / not-exists / greater-than / less-than / between）',
  '  示例: {"participant.p131286": [{"condition": "in", "values": ["2018-01-01", "2019-01-01"]}]}',
  '',
  '【禁止事项】',
  '- exists / not-exists 条件在所有字段类型上均不支持，禁止使用',
  '- 日期字段（date）不支持 greater-than / less-than / between，请用 in 代替',
  '- 多选/层级字段不支持 is / in，请用 any / all',
  '',
  '【完整示例】筛选女性且年龄50-60岁且2018年后确诊高血压的参与者：',
  '{"logic":"and","pheno_filters":{"logic":"and","compound":[{"name":"phenotype","logic":"and","filters":{"participant.p31":[{"condition":"is","values":0}],"participant.p21003_i0":[{"condition":"between","values":[50,60]}],"participant.p131286":[{"condition":"greater-than-eq","values":["2018-01-01"]}]}}]}}',
  '',
  '也支持简化 rules 格式，系统会自动转换：',
  '{"logical":"AND","rules":[{"field":"participant.p31","operator":"eq","value":0},{"field":"participant.p21003_i0","operator":"between","values":[50,60]}]}',
].join('\n');

export const CreateCohortToolDef: ToolDef = {
  desc: '创建一个新的研究队列',
  paramsSchema: z.object({
    name: z.string().describe('队列名称'),
    filters: z.record(z.unknown()).describe(FILTER_GUIDE),
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
  const result = await client.createCohort(params);
  return {
    success: true,
    data: result,
    summary: `已创建队列 "${params.name}" (ID: ${result.id}, 参与者: ${result.participant_count})`,
  };
}
