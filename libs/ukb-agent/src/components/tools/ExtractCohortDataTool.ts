import { z } from 'zod';
import type { ToolDef, ToolCallResult } from 'agent-lib/components';
import type { ExtractFieldsRequest } from '../../client/types.js';
import type { UkbState } from '../UkbComponent.js';
import type { UkbMcpClient } from '../../client/UkbMcpClient.js';

export const ExtractCohortDataToolDef: ToolDef = {
  desc: '从队列中提取指定字段的数据（支持分页）',
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
    limit: z
      .number()
      .optional()
      .describe('每页条数，默认 100，最大 100'),
    offset: z
      .number()
      .optional()
      .describe('偏移量，默认 0'),
  }),
};

export async function handleExtractCohortData(
  client: UkbMcpClient,
  params: ExtractFieldsRequest & { cohort_id: string },
): Promise<ToolCallResult<unknown>> {
  try {
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
