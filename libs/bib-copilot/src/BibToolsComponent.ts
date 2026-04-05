import 'reflect-metadata';
import { injectable } from 'inversify';
import { z } from 'zod';
import { ToolComponent, type ToolCallResult } from 'agent-lib/components';
import { tdiv } from 'agent-lib/components/ui';
import {
  SearchItemsParamsSchema,
  GetItemParamsSchema,
  CreateItemParamsSchema,
  UpdateItemParamsSchema,
  DeleteItemParamsSchema,
  ListTagsParamsSchema,
  CreateTagParamsSchema,
  GetItemAttachmentsParamsSchema,
} from './schemas.js';

// ============ Dependency Injection Types ============

export interface BibToolsDeps {
  listItems: (query: Record<string, unknown>) => Promise<unknown>;
  getItemById: (id: string) => Promise<unknown>;
  createItem: (data: Record<string, unknown>) => Promise<unknown>;
  updateItem: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  removeItem: (id: string) => Promise<void>;
  listTags: (query: Record<string, unknown>) => Promise<unknown>;
  createTag: (data: Record<string, unknown>) => Promise<unknown>;
  listAttachments: (itemId: string) => Promise<unknown>;
}

// ============ Component ============

@injectable()
export class BibToolsComponent extends ToolComponent {
  componentId = 'bib-tools';
  displayName = 'Bibliography Tools';
  description = 'Knowledge base operations for searching and managing bibliography items, tags, and attachments';

  componentPrompt = `# Bibliography Tools

You have access to tools for managing a bibliography knowledge base.

## Available Tools

- **search_items**: Search and list items by keyword, type, tags, favorites. Use reasonable page sizes (5-10).
- **get_item**: Get full details of a single item by UUID.
- **create_item**: Create a new item (article or book).
- **update_item**: Update an existing item. Only provided fields are changed.
- **delete_item**: Delete an item permanently (with all attachments).
- **list_tags**: List all tags. Search by name if needed.
- **create_tag**: Create a new tag.
- **get_item_attachments**: Get all attachments for an item.

## Best Practices

- When searching, use pageSize 5-10 to avoid overwhelming responses
- Always confirm with the user before deleting items
- When creating items, gather required info (at minimum: title)
- If you need tag IDs, first list_tags to find the right ones
- Present search results in a clear, concise format`;

  private readonly deps: BibToolsDeps;

  constructor(deps: BibToolsDeps) {
    super();
    this.deps = deps;
  }

  protected toolDefs() {
    return {
      search_items: {
        desc: 'Search and list items in the knowledge base. Supports keyword search, type filtering, tag filtering, and pagination.',
        paramsSchema: SearchItemsParamsSchema,
      },
      get_item: {
        desc: 'Get full details of a single item by its UUID.',
        paramsSchema: GetItemParamsSchema,
      },
      create_item: {
        desc: 'Create a new item (article or book) in the knowledge base.',
        paramsSchema: CreateItemParamsSchema,
      },
      update_item: {
        desc: 'Update an existing item. Only provided fields will be changed.',
        paramsSchema: UpdateItemParamsSchema,
      },
      delete_item: {
        desc: 'Delete an item and all its attachments permanently. Confirm with user before calling.',
        paramsSchema: DeleteItemParamsSchema,
      },
      list_tags: {
        desc: 'List tags in the knowledge base. Optionally search by name.',
        paramsSchema: ListTagsParamsSchema,
      },
      create_tag: {
        desc: 'Create a new tag.',
        paramsSchema: CreateTagParamsSchema,
      },
      get_item_attachments: {
        desc: 'Get all attachments for a specific item.',
        paramsSchema: GetItemAttachmentsParamsSchema,
      },
    };
  }

  // ============ Tool Handlers ============

  async onSearch_items(params: z.infer<typeof SearchItemsParamsSchema>): Promise<ToolCallResult> {
    try {
      const { page, pageSize, ...query } = params;
      const result = await this.deps.listItems(query);
      const data = result as { pagination: { total: number; totalPages: number }; data: unknown[] };
      return {
        success: true,
        data: { total: data.pagination.total, items: data.data },
        summary: `[BibTools] Found ${data.pagination.total} items`,
      };
    } catch (error) {
      return { success: false, data: { error: String(error) }, summary: `[BibTools] Search failed` };
    }
  }

  async onGet_item(params: z.infer<typeof GetItemParamsSchema>): Promise<ToolCallResult> {
    try {
      const item = await this.deps.getItemById(params.id);
      return { success: true, data: item, summary: `[BibTools] Retrieved item` };
    } catch (error) {
      return { success: false, data: { error: String(error) }, summary: `[BibTools] Get item failed` };
    }
  }

  async onCreate_item(params: z.infer<typeof CreateItemParamsSchema>): Promise<ToolCallResult> {
    try {
      const item = await this.deps.createItem(params);
      return { success: true, data: item, summary: `[BibTools] Created item: ${params.title}` };
    } catch (error) {
      return { success: false, data: { error: String(error) }, summary: `[BibTools] Create failed` };
    }
  }

  async onUpdate_item(params: z.infer<typeof UpdateItemParamsSchema>): Promise<ToolCallResult> {
    try {
      const { id, ...data } = params;
      const item = await this.deps.updateItem(id, data);
      return { success: true, data: item, summary: `[BibTools] Updated item ${id}` };
    } catch (error) {
      return { success: false, data: { error: String(error) }, summary: `[BibTools] Update failed` };
    }
  }

  async onDelete_item(params: z.infer<typeof DeleteItemParamsSchema>): Promise<ToolCallResult> {
    try {
      await this.deps.removeItem(params.id);
      return { success: true, data: { deleted: params.id }, summary: `[BibTools] Deleted item ${params.id}` };
    } catch (error) {
      return { success: false, data: { error: String(error) }, summary: `[BibTools] Delete failed` };
    }
  }

  async onList_tags(params: z.infer<typeof ListTagsParamsSchema>): Promise<ToolCallResult> {
    try {
      const result = await this.deps.listTags(params);
      const data = result as { data: unknown[]; pagination: { total: number } };
      return {
        success: true,
        data: { total: data.pagination.total, tags: data.data },
        summary: `[BibTools] Found ${data.pagination.total} tags`,
      };
    } catch (error) {
      return { success: false, data: { error: String(error) }, summary: `[BibTools] List tags failed` };
    }
  }

  async onCreate_tag(params: z.infer<typeof CreateTagParamsSchema>): Promise<ToolCallResult> {
    try {
      const tag = await this.deps.createTag(params);
      return { success: true, data: tag, summary: `[BibTools] Created tag: ${params.name}` };
    } catch (error) {
      return { success: false, data: { error: String(error) }, summary: `[BibTools] Create tag failed` };
    }
  }

  async onGet_item_attachments(params: z.infer<typeof GetItemAttachmentsParamsSchema>): Promise<ToolCallResult> {
    try {
      const attachments = await this.deps.listAttachments(params.itemId);
      return { success: true, data: attachments, summary: `[BibTools] Retrieved attachments` };
    } catch (error) {
      return { success: false, data: { error: String(error) }, summary: `[BibTools] Get attachments failed` };
    }
  }

  // ============ Rendering ============

  renderImply = async () => {
    return [
      new tdiv({
        content: '## Bibliography Tools\n\nKnowledge base operations for items, tags, and attachments.',
        styles: { width: 80 },
      }),
    ];
  };
}
