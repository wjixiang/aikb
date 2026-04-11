import { z } from 'zod';
import type { ToolDef, ToolCallResult } from 'agent-lib/components';
import type { UkbMcpClient } from '../../client/UkbMcpClient.js';

export const ListTablesToolDef: ToolDef = {
  desc: '列出数据库中的所有数据表',
  paramsSchema: z.object({
    database_id: z.string().describe('数据库 ID'),
    refresh: z
      .boolean()
      .optional()
      .describe('是否强制刷新缓存'),
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
  },
): Promise<ToolCallResult<TableInfo[]>> {
  const opts = params.refresh ? { refresh: params.refresh } : {};
  const tables = await client.listTables(params.database_id, opts);
  const data: TableInfo[] = tables.map((t) => ({ name: t.name }));
  return {
    success: true,
    data,
    summary: `数据库 ${params.database_id} 包含 ${tables.length} 个表`,
  };
}
