import { z } from 'zod';

export const ErrorResponseSchema = z.object({
  statusCode: z.number().int().describe('HTTP 状态码'),
  error: z.string().describe('错误类型'),
  message: z.string().describe('错误描述'),
});

export const IdParamSchema = z.object({
  id: z.string().uuid().describe('记录 ID'),
});

export const DeletedResponseSchema = z.object({
  success: z.boolean().describe('操作是否成功'),
  id: z.string().uuid().describe('被删除的记录 ID'),
});
