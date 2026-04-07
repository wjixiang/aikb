import { z } from 'zod';

// ============ Search Items ============

export const SearchItemsParamsSchema = z.object({
  search: z.string().optional().describe('Keyword to search in title, subtitle, authors, source, DOI'),
  type: z.enum(['article', 'book']).optional().describe('Filter by item type'),
  tagIds: z.array(z.string()).optional().describe('Filter by tag IDs'),
  isFavorite: z.boolean().optional().describe('Filter favorites only'),
  page: z.number().int().min(1).optional().describe('Page number (default 1)'),
  pageSize: z.number().int().min(1).max(20).optional().describe('Items per page (default 10)'),
});

// ============ Get Item ============

export const GetItemParamsSchema = z.object({
  id: z.string().describe('Item UUID'),
});

// ============ Create Item ============

export const CreateItemParamsSchema = z.object({
  title: z.string().describe('Item title'),
  type: z.enum(['article', 'book']).optional().describe('Item type'),
  authors: z.array(z.string()).optional().describe('Author list'),
  abstract: z.string().optional().describe('Abstract text'),
  year: z.number().int().optional().describe('Publication year'),
  source: z.string().optional().describe('Source/journal name'),
  doi: z.string().optional().describe('DOI identifier'),
  pmid: z.string().optional().describe('PubMed ID'),
  notes: z.string().optional().describe('User notes'),
  tagIds: z.array(z.string()).optional().describe('Tag IDs to associate'),
});

// ============ Update Item ============

export const UpdateItemParamsSchema = z.object({
  id: z.string().describe('Item UUID to update'),
  title: z.string().optional().describe('New title'),
  authors: z.array(z.string()).optional().describe('New author list'),
  abstract: z.string().optional().describe('New abstract'),
  notes: z.string().optional().describe('New notes'),
  isFavorite: z.boolean().optional().describe('Toggle favorite'),
  tagIds: z.array(z.string()).optional().describe('Replace tag associations'),
});

// ============ Delete Item ============

export const DeleteItemParamsSchema = z.object({
  id: z.string().describe('Item UUID to delete'),
});

// ============ List Tags ============

export const ListTagsParamsSchema = z.object({
  search: z.string().optional().describe('Search tag names'),
  withCount: z.boolean().optional().describe('Include item counts'),
});

// ============ Create Tag ============

export const CreateTagParamsSchema = z.object({
  name: z.string().describe('Tag name'),
  color: z.string().optional().describe('Hex color code'),
  description: z.string().optional().describe('Tag description'),
});

// ============ Get Item Attachments ============

export const GetItemAttachmentsParamsSchema = z.object({
  itemId: z.string().describe('Item UUID'),
});

// ============ Read Markdown ============

export const ReadMarkdownParamsSchema = z.object({
  itemId: z.string().describe('Item UUID'),
  attachmentId: z.string().describe('Attachment UUID (must be a markdown file)'),
  page: z.number().int().min(1).optional().describe('Page number (default 1, each page ~4000 chars)'),
});
