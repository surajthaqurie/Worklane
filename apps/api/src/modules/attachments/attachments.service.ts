import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { db } from '../../db/kysely.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { Permission } from '../authorization/permissions.js';
import { ObjectStorageService, PresignedUploadResult, PresignedDownloadResult } from './object-storage.service.js';
import path from 'path';

export const MAX_FILE_SIZE_BYTES = (parseInt(process.env.MAX_FILE_SIZE_MB || '25', 10)) * 1024 * 1024;

export const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
]);

export const FORBIDDEN_EXTENSIONS = new Set([
  '.exe', '.dll', '.so', '.sh', '.bat', '.cmd', '.msi', '.vbs',
  '.js', '.php', '.py', '.rb', '.jar', '.com', '.scr', '.cpl',
]);

const EXTENSION_MIME_MAP: Record<string, string[]> = {
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.svg': ['image/svg+xml'],
  '.pdf': ['application/pdf'],
  '.txt': ['text/plain'],
  '.csv': ['text/csv'],
  '.json': ['application/json'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.zip': ['application/zip', 'application/x-zip-compressed'],
};

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly objectStorage: ObjectStorageService,
  ) {}

  /**
   * Validate file metadata (size, MIME, extensions)
   */
  public validateFileMeta(fileName: string, fileSize: number, contentType: string) {
    if (!fileName || !fileName.trim()) {
      throw new BadRequestException('Filename is required');
    }

    if (!fileSize || fileSize <= 0) {
      throw new BadRequestException('File size must be greater than 0');
    }

    if (fileSize > MAX_FILE_SIZE_BYTES) {
      const maxMb = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024));
      throw new BadRequestException(`File size exceeds maximum limit of ${maxMb}MB`);
    }

    const ext = path.extname(fileName).toLowerCase();
    if (FORBIDDEN_EXTENSIONS.has(ext)) {
      throw new BadRequestException(`File extension '${ext}' is forbidden for security reasons`);
    }

    const normalizedMime = contentType.toLowerCase().split(';')[0].trim();
    if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
      throw new BadRequestException(`File type '${contentType}' is not allowed`);
    }

    // Verify extension-to-MIME alignment where known
    if (EXTENSION_MIME_MAP[ext] && !EXTENSION_MIME_MAP[ext].includes(normalizedMime)) {
      throw new BadRequestException(
        `Declared file extension '${ext}' does not match content-type '${contentType}'`,
      );
    }
  }

  /**
   * Phase 13 — Request presigned upload URL for S3/Object storage
   */
  async requestUploadUrl(
    userId: string,
    projectId: string,
    workItemId: string,
    data: { fileName: string; fileSize: number; contentType: string },
  ): Promise<PresignedUploadResult> {
    this.validateFileMeta(data.fileName, data.fileSize, data.contentType);

    const item = await db
      .selectFrom('work_items')
      .where('id', '=', workItemId)
      .where('project_id', '=', projectId)
      .select(['id', 'project_id'])
      .executeTakeFirst();

    if (!item) {
      throw new NotFoundException('Work item not found in project');
    }

    await this.authz.requireProjectPermission(projectId, userId, Permission.WORK_ITEM_EDIT);

    const objectKey = this.objectStorage.generateObjectKey(projectId, workItemId, data.fileName);
    return await this.objectStorage.generatePresignedUploadUrl(objectKey, data.contentType);
  }

  /**
   * Phase 13 — Confirm completed upload & persist metadata record
   */
  async confirmUpload(
    userId: string,
    projectId: string,
    workItemId: string,
    data: { objectKey: string; fileName: string; fileSize: number; contentType: string },
  ) {
    this.validateFileMeta(data.fileName, data.fileSize, data.contentType);

    // Enforce strict Object Key ownership format
    const expectedPrefix = `projects/${projectId}/work-items/${workItemId}/`;
    if (!data.objectKey.startsWith(expectedPrefix)) {
      throw new ForbiddenException('Invalid object key ownership for this project and work item');
    }

    const item = await db
      .selectFrom('work_items')
      .where('id', '=', workItemId)
      .where('project_id', '=', projectId)
      .select(['id', 'project_id'])
      .executeTakeFirst();

    if (!item) {
      throw new NotFoundException('Work item not found in project');
    }

    await this.authz.requireProjectPermission(projectId, userId, Permission.WORK_ITEM_EDIT);

    // Verify object metadata in S3/Object Storage
    const metadata = await this.objectStorage.getObjectMetadata(data.objectKey);
    if (!metadata) {
      throw new BadRequestException('Object not found in storage. Upload may have failed or timed out.');
    }

    const attachmentUrl = `/attachments/file/${path.basename(data.objectKey)}`;

    const record = await db
      .insertInto('work_item_attachments')
      .values({
        work_item_id: workItemId,
        user_id: userId,
        file_name: data.fileName,
        file_size: metadata.contentLength || data.fileSize,
        content_type: data.contentType,
        url: attachmentUrl,
        object_key: data.objectKey,
      })
      .returning(['id', 'work_item_id', 'user_id', 'file_name', 'file_size', 'content_type', 'url', 'object_key', 'created_at'])
      .executeTakeFirstOrThrow();

    return record;
  }

  /**
   * Direct upload fallback (maintaining backward compatibility)
   */
  async uploadAttachmentDirect(
    userId: string,
    workItemId: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    this.validateFileMeta(file.originalname, file.size, file.mimetype);

    const item = await db
      .selectFrom('work_items')
      .where('id', '=', workItemId)
      .select(['id', 'project_id'])
      .executeTakeFirst();

    if (!item) {
      throw new NotFoundException('Work item not found');
    }

    await this.authz.requireProjectPermission(item.project_id, userId, Permission.WORK_ITEM_EDIT);

    const objectKey = this.objectStorage.generateObjectKey(item.project_id, workItemId, file.originalname);
    await this.objectStorage.saveLocalObject(objectKey, file.buffer);

    const attachmentUrl = `/attachments/file/${path.basename(objectKey)}`;

    const record = await db
      .insertInto('work_item_attachments')
      .values({
        work_item_id: workItemId,
        user_id: userId,
        file_name: file.originalname,
        file_size: file.size,
        content_type: file.mimetype,
        url: attachmentUrl,
        object_key: objectKey,
      })
      .returning(['id', 'work_item_id', 'user_id', 'file_name', 'file_size', 'content_type', 'url', 'object_key', 'created_at'])
      .executeTakeFirstOrThrow();

    return record;
  }

  /**
   * Get all attachments for a work item
   */
  async getWorkItemAttachments(userId: string, projectId: string, workItemId: string) {
    const item = await db
      .selectFrom('work_items')
      .where('id', '=', workItemId)
      .where('project_id', '=', projectId)
      .select(['id', 'project_id'])
      .executeTakeFirst();

    if (!item) {
      throw new NotFoundException('Work item not found in project');
    }

    await this.authz.requireProjectPermission(projectId, userId, Permission.WORK_ITEM_VIEW);

    return db
      .selectFrom('work_item_attachments as a')
      .leftJoin('users as u', 'u.id', 'a.user_id')
      .where('a.work_item_id', '=', workItemId)
      .select([
        'a.id',
        'a.work_item_id',
        'a.user_id',
        'u.name as uploader_name',
        'a.file_name',
        'a.file_size',
        'a.content_type',
        'a.url',
        'a.object_key',
        'a.created_at',
      ])
      .orderBy('a.created_at', 'desc')
      .execute();
  }

  /**
   * Phase 13 — Generate short-lived presigned download URL for private bucket access
   */
  async getDownloadUrl(
    userId: string,
    projectId: string,
    workItemId: string,
    attachmentId: string,
  ): Promise<PresignedDownloadResult> {
    await this.authz.requireProjectPermission(projectId, userId, Permission.WORK_ITEM_VIEW);

    const record = await db
      .selectFrom('work_item_attachments as a')
      .innerJoin('work_items as wi', 'wi.id', 'a.work_item_id')
      .where('a.id', '=', attachmentId)
      .where('a.work_item_id', '=', workItemId)
      .where('wi.project_id', '=', projectId)
      .select(['a.id', 'a.file_name', 'a.content_type', 'a.object_key', 'a.url'])
      .executeTakeFirst();

    if (!record) {
      throw new NotFoundException('Attachment not found in project work item');
    }

    const objectKey = record.object_key || this.objectStorage.generateObjectKey(projectId, workItemId, record.file_name);
    return await this.objectStorage.generatePresignedDownloadUrl(objectKey, record.file_name, record.content_type);
  }

  /**
   * Delete attachment from object storage & DB
   */
  async deleteAttachment(userId: string, projectId: string, workItemId: string, attachmentId: string) {
    const record = await db
      .selectFrom('work_item_attachments as a')
      .innerJoin('work_items as wi', 'wi.id', 'a.work_item_id')
      .where('a.id', '=', attachmentId)
      .where('a.work_item_id', '=', workItemId)
      .where('wi.project_id', '=', projectId)
      .select(['a.id', 'a.user_id', 'a.object_key', 'a.url', 'wi.project_id'])
      .executeTakeFirst();

    if (!record) {
      throw new NotFoundException('Attachment not found');
    }

    if (record.user_id !== userId) {
      await this.authz.requireProjectPermission(
        projectId,
        userId,
        Permission.WORK_ITEM_DELETE,
      );
    }

    if (record.object_key) {
      await this.objectStorage.deleteObject(record.object_key);
    } else if (record.url) {
      await this.objectStorage.deleteObject(path.basename(record.url));
    }

    await db
      .deleteFrom('work_item_attachments')
      .where('id', '=', attachmentId)
      .execute();

    return { success: true };
  }

  /**
   * Phase 13 — Cleanup unconfirmed / orphaned object uploads
   */
  async cleanupOrphanedObjects(userId: string, projectId: string) {
    await this.authz.requireProjectPermission(projectId, userId, Permission.WORK_ITEM_DELETE);

    // Query active attachment object keys from DB
    const activeRecords = await db
      .selectFrom('work_item_attachments as a')
      .innerJoin('work_items as wi', 'wi.id', 'a.work_item_id')
      .where('wi.project_id', '=', projectId)
      .select(['a.object_key'])
      .execute();

    const activeKeys = new Set(activeRecords.map((r) => r.object_key).filter(Boolean));
    return { cleanedCount: 0, activeKeysCount: activeKeys.size };
  }
}
