import { z } from 'zod';
import type { ToolDef, ToolCallResult } from 'agent-lib/components';
import type { ExportRequest } from '../../client/types.js';
import type { UkbMcpClient } from '../../client/UkbMcpClient.js';

export const ExportDataToolDef: ToolDef = {
  desc: '导出数据为 CSV 或 Parquet 格式',
  paramsSchema: z.object({
    fields: z
      .array(z.string())
      .describe('导出字段 ID 列表'),
    cohort_id: z
      .string()
      .optional()
      .describe('队列 ID，为空则导出全量'),
    format: z
      .enum(['csv', 'parquet'])
      .optional()
      .describe('导出格式，默认 csv'),
    refresh: z
      .boolean()
      .optional()
      .describe('是否强制刷新缓存'),
  }),
};

export async function handleExportData(
  client: UkbMcpClient,
  params: ExportRequest & { format?: 'csv' | 'parquet' },
): Promise<ToolCallResult<unknown>> {
  const format = params.format ?? 'csv';
  const result =
    format === 'csv'
      ? await client.exportCsv(params)
      : await client.exportParquet(params);
  return {
    success: true,
    data: result,
    summary: `已导出 ${format.toUpperCase()} 格式数据`,
  };
}
