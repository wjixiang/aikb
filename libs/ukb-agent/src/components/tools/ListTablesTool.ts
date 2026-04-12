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
      .describe('每页条数，默认 100，最大 100'),
    offset: z
      .number()
      .optional()
      .describe('偏移量，默认 0'),
  }),
};

export interface TableInfo {
  name: string;
}

export interface TablePage {
  data: TableInfo[];
  total: number;
  limit: number;
  offset: number;
}

export function renderTablesAsMarkdown(page: TablePage): string {
  const meta = `**共 ${page.total} 条，当前 ${page.offset + 1}-${Math.min(page.offset + page.limit, page.total)} 条**\n`;
  if (page.data.length === 0) {
    return meta + '| Table Name |\n|---|\n| (无数据) |';
  }

  const header = '| Table Name |';
  const separator = '|---|';
  const rows = page.data.map((t) => `| ${t.name} |`);

  return meta + [header, separator, ...rows].join('\n');
}
