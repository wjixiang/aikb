import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  listItems,
  getItemById,
  createItem,
  updateItem,
  removeItem,
  setItemTags,
  batchOperation,
} from '../services/item.service.js';
import { extractTextFromPdf } from '../services/pdf-extract.service.js';
import { extractMetadataFromText } from '../services/metadata-extract.service.js';
import {
  CreateItemSchema,
  UpdateItemSchema,
  ItemQuerySchema,
  SetItemTagsSchema,
  BatchOperationSchema,
  PaginatedItemsSchema,
  ItemSchema,
  BatchResponseSchema,
  ExtractedMetadataResponseSchema,
} from '../schemas/item.schema.js';
import { BadRequestError, UpstreamError } from '../errors.js';
import { IdParamSchema, DeletedResponseSchema } from '../schemas/common.schema.js';

export async function registerItemRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/items',
    {
      schema: {
        querystring: ItemQuerySchema,
        response: { 200: PaginatedItemsSchema },
        tags: ['Items'],
        summary: '获取文献/书籍列表',
        description: '分页查询文献列表，支持按关键词搜索、标签筛选、收藏/已读过滤和排序。',
      },
    },
    async (request) => {
      return listItems(request.query);
    },
  );

  app.withTypeProvider<ZodTypeProvider>().post(
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
      const item = await createItem(request.body);
      reply.status(201);
      return item;
    },
  );

  app.withTypeProvider<ZodTypeProvider>().get(
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
      return getItemById(request.params.id);
    },
  );

  app.withTypeProvider<ZodTypeProvider>().put(
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
      return updateItem(request.params.id, request.body);
    },
  );

  app.withTypeProvider<ZodTypeProvider>().delete(
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
      await removeItem(request.params.id);
      return { success: true, id: request.params.id };
    },
  );

  app.withTypeProvider<ZodTypeProvider>().patch(
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
      return setItemTags(request.params.id, request.body.tagIds);
    },
  );

  app.withTypeProvider<ZodTypeProvider>().post(
    '/items/batch',
    {
      schema: {
        body: BatchOperationSchema,
        response: { 200: BatchResponseSchema },
        tags: ['Items'],
        summary: '批量操作',
        description: '支持: delete, setTags, addTags, removeTags, markAsRead, markAsUnread, toggleFavorite',
      },
    },
    async (request) => {
      const { itemIds, operation, tagIds } = request.body;
      return batchOperation(itemIds, operation, tagIds);
    },
  );

  app.withTypeProvider<ZodTypeProvider>().post(
    '/items/extract-metadata',
    {
      schema: {
        response: { 200: ExtractedMetadataResponseSchema },
        tags: ['Items'],
        summary: '从PDF提取元数据',
        description: '上传PDF文件，自动提取文献/书籍元数据（标题、作者、摘要等）。',
      },
    },
    async (request) => {
      const data = await request.file();
      if (!data) {
        throw new BadRequestError('No file uploaded');
      }

      if (data.mimetype !== 'application/pdf') {
        throw new BadRequestError('Only PDF files are supported');
      }

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      try {
        const text = await extractTextFromPdf(buffer);
        if (!text.trim()) {
          throw new BadRequestError('Could not extract any text from the PDF');
        }
        return extractMetadataFromText(text);
      } catch (err) {
        if (err instanceof BadRequestError) throw err;
        const message = err instanceof Error ? err.message : 'Failed to extract metadata';
        request.log.error(err, 'Metadata extraction failed');
        throw new UpstreamError(message);
      }
    },
  );
}
