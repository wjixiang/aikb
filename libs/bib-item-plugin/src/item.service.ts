import type {
  IItemRepository,
  IStorageService,
  ItemRecord,
  FormattedItem,
  PaginatedItems,
  ItemQuery,
  CreateItemInput,
  UpdateItemInput,
  BatchResult,
} from './types.js';

// ============ Helpers ============

function formatItem(item: ItemRecord): FormattedItem {
  return {
    ...item,
    type: item.type as 'article' | 'book',
    pmid: item.pmid?.toString() ?? null,
    tags: item.tags?.map((it) => it.tag) ?? [],
  };
}

// ============ Service ============

export class ItemService {
  constructor(
    private readonly repository: IItemRepository,
    private readonly storage: IStorageService,
    private readonly notFoundError: (entity: string, id: string) => Error,
  ) {}

  async listItems(query: ItemQuery): Promise<PaginatedItems> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { items, total } = await this.repository.findMany(query);

    return {
      data: items.map(formatItem),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getItemById(id: string): Promise<FormattedItem> {
    const item = await this.repository.findById(id);
    if (!item) {
      throw this.notFoundError('Item', id);
    }
    return formatItem(item);
  }

  async createItem(input: CreateItemInput): Promise<FormattedItem> {
    const item = await this.repository.create(input);
    return formatItem(item);
  }

  async updateItem(id: string, input: UpdateItemInput): Promise<FormattedItem> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw this.notFoundError('Item', id);
    }
    const item = await this.repository.update(id, input);
    return formatItem(item);
  }

  async removeItem(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw this.notFoundError('Item', id);
    }

    // Delete S3 objects for all attachments
    const { s3Keys } = await this.repository.delete(id);
    await Promise.allSettled(s3Keys.map((key) => this.storage.delete(key)));
  }

  async setItemTags(id: string, tagIds: string[]): Promise<FormattedItem> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw this.notFoundError('Item', id);
    }
    const item = await this.repository.setItemTags(id, tagIds);
    return formatItem(item);
  }

  async batchOperation(
    itemIds: string[],
    operation: string,
    tagIds?: string[],
  ): Promise<BatchResult> {
    switch (operation) {
      case 'delete': {
        const deleted = await this.repository.batchDelete(itemIds);
        return { success: true, updated: 0, deleted };
      }
      case 'setTags': {
        await this.repository.batchSetTags(itemIds, tagIds!);
        return { success: true, updated: itemIds.length };
      }
      case 'addTags': {
        await this.repository.batchAddTags(itemIds, tagIds!);
        return { success: true, updated: itemIds.length };
      }
      case 'removeTags': {
        await this.repository.batchRemoveTags(itemIds, tagIds!);
        return { success: true, updated: itemIds.length };
      }
      case 'toggleFavorite': {
        const items = await this.repository.batchToggleFavorite(itemIds);
        return { success: true, updated: items.length };
      }
      default:
        throw new Error(`Unknown batch operation: ${operation}`);
    }
  }
}
