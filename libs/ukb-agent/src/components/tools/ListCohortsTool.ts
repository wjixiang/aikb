import { z } from 'zod';
import type { ToolDef, ToolCallResult } from 'agent-lib/components';
import type { UkbMcpClient } from '../../client/UkbMcpClient.js';

export const ListCohortsToolDef: ToolDef = {
  desc: '列出已创建的队列',
  paramsSchema: z.object({
    name: z.string().optional().describe('按名称过滤'),
    limit: z.number().optional().describe('返回数量限制'),
    refresh: z
      .boolean()
      .optional()
      .describe('是否强制刷新缓存'),
  }),
};

export interface CohortInfo {
  id: string;
  name: string;
  state: string;
}

export function renderCohortsAsMarkdown(cohorts: CohortInfo[]): string {
  if (cohorts.length === 0) {
    return '| ID | Name | State |\n|---|---|---|\n| (无数据) | | |';
  }

  const header = '| ID | Name | State |';
  const separator = '|---|---|---|';
  const rows = cohorts.map((c) =>
    `| ${c.id} | ${c.name} | ${c.state} |`,
  );

  return [header, separator, ...rows].join('\n');
}

export async function handleListCohorts(
  client: UkbMcpClient,
  params: {
    name?: string;
    limit?: number;
    refresh?: boolean;
  },
): Promise<ToolCallResult<CohortInfo[]>> {
  const cohorts = await client.listCohorts({
    ...(params.name && { name: params.name }),
    ...(params.limit && { limit: params.limit }),
    ...(params.refresh && { refresh: params.refresh }),
  });
  const data: CohortInfo[] = cohorts.map((c) => ({
    id: c.id,
    name: c.name,
    state: c.state,
  }));
  return {
    success: true,
    data,
    summary: `找到 ${cohorts.length} 个队列`,
  };
}
