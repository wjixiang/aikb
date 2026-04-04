import { z } from 'zod';

export const ItemTypeSchema = z.union([
  z.literal('article'),
  z.literal('book'),
]).describe('文献类型：article(论文) 或 book(书籍)');

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
  isRead: z.boolean(),
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
  isRead: z.boolean().optional(),
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
  isRead: z.boolean().optional(),
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
  isRead: z.coerce.boolean().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'year', 'title']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const SetItemTagsSchema = z.object({
  tagIds: z.array(z.string().uuid()),
});

export const BatchOperationSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1),
  operation: z.enum(['addTags', 'removeTags', 'setTags', 'delete', 'markAsRead', 'markAsUnread', 'toggleFavorite']),
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
