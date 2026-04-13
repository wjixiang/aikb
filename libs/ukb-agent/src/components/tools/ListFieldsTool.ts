import { z } from 'zod';
import type { ToolDef } from 'agent-lib/components';

export const ListFieldsToolDef: ToolDef = {
  desc: '列出数据库中的字段（可按 entity 或名称过滤，支持分页）',
  paramsSchema: z.object({
    database_id: z.string().describe('数据库 ID'),
    entity: z
      .string()
      .optional()
      .describe('按实体名过滤，如 participant'),
    name: z
      .string()
      .optional()
      .describe('按字段名模糊搜索'),
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

export interface FieldInfo {
  entity: string;
  name: string;
  type: string;
  title: string;
}

export interface FieldPage {
  data: FieldInfo[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Render fields as a markdown table with pagination metadata
 */
export function renderFieldsAsMarkdown(page: FieldPage): string {
  const meta = `**共 ${page.total} 条，当前 ${page.offset + 1}-${Math.min(page.offset + page.limit, page.total)} 条**\n`;
  if (page.data.length === 0) {
    return meta + '| Entity | Name | Type | Title |\n|---|---|---|---|\n| (无数据) | | | |';
  }

  const header = '| Entity | Name | Type | Title |';
  const separator = '|---|---|---|---|';
  const rows = page.data.map((f) =>
    `| ${f.entity} | ${f.name} | ${f.type} | ${f.title || ''} |`,
  );

  return meta + [header, separator, ...rows].join('\n');
}
