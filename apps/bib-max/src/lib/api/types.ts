// ============ Enums ============

export type ItemType = "article" | "book";

export type SortField = "createdAt" | "updatedAt" | "year" | "title";
export type SortOrder = "asc" | "desc";
export type BatchOperationType =
  | "addTags"
  | "removeTags"
  | "setTags"
  | "delete"
  | "markAsRead"
  | "markAsUnread"
  | "toggleFavorite";

// ============ Tag ============

export interface TagRef {
  id: string;
  name: string;
  color?: string | null;
  description?: string | null;
}

export interface Tag {
  id: string;
  name: string;
  color?: string | null;
  description?: string | null;
  createdAt: string;
  itemCount?: number;
}

export interface CreateTagInput {
  name: string;
  color?: string;
  description?: string;
}

export interface UpdateTagInput {
  name?: string;
  color?: string;
  description?: string;
}

export interface TagQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  withCount?: boolean;
}

// ============ Item ============

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  subtitle?: string | null;
  authors: string[];
  abstract?: string | null;
  year?: number | null;
  source?: string | null;
  doi?: string | null;
  isbn?: string | null;
  pmid?: string | null;
  url?: string | null;
  coverUrl?: string | null;
  notes?: string | null;
  isFavorite: boolean;
  rating?: number | null;
  customMeta?: unknown;
  createdAt: string;
  updatedAt: string;
  tags: TagRef[];
}

export interface CreateItemInput {
  type?: ItemType;
  title: string;
  subtitle?: string;
  authors?: string[];
  abstract?: string;
  year?: number;
  source?: string;
  doi?: string;
  isbn?: string;
  pmid?: string;
  url?: string;
  coverUrl?: string;
  notes?: string;
  isFavorite?: boolean;
  rating?: number;
  customMeta?: unknown;
  tagIds?: string[];
}

export interface UpdateItemInput {
  type?: ItemType;
  title?: string;
  subtitle?: string;
  authors?: string[];
  abstract?: string;
  year?: number;
  source?: string;
  doi?: string;
  isbn?: string;
  pmid?: string;
  url?: string;
  coverUrl?: string;
  notes?: string;
  isFavorite?: boolean;
  rating?: number;
  customMeta?: unknown;
  tagIds?: string[];
}

export interface ItemQuery {
  page?: number;
  pageSize?: number;
  type?: ItemType;
  search?: string;
  tagIds?: string[];
  isFavorite?: boolean;
  sortBy?: SortField;
  sortOrder?: SortOrder;
}

// ============ Attachment ============

export type AttachmentCategory =
  | "pdf"
  | "image"
  | "video"
  | "audio"
  | "markdown"
  | "document"
  | "code"
  | "text"
  | "archive"
  | "unknown";

export interface Attachment {
  id: string;
  itemId: string;
  fileName: string;
  fileType: string;
  fileSize?: number | null;
  category: AttachmentCategory;
  createdAt: string;
}

export interface PresignedUploadResult {
  attachmentId: string;
  url: string;
  expiresAt: string;
}

export interface PresignedUrlResult {
  url: string;
  expiresAt: string;
}

export interface ConfirmUploadInput {
  attachmentId: string;
  fileName: string;
  contentType: string;
  fileSize?: number;
}

// ============ Extracted Metadata ============

export interface ExtractedMetadata {
  title: string;
  authors?: string[];
  abstract?: string;
  year?: number;
  source?: string;
  doi?: string;
  isbn?: string;
  pmid?: string;
  type?: ItemType;
}

// ============ Common ============

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedItems {
  data: Item[];
  pagination: Pagination;
}

export interface PaginatedTags {
  data: Tag[];
  pagination: Pagination;
}

export interface BatchOperationInput {
  itemIds: string[];
  operation: BatchOperationType;
  tagIds?: string[];
}

export interface BatchResult {
  success: boolean;
  updated: number;
  deleted?: number;
}

export interface DeletedResult {
  success: boolean;
  id: string;
}
