import type { ToolDef, ToolCallResult } from 'agent-lib/components';
import type { UkbMcpClient } from '../../client/UkbMcpClient.js';

export const ListEntitiesToolDef: ToolDef = {
  desc: '列出 UKB 字段字典中的所有 entity 及其字段数量',
  paramsSchema: {} as any,
};

export async function handleListEntities(
  client: UkbMcpClient,
): Promise<ToolCallResult<{ entity: string; field_count: number }[] | null>> {
  try {
    const result = await client.listFieldsDict({ page: 1, page_size: 1 });
    const total = result.total;
    const allFields = await client.listFieldsDict({ page: 1, page_size: total });
    const entityMap = new Map<string, number>();
    for (const f of allFields.data) {
      entityMap.set(f.entity, (entityMap.get(f.entity) ?? 0) + 1);
    }
    const entities = Array.from(entityMap.entries())
      .map(([entity, field_count]) => ({ entity, field_count }))
      .sort((a, b) => b.field_count - a.field_count);
    return {
      success: true,
      data: entities,
      summary: `共 ${entities.length} 个 entity`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      data: null,
      error: message,
      summary: `列出 entity 失败: ${message}`,
    };
  }
}
