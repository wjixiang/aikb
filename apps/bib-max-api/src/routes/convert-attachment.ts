import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { BadRequestError, NotFoundError, UpstreamError } from '../errors.js';
import { fileConvertService } from '../services/file-convert.service.js';
import { getStorage } from '../storage/instance.js';
import { createAttachmentRepository } from '../adapters/attachment-repository.js';
import { createItemRepository } from '../adapters/item-repository.js';
import { categorizeByMimeType } from 'bib-item-plugin';

const ConvertBodySchema = z.object({
  attachmentId: z.string().uuid(),
});

const ConvertResponseSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number().int().nullable().optional(),
  category: z.string(),
  createdAt: z.date(),
});

export async function registerConvertAttachmentRoute(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/items/:itemId/attachments/convert-to-md',
    {
      schema: {
        params: z.object({ itemId: z.string().uuid() }),
        body: ConvertBodySchema,
        response: { 201: ConvertResponseSchema },
        tags: ['Attachments'],
        summary: 'PDF转Markdown',
        description: '将指定PDF附件转换为Markdown，并作为新附件添加到同一Item下。',
      },
    },
    async (request, reply) => {
      const { itemId } = request.params;
      const { attachmentId } = request.body;

      const itemRepo = createItemRepository();
      const attachmentRepo = createAttachmentRepository();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const storage = getStorage() as any;

      // Verify item exists
      const item = await itemRepo.findById(itemId);
      if (!item) {
        throw new NotFoundError('Item', itemId);
      }

      // Get the PDF attachment
      const attachment = await attachmentRepo.findByIdAndItemId(attachmentId, itemId);
      if (!attachment) {
        throw new NotFoundError('Attachment', attachmentId);
      }

      if (!attachment.fileType.includes('pdf')) {
        throw new BadRequestError('Only PDF attachments can be converted to Markdown');
      }

      try {
        // Convert PDF to Markdown via file-renderer
        const markdown = await fileConvertService.convertS3ToMarkdown(attachment.s3Key);

        // Generate S3 key for the markdown file
        const mdFileName = attachment.fileName.replace(/\.pdf$/i, '.md');
        const mdId = crypto.randomUUID();
        const s3Key = `attachments/${itemId}/${mdId}.md`;

        // Upload markdown to S3
        const buffer = Buffer.from(markdown, 'utf-8');
        await storage.upload({
          key: s3Key,
          body: buffer,
          contentType: 'text/markdown',
        });

        // Create attachment record
        const newAttachment = await attachmentRepo.create({
          itemId,
          fileName: mdFileName,
          fileType: 'text/markdown',
          fileSize: BigInt(buffer.length),
          s3Key,
        });

        return reply.status(201).send({
          id: newAttachment.id,
          itemId: newAttachment.itemId,
          fileName: newAttachment.fileName,
          fileType: newAttachment.fileType,
          fileSize: newAttachment.fileSize != null ? Number(newAttachment.fileSize) : null,
          category: categorizeByMimeType('text/markdown'),
          createdAt: newAttachment.createdAt,
        });
      } catch (err) {
        if (err instanceof BadRequestError || err instanceof NotFoundError) throw err;
        const message = err instanceof Error ? err.message : 'PDF conversion failed';
        request.log.error(err, 'PDF to Markdown conversion failed');
        throw new UpstreamError(message);
      }
    },
  );
}
