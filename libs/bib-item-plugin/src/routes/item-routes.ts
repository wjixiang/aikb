import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  CreateItemSchema,
  UpdateItemSchema,
  ItemQuerySchema,
  SetItemTagsSchema,
  BatchOperationSchema,
  PaginatedItemsSchema,
  ItemSchema,
  BatchResponseSchema,
} from '../schemas.js';
import { IdParamSchema, DeletedResponseSchema } from '../schemas.js';

export const itemRoutes: FastifyPluginAsync = async (fastify) => {
  const { itemService } = fastify as any;

  fastify.withTypeProvider<ZodTypeProvider>().get(
    '/items',
    {
      schema: {
        querystring: ItemQuerySchema,
        response: { 200: PaginatedItemsSchema },
        tags: ['Items'],
        summary: '获取文献/书籍列表',
        description:
          '分页查询文献列表，支持按关键词搜索、标签筛选、收藏/已读过滤和排序。',
      },
    },
    async (request) => {
      return itemService.listItems(request.query);
    },
  );

  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/items',
    {
      schema: {
        body: CreateItemSchema,
        response: { 201: ItemSchema },
        tags: ['Items'],
        summary: '创建文献/书籍',
        description: '新增一条文献或书籍记录，可同时关联已有标签。',
      },
    },
    async (request, reply) => {
      const item = await itemService.createItem(request.body);
      reply.status(201);
      return item;
    },
  );

  fastify.withTypeProvider<ZodTypeProvider>().get(
    '/items/:id',
    {
      schema: {
        params: IdParamSchema,
        response: { 200: ItemSchema },
        tags: ['Items'],
        summary: '获取文献/书籍详情',
      },
    },
    async (request) => {
      return itemService.getItemById(request.params.id);
    },
  );

  fastify.withTypeProvider<ZodTypeProvider>().put(
    '/items/:id',
    {
      schema: {
        params: IdParamSchema,
        body: UpdateItemSchema,
        response: { 200: ItemSchema },
        tags: ['Items'],
        summary: '更新文献/书籍',
      },
    },
    async (request) => {
      return itemService.updateItem(request.params.id, request.body);
    },
  );

  fastify.withTypeProvider<ZodTypeProvider>().delete(
    '/items/:id',
    {
      schema: {
        params: IdParamSchema,
        response: { 200: DeletedResponseSchema },
        tags: ['Items'],
        summary: '删除文献/书籍',
      },
    },
    async (request) => {
      await itemService.removeItem(request.params.id);
      return { success: true, id: request.params.id };
    },
  );

  fastify.withTypeProvider<ZodTypeProvider>().patch(
    '/items/:id/tags',
    {
      schema: {
        params: IdParamSchema,
        body: SetItemTagsSchema,
        response: { 200: ItemSchema },
        tags: ['Items'],
        summary: '设置文献标签',
      },
    },
    async (request) => {
      return itemService.setItemTags(request.params.id, request.body.tagIds);
    },
  );

  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/items/batch',
    {
      schema: {
        body: BatchOperationSchema,
        response: { 200: BatchResponseSchema },
        tags: ['Items'],
        summary: '批量操作',
        description: '支持: delete, setTags, addTags, removeTags, toggleFavorite',
      },
    },
    async (request) => {
      const { itemIds, operation, tagIds } = request.body;
      return itemService.batchOperation(itemIds, operation, tagIds);
    },
  );
};
