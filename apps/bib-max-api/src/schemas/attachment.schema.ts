import { z } from 'zod';

export const AttachmentSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number().int().nullable().optional(),
  createdAt: z.date(),
});

export const AttachmentListSchema = z.object({
  data: z.array(AttachmentSchema),
});

export const PresignedUrlSchema = z.object({
  url: z.string(),
  expiresAt: z.date(),
});

export const ItemIdParamSchema = z.object({
  itemId: z.string().uuid().describe('文献 ID'),
});

export const AttachmentIdParamSchema = z.object({
  itemId: z.string().uuid().describe('文献 ID'),
  id: z.string().uuid().describe('附件 ID'),
});

export const PresignedUploadBodySchema = z.object({
  fileName: z.string(),
  contentType: z.string(),
});

export const PresignedUploadResponseSchema = z.object({
  attachmentId: z.string().uuid(),
  url: z.string(),
  expiresAt: z.date(),
});

export const ConfirmUploadBodySchema = z.object({
  attachmentId: z.string().uuid(),
  fileName: z.string(),
  contentType: z.string(),
  fileSize: z.number().int().optional(),
});
