'use client';

import React, { useRef, useState } from 'react';
import {
  useWorkItemAttachments,
  useUploadAttachments,
  useDeleteAttachment,
} from '../hooks/useAttachments';
import { attachmentsApi } from '../api/attachmentsApi';
import { WorkItemAttachment } from '@/shared/types/work-items';
import { Spinner } from '@/shared/components/ui/Spinner';
import { useToast } from '@/shared/hooks/useToast';
import {
  Paperclip,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  FileCode,
  Download,
  Trash2,
  XCircle,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';

interface AttachmentManagerProps {
  projectId: string;
  workItemId: string;
  canEdit?: boolean;
}

export function AttachmentManager({ projectId, workItemId, canEdit = true }: AttachmentManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: attachments = [], isLoading, error } = useWorkItemAttachments(projectId, workItemId);
  const deleteMutation = useDeleteAttachment(projectId, workItemId);
  const { tasks, startUpload, cancelUpload, retryUpload, clearCompleted } = useUploadAttachments(
    projectId,
    workItemId,
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      startUpload(selected);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!canEdit) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dropped = Array.from(e.dataTransfer.files);
      startUpload(dropped);
    }
  };

  const handleDownload = async (att: WorkItemAttachment) => {
    try {
      setDownloadingId(att.id);
      const res = await attachmentsApi.getDownloadUrl(projectId, workItemId, att.id);
      window.open(res.downloadUrl, '_blank');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not generate download URL';
      toast.showError('Download failed', message);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = (att: WorkItemAttachment) => {
    if (confirm(`Are you sure you want to delete attachment "${att.fileName}"?`)) {
      deleteMutation.mutate(att.id);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImage = (mime: string) => mime.startsWith('image/');

  return (
    <div className="space-y-4">
      {/* Upload Dropzone */}
      {canEdit && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-900/30 group"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="flex flex-col items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <UploadCloud className="w-6 h-6 text-indigo-500 group-hover:scale-110 transition-transform" />
            <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Click or drag files here to upload attachments
            </div>
            <div className="text-[10px] text-slate-400">
              Supports PNG, JPG, PDF, DOCX, ZIP (Max 25MB per file)
            </div>
          </div>
        </div>
      )}

      {/* Active Upload Tasks with Progress */}
      {tasks.length > 0 && (
        <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-lg p-3 bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
            <span>Uploading Files ({tasks.filter((t) => t.status === 'uploading').length} in progress)</span>
            <button
              onClick={clearCompleted}
              className="text-[10px] text-indigo-600 hover:underline"
            >
              Clear completed
            </button>
          </div>

          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-3 text-xs p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Paperclip className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate">
                      <span className="truncate">{task.file.name}</span>
                      <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                        {formatSize(task.file.size)}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          task.status === 'error'
                            ? 'bg-rose-500'
                            : task.status === 'cancelled'
                            ? 'bg-amber-500'
                            : task.status === 'completed'
                            ? 'bg-emerald-500'
                            : 'bg-indigo-600'
                        }`}
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                    {task.error && (
                      <div className="text-[10px] text-rose-500 mt-0.5 truncate">{task.error}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {task.status === 'uploading' && (
                    <button
                      onClick={() => cancelUpload(task.id)}
                      title="Cancel Upload"
                      className="p-1 text-slate-400 hover:text-amber-500 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}

                  {task.status === 'error' && (
                    <button
                      onClick={() => retryUpload(task.id)}
                      title="Retry Upload"
                      className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}

                  {task.status === 'completed' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attachments List */}
      <div>
        <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
          Attachments ({attachments.length})
        </h4>

        {isLoading ? (
          <div className="p-4 flex items-center justify-center text-xs text-slate-400">
            <Spinner className="w-4 h-4 mr-2" /> Loading attachments...
          </div>
        ) : error ? (
          <div className="p-3 text-xs text-rose-500 flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/20 rounded-lg">
            <AlertCircle className="w-4 h-4" /> Failed to load attachments
          </div>
        ) : attachments.length === 0 ? (
          <div className="text-xs text-slate-400 italic p-3 text-center bg-slate-50 dark:bg-slate-900 rounded-lg">
            No files attached to this work item yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {/* File Icon / Preview Badge */}
                  <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-300">
                    {isImage(att.contentType) ? (
                      <ImageIcon className="w-4 h-4 text-indigo-500" />
                    ) : att.contentType.includes('pdf') ? (
                      <FileText className="w-4 h-4 text-rose-500" />
                    ) : (
                      <FileCode className="w-4 h-4 text-slate-400" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-xs text-slate-800 dark:text-slate-200 truncate">
                      {att.fileName}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-2">
                      <span>{formatSize(att.fileSize)}</span>
                      <span>•</span>
                      <span>{format(new Date(att.createdAt), 'MMM d')}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button
                    onClick={() => handleDownload(att)}
                    disabled={downloadingId === att.id}
                    title="Secure Download"
                    className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50"
                  >
                    {downloadingId === att.id ? (
                      <Spinner className="w-3.5 h-3.5" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {canEdit && (
                    <button
                      onClick={() => handleDelete(att)}
                      title="Delete Attachment"
                      className="p-1 text-slate-400 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
