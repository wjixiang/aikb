// ============ DB Record Types ============

export interface TagRecord {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
}

export interface ItemRecord {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  abstract: string | null;
  year: number | null;
  source: string | null;
  doi: string | null;
  isbn: string | null;
  pmid: bigint | null;
  url: string | null;
  coverUrl: string | null;
  notes: string | null;
  isFavorite: boolean;
  rating: number | null;
  customMeta: unknown;
  createdAt: Date;
  updatedAt: Date;
  tags?: Array<{ tag: TagRecord }>;
}

export interface AttachmentRecord {
  id: string;
  itemId: string;
  fileName: string;
  fileType: string;
  fileSize: bigint | null;
  s3Key: string;
  createdAt: Date;
}

// ============ Query / Input Types ============

export interface ItemQuery {
  page?: number;
  pageSize?: number;
  type?: string;
  search?: string;
  tagIds?: string[];
  isFavorite?: boolean;
  sortBy?: string;
  sortOrder?: string;
}

export interface CreateItemInput {
  tagIds?: string[];
  pmid?: string;
  type?: string;
  title: string;
  subtitle?: string;
  authors?: string[];
  abstract?: string;
  year?: number;
  source?: string;
  doi?: string;
  isbn?: string;
  url?: string;
  coverUrl?: string;
  notes?: string;
  isFavorite?: boolean;
  rating?: number;
  customMeta?: unknown;
}

export interface UpdateItemInput {
  tagIds?: string[];
  pmid?: string;
  [key: string]: unknown;
}

// ============ Formatted Output Types ============

export interface FormattedItem {
  id: string;
  type: 'article' | 'book';
  title: string;
  subtitle: string | null;
  authors: string[];
  abstract: string | null;
  year: number | null;
  source: string | null;
  doi: string | null;
  isbn: string | null;
  pmid: string | null;
  url: string | null;
  coverUrl: string | null;
  notes: string | null;
  isFavorite: boolean;
  rating: number | null;
  customMeta: unknown;
  createdAt: Date;
  updatedAt: Date;
  tags: Array<{ id: string; name: string; color: string | null; description: string | null }>;
}

export interface PaginatedItems {
  data: FormattedItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface BatchResult {
  success: boolean;
  updated: number;
  deleted?: number;
}

export interface PresignedUploadResult {
  attachmentId: string;
  url: string;
  expiresAt: Date;
}

export interface FormattedAttachment {
  id: string;
  itemId: string;
  fileName: string;
  fileType: string;
  fileSize: number | null;
  category: AttachmentCategory;
  createdAt: Date;
}

export interface PresignedUrlResult {
  url: string;
  expiresAt: Date;
}

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

// ============ Repository Interfaces ============

export interface IItemRepository {
  findMany(query: ItemQuery): Promise<{ items: ItemRecord[]; total: number }>;
  findById(id: string): Promise<ItemRecord | null>;
  create(input: CreateItemInput): Promise<ItemRecord>;
  update(id: string, input: UpdateItemInput): Promise<ItemRecord>;
  /** Delete item, return s3Keys of its attachments for storage cleanup */
  delete(id: string): Promise<{ s3Keys: string[] }>;
  deleteTagsByItemId(itemId: string): Promise<void>;
  setItemTags(itemId: string, tagIds: string[]): Promise<ItemRecord>;
  batchDelete(ids: string[]): Promise<number>;
  batchSetTags(ids: string[], tagIds: string[]): Promise<void>;
  batchAddTags(ids: string[], tagIds: string[]): Promise<void>;
  batchRemoveTags(ids: string[], tagIds: string[]): Promise<void>;
  batchToggleFavorite(
    ids: string[],
  ): Promise<Array<{ id: string; isFavorite: boolean }>>;
}

export interface IAttachmentRepository {
  create(data: {
    itemId: string;
    fileName: string;
    fileType: string;
    fileSize: bigint | null;
    s3Key: string;
  }): Promise<AttachmentRecord>;
  findManyByItemId(itemId: string): Promise<AttachmentRecord[]>;
  findByIdAndItemId(
    id: string,
    itemId: string,
  ): Promise<AttachmentRecord | null>;
  deleteById(id: string): Promise<void>;
}

// ============ Storage Interface ============

export interface IStorageService {
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn?: number,
  ): Promise<PresignedUrlResult>;
  getPresignedDownloadUrl(
    key: string,
    expiresIn?: number,
  ): Promise<PresignedUrlResult>;
}

// ============ Plugin Options ============

export interface BibItemPluginOptions {
  itemRepository: IItemRepository;
  attachmentRepository: IAttachmentRepository;
  storage: IStorageService;
  /** S3 key prefix for attachments (default: 'attachments') */
  keyPrefix?: string;
  /** Presigned URL TTL in seconds (default: 3600) */
  presignTtl?: number;
  /** Factory for not-found errors. Receives (entity, id). */
  notFoundError?: (entity: string, id: string) => Error;
}
