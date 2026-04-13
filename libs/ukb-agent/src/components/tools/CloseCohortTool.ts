import { z } from 'zod';
import type { ToolDef, ToolCallResult } from 'agent-lib/components';
import type { UkbMcpClient } from '../../client/UkbMcpClient.js';

export const CloseCohortToolDef: ToolDef = {
  desc: '锁定（关闭）队列，使其变为只读状态。关闭后的队列无法再添加或修改数据。',
  paramsSchema: z.object({
    cohort_id: z.string().describe('队列 ID'),
  }),
};

export async function handleCloseCohort(
  client: UkbMcpClient,
  params: {
    cohort_id: string;
  },
): Promise<ToolCallResult<unknown>> {
  try {
    const detail = await client.closeCohort(params.cohort_id);
    return {
      success: true,
      data: detail,
      summary: `已锁定队列: ${detail.name} (ID: ${detail.id}, 状态: ${detail.state})`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      data: null,
      error: message,
      summary: `锁定队列失败: ${message}`,
    };
  }
}
