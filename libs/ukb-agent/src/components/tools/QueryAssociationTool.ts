import { z } from 'zod';
import type { ToolDef, ToolCallResult } from 'agent-lib/components';
import type { AssociationQuery } from '../../client/types.js';
import type { UkbState } from '../UkbComponent.js';
import type { UkbMcpClient } from '../../client/UkbMcpClient.js';

export const QueryAssociationToolDef: ToolDef = {
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
};

export async function handleQueryAssociation(
  client: UkbMcpClient,
  params: AssociationQuery,
): Promise<ToolCallResult<unknown>> {
  const result = await client.queryAssociation(params);
  return {
    success: true,
    data: result,
    summary: `已查询 ${params.biomarker_id} 的关联分析${params.outcome_id ? `（结局: ${params.outcome_id}）` : ''}`,
  };
}
