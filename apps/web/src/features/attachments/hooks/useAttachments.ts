import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attachmentsApi } from '../api/attachmentsApi';
import { WorkItemAttachment } from '@/shared/types/work-items';
import { useToast } from '@/shared/hooks/useToast';
import { formatApiError } from '@/shared/utils/error';

export interface FileUploadTask {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error' | 'cancelled';
  error?: string;
  abortController?: AbortController;
}

export function useWorkItemAttachments(projectId: string | undefined, workItemId: string | undefined) {
  return useQuery({
    queryKey: ['projects', projectId, 'work-items', workItemId, 'attachments'],
    queryFn: () => attachmentsApi.getAttachments(projectId!, workItemId!),
    enabled: !!projectId && !!workItemId,
  });
}

export function useDeleteAttachment(projectId: string, workItemId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (attachmentId: string) =>
      attachmentsApi.deleteAttachment(projectId, workItemId, attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'work-items', workItemId, 'attachments'],
      });
      toast.showSuccess('Attachment deleted');
    },
    onError: (err) => {
      toast.showError('Failed to delete attachment', formatApiError(err));
    },
  });
}

export function useUploadAttachments(projectId: string, workItemId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [tasks, setTasks] = useState<FileUploadTask[]>([]);

  const uploadSingleFile = useCallback(
    async (task: FileUploadTask) => {
      const abortController = new AbortController();

      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: 'uploading', progress: 5, error: undefined, abortController } : t,
        ),
      );

      try {
        // Step 1: Request presigned upload URL
        const presigned = await attachmentsApi.requestUploadUrl(projectId, workItemId, {
          fileName: task.file.name,
          fileSize: task.file.size,
          contentType: task.file.type || 'application/octet-stream',
        });

        // Step 2: Upload payload via XMLHttpRequest for real-time progress
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open(presigned.method || 'PUT', presigned.uploadUrl);

          if (presigned.headers) {
            Object.entries(presigned.headers).forEach(([k, v]) => {
              xhr.setRequestHeader(k, v);
            });
          }

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 90);
              setTasks((prev) =>
                prev.map((t) => (t.id === task.id ? { ...t, progress: Math.max(5, pct) } : t)),
              );
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Storage server returned status ${xhr.status}`));
            }
          };

          xhr.onerror = () => reject(new Error('Network error during file upload'));
          xhr.onabort = () => reject(new Error('Upload cancelled'));

          abortController.signal.addEventListener('abort', () => xhr.abort());
          xhr.send(task.file);
        });

        // Step 3: Confirm upload with backend
        await attachmentsApi.confirmUpload(projectId, workItemId, {
          objectKey: presigned.objectKey,
          fileName: task.file.name,
          fileSize: task.file.size,
          contentType: task.file.type || 'application/octet-stream',
        });

        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: 'completed', progress: 100 } : t)),
        );

        queryClient.invalidateQueries({
          queryKey: ['projects', projectId, 'work-items', workItemId, 'attachments'],
        });
      } catch (err: any) {
        if (err.message === 'Upload cancelled') {
          setTasks((prev) =>
            prev.map((t) => (t.id === task.id ? { ...t, status: 'cancelled', progress: 0 } : t)),
          );
        } else {
          const errMsg = formatApiError(err);
          setTasks((prev) =>
            prev.map((t) => (t.id === task.id ? { ...t, status: 'error', error: errMsg } : t)),
          );
          toast.showError(`Upload failed for ${task.file.name}`, errMsg);
        }
      }
    },
    [projectId, workItemId, queryClient, toast],
  );

  const startUpload = useCallback(
    (files: File[]) => {
      const newTasks: FileUploadTask[] = files.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        progress: 0,
        status: 'pending',
      }));

      setTasks((prev) => [...prev, ...newTasks]);
      newTasks.forEach((task) => uploadSingleFile(task));
    },
    [uploadSingleFile],
  );

  const cancelUpload = useCallback((taskId: string) => {
    setTasks((prev) => {
      const task = prev.find((t) => t.id === taskId);
      if (task?.abortController) {
        task.abortController.abort();
      }
      return prev.map((t) => (t.id === taskId ? { ...t, status: 'cancelled', progress: 0 } : t));
    });
  }, []);

  const retryUpload = useCallback(
    (taskId: string) => {
      setTasks((prev) => {
        const task = prev.find((t) => t.id === taskId);
        if (task) {
          uploadSingleFile(task);
        }
        return prev;
      });
    },
    [uploadSingleFile],
  );

  const clearCompleted = useCallback(() => {
    setTasks((prev) => prev.filter((t) => t.status !== 'completed'));
  }, []);

  return {
    tasks,
    startUpload,
    cancelUpload,
    retryUpload,
    clearCompleted,
  };
}
