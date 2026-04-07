import { apiClient } from "../apiClient";
import type {
  Attachment,
  PresignedUploadResult,
  PresignedUrlResult,
  ConfirmUploadInput,
} from "./types";

const BASE = "/api/items";

export const attachmentsApi = {
  getUploadUrl(itemId: string, fileName: string, contentType: string): Promise<PresignedUploadResult> {
    return apiClient.post<PresignedUploadResult>(
      `${BASE}/${itemId}/attachments/upload-url`,
      { fileName, contentType },
    );
  },

  confirmUpload(itemId: string, data: ConfirmUploadInput): Promise<Attachment> {
    return apiClient.post<Attachment>(`${BASE}/${itemId}/attachments`, data);
  },

  list(itemId: string): Promise<{ data: Attachment[] }> {
    return apiClient.get<{ data: Attachment[] }>(`${BASE}/${itemId}/attachments`);
  },

  getDownloadUrl(itemId: string, id: string): Promise<PresignedUrlResult> {
    return apiClient.get<PresignedUrlResult>(`${BASE}/${itemId}/attachments/${id}/download`);
  },

  remove(itemId: string, id: string): Promise<{ success: boolean; id: string }> {
    return apiClient.del<{ success: boolean; id: string }>(`${BASE}/${itemId}/attachments/${id}`);
  },

  convertToMd(itemId: string, attachmentId: string): Promise<Attachment> {
    return apiClient.post<Attachment>(`${BASE}/${itemId}/attachments/convert-to-md`, { attachmentId });
  },
};
