import { z } from 'zod';
import type { ToolDef, ToolCallResult } from 'agent-lib/components';
import type { CohortCreateRequest } from '../../client/types.js';
import type { UkbMcpClient } from '../../client/UkbMcpClient.js';

export const CreateCohortToolDef: ToolDef = {
  desc: '创建一个新的研究队列',
  paramsSchema: z.object({
    name: z.string().describe('队列名称'),
    filters: z
      .record(z.unknown())
      .describe('筛选条件（vizserver pheno_filters 格式）'),
    description: z
      .string()
      .optional()
      .describe('队列描述'),
    folder: z
      .string()
      .optional()
      .describe('目标文件夹路径，默认 "/"'),
    entity_fields: z
      .array(z.string())
      .optional()
      .describe(
        '关联字段列表，格式 "entity.field_name"',
      ),
  }),
};

export async function handleCreateCohort(
  client: UkbMcpClient,
  params: CohortCreateRequest,
): Promise<ToolCallResult<unknown>> {
  const result = await client.createCohort(params);
  return {
    success: true,
    data: result,
    summary: `已创建队列 "${params.name}" (ID: ${result.id}, 参与者: ${result.participant_count})`,
  };
}
