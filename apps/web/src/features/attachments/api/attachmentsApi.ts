import { apiClient } from '@/shared/utils/apiClient';
import {
  WorkItemAttachment,
  PresignedUploadResponse,
  PresignedDownloadResponse,
} from '@/shared/types/work-items';

export const attachmentsApi = {
  requestUploadUrl: (
    projectId: string,
    workItemId: string,
    data: { fileName: string; fileSize: number; contentType: string },
  ) =>
    apiClient.post<PresignedUploadResponse>(
      `/projects/${projectId}/work-items/${workItemId}/attachments/upload-url`,
      data,
    ),

  confirmUpload: (
    projectId: string,
    workItemId: string,
    data: { objectKey: string; fileName: string; fileSize: number; contentType: string },
  ) =>
    apiClient.post<WorkItemAttachment>(
      `/projects/${projectId}/work-items/${workItemId}/attachments/confirm`,
      data,
    ),

  getAttachments: (projectId: string, workItemId: string) =>
    apiClient.get<WorkItemAttachment[]>(
      `/projects/${projectId}/work-items/${workItemId}/attachments`,
    ),

  getDownloadUrl: (projectId: string, workItemId: string, attachmentId: string) =>
    apiClient.get<PresignedDownloadResponse>(
      `/projects/${projectId}/work-items/${workItemId}/attachments/${attachmentId}/download-url`,
    ),

  deleteAttachment: (projectId: string, workItemId: string, attachmentId: string) =>
    apiClient.delete<{ success: boolean }>(
      `/projects/${projectId}/work-items/${workItemId}/attachments/${attachmentId}`,
    ),
};
