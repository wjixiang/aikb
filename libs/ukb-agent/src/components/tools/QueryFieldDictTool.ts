import { z } from 'zod';
import type { ToolDef, ToolCallResult } from 'agent-lib/components';
import type { UkbMcpClient } from '../../client/UkbMcpClient.js';

export const QueryFieldDictToolDef: ToolDef = {
  desc: '在字段字典中搜索字段（按条件搜索，支持名称、描述、概念等）',
  paramsSchema: z.object({
    condition: z
      .string()
      .describe(
        '搜索条件，如 "blood pressure"、"diabetes"、"ICD10"。 查询语法为SQL的condition部分的语法，支持`%`、`_`等通配符',
      ),
    page: z.number().optional().describe('页码，默认 1'),
    page_size: z
      .number()
      .optional()
      .describe('每页条数，默认 20'),
  }),
};

export interface FieldDictItem {
  entity: string;
  name: string;
  type: string;
  title: string | null;
  description: string | null;
  units: string | null;
  coding_name: string | null;
  concept: string | null;
}

export interface FieldDictPage {
  total: number;
  page: number;
  pageSize: number;
  data: FieldDictItem[];
}

export function renderFieldDictAsMarkdown(page: FieldDictPage): string {
  if (page.data.length === 0) {
    return '| Entity | Name | Type | Title | Description |\n|---|---|---|---|---|\n| (无数据) | | | | |';
  }

  const header = '| Entity | Name | Type | Title | Description |';
  const separator = '|---|---|---|---|---|';
  const rows = page.data.map((d) => {
    const title = d.title || '';
    const desc = d.description || '';
    // Truncate long descriptions
    const truncatedDesc = desc.length > 100 ? desc.substring(0, 100) + '...' : desc;
    return `| ${d.entity} | ${d.name} | ${d.type} | ${title} | ${truncatedDesc} |`;
  });

  return [header, separator, ...rows].join('\n');
}

export async function handleQueryFieldDict(
  client: UkbMcpClient,
  params: {
    condition: string;
    page?: number;
    page_size?: number;
  },
): Promise<ToolCallResult<FieldDictPage>> {
  const result = await client.queryFieldsDict({
    condition: params.condition,
    ...(params.page && { page: params.page }),
    ...(params.page_size && { page_size: params.page_size }),
  });
  const data: FieldDictPage = {
    total: result.total,
    page: result.page,
    pageSize: result.page_size,
    data: result.data.map((d) => ({
      entity: d.entity,
      name: d.name,
      type: d.type,
      title: d.title ?? null,
      description: d.description ?? null,
      units: d.units ?? null,
      coding_name: d.coding_name ?? null,
      concept: d.concept ?? null,
    })),
  };
  return {
    success: true,
    data,
    summary: `搜索 "${params.condition}" 共 ${result.total} 条结果，当前第 ${result.page} 页`,
  };
}
