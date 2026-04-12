import { z } from 'zod';
import type { ToolDef, ToolCallResult } from 'agent-lib/components';
import type { DatabaseQueryRequest } from '../../client/types.js';
import type { UkbState } from '../UkbComponent.js';
import type { UkbMcpClient } from '../../client/UkbMcpClient.js';

export const QueryDatabaseToolDef: ToolDef = {
  desc: '直接查询数据库中的指定字段数据（支持分页）',
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
    limit: z
      .number()
      .optional()
      .describe('每页条数，默认 1000'),
    offset: z
      .number()
      .optional()
      .describe('偏移量，默认 0'),
  }),
};

export async function handleQueryDatabase(
  client: UkbMcpClient,
  params: DatabaseQueryRequest & { database_id: string },
): Promise<ToolCallResult<unknown>> {
  const req: DatabaseQueryRequest = {
    ...(params.entity_fields && { entity_fields: params.entity_fields }),
    ...(params.dataset_ref && { dataset_ref: params.dataset_ref }),
    ...(params.refresh && { refresh: params.refresh }),
  };
  const result = await client.queryDatabase(params.database_id, req);
  return {
    success: true,
    data: result,
    summary: `已查询 ${params.entity_fields?.length ?? 0} 个字段`,
  };
}
