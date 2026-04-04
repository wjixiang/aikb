import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { listTags, getTagById, createTag, updateTag, removeTag } from '../services/tag.service.js';
import {
  CreateTagSchema,
  UpdateTagSchema,
  TagQuerySchema,
  PaginatedTagsSchema,
  TagSchema,
} from '../schemas/tag.schema.js';
import { IdParamSchema, DeletedResponseSchema } from '../schemas/common.schema.js';

export async function registerTagRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/tags',
    {
      schema: {
        querystring: TagQuerySchema,
        response: { 200: PaginatedTagsSchema },
        tags: ['Tags'],
        summary: '获取标签列表',
        description: '分页查询标签列表，设置 withCount=true 可返回每个标签关联的文献数量。',
      },
    },
    async (request) => {
      return listTags(request.query);
    },
  );

  app.withTypeProvider<ZodTypeProvider>().post(
    '/tags',
    {
      schema: {
        body: CreateTagSchema,
        response: { 201: TagSchema },
        tags: ['Tags'],
        summary: '创建标签',
      },
    },
    async (request, reply) => {
      const tag = await createTag(request.body);
      reply.status(201);
      return tag;
    },
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/tags/:id',
    {
      schema: {
        params: IdParamSchema,
        response: { 200: TagSchema },
        tags: ['Tags'],
        summary: '获取标签详情',
      },
    },
    async (request) => {
      return getTagById(request.params.id);
    },
  );

  app.withTypeProvider<ZodTypeProvider>().put(
    '/tags/:id',
    {
      schema: {
        params: IdParamSchema,
        body: UpdateTagSchema,
        response: { 200: TagSchema },
        tags: ['Tags'],
        summary: '更新标签',
      },
    },
    async (request) => {
      return updateTag(request.params.id, request.body);
    },
  );

  app.withTypeProvider<ZodTypeProvider>().delete(
    '/tags/:id',
    {
      schema: {
        params: IdParamSchema,
        response: { 200: DeletedResponseSchema },
        tags: ['Tags'],
        summary: '删除标签',
      },
    },
    async (request) => {
      await removeTag(request.params.id);
      return { success: true, id: request.params.id };
    },
  );
}
