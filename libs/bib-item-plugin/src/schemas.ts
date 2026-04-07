import { z } from 'zod';
import {
  ATTACHMENT_CATEGORIES,
  type AttachmentCategory,
} from './types.js';

// ============ Common Schemas ============

export const IdParamSchema = z.object({
  id: z.string().uuid().describe('记录 ID'),
});

export const DeletedResponseSchema = z.object({
  success: z.boolean().describe('操作是否成功'),
  id: z.string().uuid().describe('被删除的记录 ID'),
});

// ============ Attachment Category ============

export const AttachmentCategorySchema = z.enum(ATTACHMENT_CATEGORIES);

export function categorizeByMimeType(mimeType: string): AttachmentCategory {
  const t = mimeType.toLowerCase();

  if (t === 'application/pdf') return 'pdf';
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  if (t === 'text/markdown' || t === 'text/x-markdown') return 'markdown';

  if (
    t.includes('officedocument.wordprocessingml') ||
    t === 'application/msword'
  )
    return 'document';
  if (
    t.includes('officedocument.spreadsheetml') ||
    t === 'application/vnd.ms-excel'
  )
    return 'document';
  if (
    t.includes('officedocument.presentationml') ||
    t === 'application/vnd.ms-powerpoint'
  )
    return 'document';

  if (
    [
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      'application/gzip',
      'application/x-tar',
      'application/x-bzip2',
      'application/x-zstd',
    ].includes(t)
  )
    return 'archive';

  if (
    [
      'application/json',
      'application/xml',
      'application/x-yaml',
      'application/yaml',
      'application/x-toml',
      'application/javascript',
      'application/typescript',
      'application/x-javascript',
      'application/x-python',
      'application/x-sh',
      'application/sql',
    ].includes(t)
  )
    return 'code';
  if (t.startsWith('text/') && t !== 'text/plain') return 'code';

  if (t === 'text/plain') return 'text';

  return 'unknown';
}

// ============ Attachment Schemas ============

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

// ============ Item Schemas ============

export const ItemTypeSchema = z
  .union([z.literal('article'), z.literal('book')])
  .describe('文献类型：article(论文) 或 book(书籍)');

export const TagRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export const ItemSchema = z.object({
  id: z.string().uuid(),
  type: ItemTypeSchema,
  title: z.string(),
  subtitle: z.string().nullable().optional(),
  authors: z.array(z.string()),
  abstract: z.string().nullable().optional(),
  year: z.number().int().nullable().optional(),
  source: z.string().nullable().optional(),
  doi: z.string().nullable().optional(),
  isbn: z.string().nullable().optional(),
  pmid: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isFavorite: z.boolean(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  customMeta: z.unknown().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  tags: z.array(TagRefSchema),
});

export const CreateItemSchema = z.object({
  type: ItemTypeSchema.optional(),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  authors: z.array(z.string()).optional(),
  abstract: z.string().optional(),
  year: z.number().int().min(1000).max(9999).optional(),
  source: z.string().optional(),
  doi: z.string().optional(),
  isbn: z.string().optional(),
  pmid: z.string().optional(),
  url: z.string().optional(),
  coverUrl: z.string().optional(),
  notes: z.string().optional(),
  isFavorite: z.boolean().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  customMeta: z.unknown().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

export const UpdateItemSchema = z.object({
  type: ItemTypeSchema.optional(),
  title: z.string().min(1).optional(),
  subtitle: z.string().optional(),
  authors: z.array(z.string()).optional(),
  abstract: z.string().optional(),
  year: z.number().int().min(1000).max(9999).optional(),
  source: z.string().optional(),
  doi: z.string().optional(),
  isbn: z.string().optional(),
  pmid: z.string().optional(),
  url: z.string().optional(),
  coverUrl: z.string().optional(),
  notes: z.string().optional(),
  isFavorite: z.boolean().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  customMeta: z.unknown().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

export const ItemQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  type: ItemTypeSchema.optional(),
  search: z.string().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  isFavorite: z.coerce.boolean().optional(),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'year', 'title'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const SetItemTagsSchema = z.object({
  tagIds: z.array(z.string().uuid()),
});

export const BatchOperationSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1),
  operation: z.enum([
    'addTags',
    'removeTags',
    'setTags',
    'delete',
    'toggleFavorite',
  ]),
  tagIds: z.array(z.string().uuid()).optional(),
});

export const BatchResponseSchema = z.object({
  success: z.boolean(),
  updated: z.number().int(),
  deleted: z.number().int().optional(),
});

export const PaginationSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

export const PaginatedItemsSchema = z.object({
  data: z.array(ItemSchema),
  pagination: PaginationSchema,
});
