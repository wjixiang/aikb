import { z } from 'zod';
import type { ToolDef, ToolCallResult } from 'agent-lib/components';
import type { UkbMcpClient } from '../../client/UkbMcpClient.js';

export const DownloadCohortToolDef: ToolDef = {
  desc: '下载队列全部关联字段的完整数据至 Iceberg Data Lake（注意：数据量可能很大）',
  paramsSchema: z.object({
    cohort_id: z.string().describe('队列 ID'),
    refresh: z
      .boolean()
      .optional()
      .describe('是否跳过缓存'),
  }),
};

export interface CohortDownloadResponse {
  cohort_id: string;
  cohort_name: string;
  row_count: number;
  field_count: number;
  namespace: string;
  table_name: string;
}

export async function handleDownloadCohort(
  client: UkbMcpClient,
  params: { cohort_id: string; refresh?: boolean },
): Promise<ToolCallResult<CohortDownloadResponse | null>> {
  try {
    const result = await client.downloadCohort(params.cohort_id, {
      ...(params.refresh && { refresh: params.refresh }),
    });
    return {
      success: true,
      data: result,
      summary: `下载队列 "${result.cohort_name}" 成功：${result.row_count} 行 × ${result.field_count} 列，已下沉至 Iceberg ${result.namespace}.${result.table_name}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      data: null,
      error: message,
      summary: `下载队列失败: ${message}`,
    };
  }
}