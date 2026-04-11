import { z } from 'zod';
import type { ToolDef, ToolCallResult } from 'agent-lib/components';
import type { ExtractFieldsRequest } from '../../client/types.js';
import type { UkbState } from '../UkbComponent.js';
import type { UkbMcpClient } from '../../client/UkbMcpClient.js';

export const ExtractCohortDataToolDef: ToolDef = {
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
};

export async function handleExtractCohortData(
  client: UkbMcpClient,
  params: ExtractFieldsRequest & { cohort_id: string },
): Promise<ToolCallResult<unknown>> {
  const req: ExtractFieldsRequest = {
    entity_fields: params.entity_fields,
    ...(params.refresh && { refresh: params.refresh }),
  };
  const result = await client.extractCohortFields(params.cohort_id, req);
  return {
    success: true,
    data: result,
    summary: `已从队列 ${params.cohort_id} 提取 ${params.entity_fields.length} 个字段的数据`,
  };
}
