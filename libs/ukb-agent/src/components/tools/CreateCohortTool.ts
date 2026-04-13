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
      .describe(
        '筛选条件，使用 vizserver pheno_filters 格式。' +
        '【重要】所有字段名必须使用 "entity.field_name" 格式（如 "participant.p31"、"olink_instance_0.p131286"），禁止使用裸字段名（如 "p31"）。' +
        '示例：{"logic":"and","pheno_filters":{"logic":"and","compound":[{"name":"phenotype","logic":"and","filters":{"participant.p131286":[{"condition":"exists","values":[]}]}}]}}。' +
        '也支持简化格式：{"logical":"AND","rules":[{"field":"participant.p131286","operator":"is_not_null"}]}，系统会自动转换为 vizserver 格式。',
      ),
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
