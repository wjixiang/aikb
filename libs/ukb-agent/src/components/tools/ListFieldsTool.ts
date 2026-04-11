import { z } from 'zod';
import type { ToolDef } from 'agent-lib/components';

export const ListFieldsToolDef: ToolDef = {
  desc: '列出数据库中的字段（可按 entity 或名称过滤）',
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
  }),
};

export interface FieldInfo {
  entity: string;
  name: string;
  type: string;
  title: string;
}

/**
 * Render fields as a markdown table
 */
export function renderFieldsAsMarkdown(fields: FieldInfo[]): string {
  if (fields.length === 0) {
    return '| Entity | Name | Type | Title |\n|---|---|---|---|\n| (无数据) | | | |';
  }

  const header = '| Entity | Name | Type | Title |';
  const separator = '|---|---|---|---|';
  const rows = fields.map((f) =>
    `| ${f.entity} | ${f.name} | ${f.type} | ${f.title || ''} |`,
  );

  return [header, separator, ...rows].join('\n');
}
