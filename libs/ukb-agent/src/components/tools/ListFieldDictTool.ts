import { z } from 'zod';
import type { ToolDef, ToolCallResult } from 'agent-lib/components';
import type { UkbMcpClient } from '../../client/UkbMcpClient.js';
import type { FieldDictPage, FieldDictItem } from './QueryFieldDictTool.js';

export const ListFieldDictToolDef: ToolDef = {
  desc: '浏览字段字典（分页列表）',
  paramsSchema: z.object({
    page: z.number().optional().describe('页码，默认 1'),
    page_size: z
      .number()
      .optional()
      .describe('每页条数，默认 20'),
  }),
};

export function renderFieldDictPageAsMarkdown(page: FieldDictPage): string {
  const totalPages = Math.ceil(page.total / page.pageSize) || 1;
  const meta = `**共 ${page.total} 条，第 ${page.page}/${totalPages} 页，每页 ${page.pageSize} 条**\n`;
  if (page.data.length === 0) {
    return meta + '| Entity | Name | Type | Title | Description |\n|---|---|---|---|---|\n| (无数据) | | | | |';
  }

  const header = '| Entity | Name | Type | Title | Description |';
  const separator = '|---|---|---|---|---|';
  const rows = page.data.map((d) => {
    const title = d.title || '';
    const desc = d.description || '';
    const truncatedDesc = desc.length > 100 ? desc.substring(0, 100) + '...' : desc;
    return `| ${d.entity} | ${d.name} | ${d.type} | ${title} | ${truncatedDesc} |`;
  });

  return meta + [header, separator, ...rows].join('\n');
}

export async function handleListFieldDict(
  client: UkbMcpClient,
  params: {
    page?: number;
    page_size?: number;
  },
): Promise<ToolCallResult<FieldDictPage>> {
  try {
    const result = await client.listFieldsDict({
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
      summary: `字段字典共 ${result.total} 条，当前第 ${result.page} 页（${result.data.length} 条）`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      data: { total: 0, page: 1, pageSize: 20, data: [] },
      error: message,
      summary: `列出字段字典失败: ${message}`,
    };
  }
}
