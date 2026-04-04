import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  generateUploadUrl,
  confirmUpload,
  listAttachments,
  getDownloadUrl,
  removeAttachment,
} from '../services/attachment.service.js';
import {
  AttachmentSchema,
  AttachmentListSchema,
  PresignedUrlSchema,
  ItemIdParamSchema,
  AttachmentIdParamSchema,
  PresignedUploadBodySchema,
  PresignedUploadResponseSchema,
  ConfirmUploadBodySchema,
} from '../schemas/attachment.schema.js';
import { DeletedResponseSchema } from '../schemas/common.schema.js';

export async function registerAttachmentRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/items/:itemId/attachments/upload-url',
    {
      schema: {
        params: ItemIdParamSchema,
        body: PresignedUploadBodySchema,
        response: { 200: PresignedUploadResponseSchema },
        tags: ['Attachments'],
        summary: '获取预签名上传 URL',
        description: '生成预签名上传 URL，客户端直接上传文件到 S3，完成后调用确认接口。',
      },
    },
    async (request) => {
      const { itemId } = request.params;
      return generateUploadUrl(itemId, request.body.fileName, request.body.contentType);
    },
  );

  app.withTypeProvider<ZodTypeProvider>().post(
    '/items/:itemId/attachments',
    {
      schema: {
        params: ItemIdParamSchema,
        body: ConfirmUploadBodySchema,
        response: { 201: AttachmentSchema },
        tags: ['Attachments'],
        summary: '确认上传并创建附件',
      },
    },
    async (request, reply) => {
      const { itemId } = request.params;
      const { attachmentId, fileName, contentType, fileSize } = request.body;
      const attachment = await confirmUpload(itemId, attachmentId, fileName, contentType, fileSize);
      reply.status(201);
      return attachment;
    },
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/items/:itemId/attachments',
    {
      schema: {
        params: ItemIdParamSchema,
        response: { 200: AttachmentListSchema },
        tags: ['Attachments'],
        summary: '获取附件列表',
      },
    },
    async (request) => {
      const data = await listAttachments(request.params.itemId);
      return { data };
    },
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/items/:itemId/attachments/:id/download',
    {
      schema: {
        params: AttachmentIdParamSchema,
        response: { 200: PresignedUrlSchema },
        tags: ['Attachments'],
        summary: '获取下载 URL',
      },
    },
    async (request) => {
      return getDownloadUrl(request.params.itemId, request.params.id);
    },
  );

  app.withTypeProvider<ZodTypeProvider>().delete(
    '/items/:itemId/attachments/:id',
    {
      schema: {
        params: AttachmentIdParamSchema,
        response: { 200: DeletedResponseSchema },
        tags: ['Attachments'],
        summary: '删除附件',
      },
    },
    async (request) => {
      await removeAttachment(request.params.itemId, request.params.id);
      return { success: true, id: request.params.id };
    },
  );
}
