import { apiClient } from "../apiClient";
import type {
  Tag,
  CreateTagInput,
  UpdateTagInput,
  TagQuery,
  PaginatedTags,
} from "./types";

const BASE = "/api/tags";

export const tagsApi = {
  list(query?: TagQuery): Promise<PaginatedTags> {
    return apiClient.get<PaginatedTags>(BASE, query as Record<string, string | number | boolean | undefined>);
  },

  getById(id: string): Promise<Tag> {
    return apiClient.get<Tag>(`${BASE}/${id}`);
  },

  create(data: CreateTagInput): Promise<Tag> {
    return apiClient.post<Tag>(BASE, data);
  },

  update(id: string, data: UpdateTagInput): Promise<Tag> {
    return apiClient.put<Tag>(`${BASE}/${id}`, data);
  },

  remove(id: string): Promise<{ success: boolean; id: string }> {
    return apiClient.del<{ success: boolean; id: string }>(`${BASE}/${id}`);
  },
};
