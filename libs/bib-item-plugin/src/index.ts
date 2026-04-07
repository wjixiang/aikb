export { bibItemPlugin } from './plugin.js';
export { ItemService } from './item.service.js';
export { AttachmentService } from './attachment.service.js';
export {
  categorizeByMimeType,
  // Common
  IdParamSchema,
  DeletedResponseSchema,
  // Attachment
  AttachmentSchema,
  AttachmentListSchema,
  PresignedUrlSchema,
  ItemIdParamSchema,
  AttachmentIdParamSchema,
  PresignedUploadBodySchema,
  PresignedUploadResponseSchema,
  ConfirmUploadBodySchema,
  AttachmentCategorySchema,
  // Item
  ItemTypeSchema,
  TagRefSchema,
  ItemSchema,
  CreateItemSchema,
  UpdateItemSchema,
  ItemQuerySchema,
  SetItemTagsSchema,
  BatchOperationSchema,
  BatchResponseSchema,
  PaginationSchema,
  PaginatedItemsSchema,
} from './schemas.js';
export {
  ATTACHMENT_CATEGORIES,
} from './types.js';
export type {
  // Records
  TagRecord,
  ItemRecord,
  AttachmentRecord,
  // Query / Input
  ItemQuery,
  CreateItemInput,
  UpdateItemInput,
  // Output
  FormattedItem,
  PaginatedItems,
  BatchResult,
  PresignedUploadResult,
  FormattedAttachment,
  PresignedUrlResult,
  // Category
  AttachmentCategory,
  // Repository
  IItemRepository,
  IAttachmentRepository,
  // Storage
  IStorageService,
  // Plugin
  BibItemPluginOptions,
} from './types.js';
