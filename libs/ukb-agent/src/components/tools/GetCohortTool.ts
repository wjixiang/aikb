import { z } from 'zod';
import type { ToolDef, ToolCallResult } from 'agent-lib/components';
import type { UkbState } from '../UkbComponent.js';
import type { UkbMcpClient } from '../../client/UkbMcpClient.js';

export const GetCohortToolDef: ToolDef = {
  desc: '获取队列的详细信息',
  paramsSchema: z.object({
    cohort_id: z.string().describe('队列 ID'),
    refresh: z
      .boolean()
      .optional()
      .describe('是否强制刷新缓存'),
  }),
};

export async function handleGetCohort(
  client: UkbMcpClient,
  params: {
    cohort_id: string;
    refresh?: boolean;
  },
): Promise<ToolCallResult<unknown>> {
  const opts = params.refresh ? { refresh: params.refresh } : {};
  const detail = await client.getCohort(params.cohort_id, opts);
  return {
    success: true,
    data: detail,
    summary: `队列: ${detail.name} (ID: ${detail.id}, 状态: ${detail.state})`,
  };
}
