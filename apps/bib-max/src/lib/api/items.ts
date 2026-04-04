import { apiClient } from "../apiClient";
import type {
  Item,
  CreateItemInput,
  UpdateItemInput,
  ItemQuery,
  PaginatedItems,
  BatchOperationType,
  BatchResult,
  TagRef,
} from "./types";

const BASE = "/api/items";

export const itemsApi = {
  list(query?: ItemQuery): Promise<PaginatedItems> {
    return apiClient.get<PaginatedItems>(BASE, query as Record<string, string | number | boolean | undefined>);
  },

  getById(id: string): Promise<Item> {
    return apiClient.get<Item>(`${BASE}/${id}`);
  },

  create(data: CreateItemInput): Promise<Item> {
    return apiClient.post<Item>(BASE, data);
  },

  update(id: string, data: UpdateItemInput): Promise<Item> {
    return apiClient.put<Item>(`${BASE}/${id}`, data);
  },

  remove(id: string): Promise<{ success: boolean; id: string }> {
    return apiClient.del<{ success: boolean; id: string }>(`${BASE}/${id}`);
  },

  setTags(id: string, tagIds: string[]): Promise<TagRef[]> {
    return apiClient.patch<TagRef[]>(`${BASE}/${id}/tags`, { tagIds });
  },

  batch(itemIds: string[], operation: BatchOperationType, tagIds?: string[]): Promise<BatchResult> {
    return apiClient.post<BatchResult>(`${BASE}/batch`, { itemIds, operation, tagIds });
  },
};
