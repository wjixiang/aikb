import { z } from 'zod';
import type { ToolDef, ToolCallResult } from 'agent-lib/components';
import type { UkbMcpClient } from '../../client/UkbMcpClient.js';

export const DescribeDatabaseToolDef: ToolDef = {
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
};

export async function handleDescribeDatabase(
  client: UkbMcpClient,
  params: {
    database_id: string;
    refresh?: boolean;
  },
): Promise<ToolCallResult<unknown>> {
  const opts = params.refresh ? { refresh: params.refresh } : {};
  const result = await client.describeDatabase(params.database_id, opts);
  return {
    success: true,
    data: result,
    summary: `已获取数据库 ${params.database_id} 的详细描述`,
  };
}
