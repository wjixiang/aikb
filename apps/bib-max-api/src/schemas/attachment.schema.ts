import { z } from 'zod';

// ============ Attachment Category ============

export const ATTACHMENT_CATEGORIES = [
  'pdf',
  'image',
  'video',
  'audio',
  'markdown',
  'document',
  'code',
  'text',
  'archive',
  'unknown',
] as const;

export type AttachmentCategory = (typeof ATTACHMENT_CATEGORIES)[number];

export const AttachmentCategorySchema = z.enum(ATTACHMENT_CATEGORIES);

export function categorizeByMimeType(mimeType: string): AttachmentCategory {
  const t = mimeType.toLowerCase();

  if (t === 'application/pdf') return 'pdf';
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  if (t === 'text/markdown' || t === 'text/x-markdown') return 'markdown';

  // Office documents
  if (
    t.includes('officedocument.wordprocessingml') ||
    t === 'application/msword'
  ) return 'document';
  if (
    t.includes('officedocument.spreadsheetml') ||
    t === 'application/vnd.ms-excel'
  ) return 'document';
  if (
    t.includes('officedocument.presentationml') ||
    t === 'application/vnd.ms-powerpoint'
  ) return 'document';

  // Archives
  if (
    ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
     'application/gzip', 'application/x-tar', 'application/x-bzip2',
     'application/x-zstd'].includes(t)
  ) return 'archive';

  // Code files
  if (
    ['application/json', 'application/xml', 'application/x-yaml', 'application/yaml',
     'application/x-toml', 'application/javascript', 'application/typescript',
     'application/x-javascript', 'application/x-python', 'application/x-sh',
     'application/sql'].includes(t)
  ) return 'code';
  if (
    t.startsWith('text/') && t !== 'text/plain'
  ) return 'code';

  if (t === 'text/plain') return 'text';

  return 'unknown';
}

export const AttachmentSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number().int().nullable().optional(),
  category: AttachmentCategorySchema,
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
