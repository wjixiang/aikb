import { z } from 'zod';
import type { ToolDef, ToolCallResult } from 'agent-lib/components';
import type { ExtractFieldsRequest } from '../../client/types.js';
import type { UkbMcpClient } from '../../client/UkbMcpClient.js';

export const PreviewCohortDataToolDef: ToolDef = {
  desc: '预览队列中指定字段的数据（支持分页）',
  paramsSchema: z.object({
    cohort_id: z.string().describe('队列 ID'),
    entity_fields: z
      .array(z.string())
      .describe(
        '要预览的字段列表，格式 "entity.field_name"',
      ),
    refresh: z
      .boolean()
      .optional()
      .describe('是否跳过缓存'),
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

export function renderCohortDataAsMarkdown(
  data: Record<string, unknown>[],
  total: number,
  offset: number,
  limit: number,
): string {
  const meta = `**共 ${total} 条，当前 ${offset + 1}-${Math.min(offset + limit, total)} 条**\n`;
  if (data.length === 0) {
    return meta + '| (无数据) |\n|---|\n';
  }

  const firstRow = data[0];
  const fields = firstRow ? Object.keys(firstRow) : [];
  const header = '| ' + fields.join(' | ') + ' |';
  const separator = '|' + fields.map(() => '---').join('|') + '|';
  const rows = data.map((row) => '| ' + fields.map((f) => String(row[f] ?? '')).join(' | ') + ' |');

  return meta + [header, separator, ...rows].join('\n');
}

export interface PreviewCohortDataResult {
  data: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
}

export async function handlePreviewCohortData(
  client: UkbMcpClient,
  params: ExtractFieldsRequest & { cohort_id: string },
): Promise<ToolCallResult<PreviewCohortDataResult | null>> {
  try {
    const result = await client.extractCohortFields(params.cohort_id, {
      entity_fields: params.entity_fields,
      ...(params.refresh && { refresh: params.refresh }),
      ...(params.limit && { limit: params.limit }),
      ...(params.offset && { offset: params.offset }),
    });
    return {
      success: true,
      data: {
        data: result.data as Record<string, unknown>[],
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
      summary: `预览到 ${result.total} 条，当前 ${result.offset + 1}-${Math.min(result.offset + result.limit, result.total)} 条`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      data: null,
      error: message,
      summary: `预览队列数据失败: ${message}`,
    };
  }
}
