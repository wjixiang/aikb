import { z } from 'zod';
import type { ToolDef, ToolCallResult } from 'agent-lib/components';
import type { UkbMcpClient } from '../../client/UkbMcpClient.js';

export const ListDatabasesToolDef: ToolDef = {
  desc: '列出可用的 UKB 数据库',
  paramsSchema: z.object({
    name: z
      .string()
      .optional()
      .describe('按名称过滤数据库'),
    refresh: z
      .boolean()
      .optional()
      .describe('是否强制刷新缓存'),
  }),
};

export interface DatabaseInfo {
  id: string;
  name: string;
  state: string;
}

export function renderDatabasesAsMarkdown(databases: DatabaseInfo[]): string {
  if (databases.length === 0) {
    return '| ID | Name | State |\n|---|---|---|\n| (无数据) | | |';
  }

  const header = '| ID | Name | State |';
  const separator = '|---|---|---|';
  const rows = databases.map((d) =>
    `| ${d.id} | ${d.name} | ${d.state} |`,
  );

  return [header, separator, ...rows].join('\n');
}

export async function handleListDatabases(
  client: UkbMcpClient,
  params: {
    name?: string;
    refresh?: boolean;
  },
): Promise<ToolCallResult<DatabaseInfo[]>> {
  try {
    const dbs = await client.listDatabases({
      ...(params.name && { name: params.name }),
      ...(params.refresh && { refresh: params.refresh }),
    });
    const data: DatabaseInfo[] = dbs.map((d) => ({
      id: d.id,
      name: d.name,
      state: d.state,
    }));
    return {
      success: true,
      data,
      summary: `找到 ${dbs.length} 个数据库`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      data: [],
      error: message,
      summary: `列出数据库失败: ${message}`,
    };
  }
}
