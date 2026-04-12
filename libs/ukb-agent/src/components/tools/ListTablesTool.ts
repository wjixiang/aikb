import { z } from 'zod';
import type { ToolDef, ToolCallResult } from 'agent-lib/components';
import type { UkbMcpClient } from '../../client/UkbMcpClient.js';

export const ListTablesToolDef: ToolDef = {
  desc: '列出数据库中的所有数据表（支持分页）',
  paramsSchema: z.object({
    database_id: z.string().describe('数据库 ID'),
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

export interface TableInfo {
  name: string;
}

export function renderTablesAsMarkdown(tables: TableInfo[]): string {
  if (tables.length === 0) {
    return '| Table Name |\n|---|\n| (无数据) |';
  }

  const header = '| Table Name |';
  const separator = '|---|';
  const rows = tables.map((t) => `| ${t.name} |`);

  return [header, separator, ...rows].join('\n');
}

export async function handleListTables(
  client: UkbMcpClient,
  params: {
    database_id: string;
    refresh?: boolean;
    limit?: number;
    offset?: number;
  },
): Promise<ToolCallResult<TableInfo[]>> {
  const result = await client.listTables(params.database_id, {
    ...(params.refresh && { refresh: params.refresh }),
    ...(params.limit && { limit: params.limit }),
    ...(params.offset && { offset: params.offset }),
  });
  const data: TableInfo[] = result.data.map((t) => ({ name: t.name }));
  return {
    success: true,
    data,
    summary: `共 ${result.total} 条，当前 ${result.offset + 1}-${Math.min(result.offset + result.limit, result.total)} 条`,
  };
}
