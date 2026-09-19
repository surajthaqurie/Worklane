import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { db } from '../../db/kysely.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { Permission } from '../authorization/permissions.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
const MAX_FILE_SIZE_BYTES = (parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10)) * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

@Injectable()
export class AttachmentsService {
  constructor(private readonly authz: AuthorizationService) {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  }

  async uploadAttachment(
    userId: string,
    workItemId: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File size exceeds maximum limit of ${process.env.MAX_FILE_SIZE_MB || 10}MB`,
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      throw new BadRequestException(`File type '${file.mimetype}' is not allowed`);
    }

    // Verify work item exists and user has WORK_ITEM_EDIT permission on project
    const item = await db
      .selectFrom('work_items')
      .where('id', '=', workItemId)
      .select(['id', 'project_id'])
      .executeTakeFirst();

    if (!item) {
      throw new NotFoundException('Work item not found');
    }

    await this.authz.requireProjectPermission(
      item.project_id,
      userId,
      Permission.WORK_ITEM_EDIT,
    );

    // Generate safe unique filename
    const safeExt = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, '');
    const uniqueFilename = `${crypto.randomUUID()}${safeExt}`;
    const targetFilePath = path.join(UPLOAD_DIR, uniqueFilename);

    // Path traversal safety check
    if (!targetFilePath.startsWith(UPLOAD_DIR)) {
      throw new BadRequestException('Invalid file path');
    }

    await fs.promises.writeFile(targetFilePath, file.buffer);

    const attachmentUrl = `/attachments/file/${uniqueFilename}`;

    const record = await db
      .insertInto('work_item_attachments')
      .values({
        work_item_id: workItemId,
        user_id: userId,
        file_name: file.originalname,
        file_size: file.size,
        content_type: file.mimetype,
        url: attachmentUrl,
      })
      .returning(['id', 'work_item_id', 'user_id', 'file_name', 'file_size', 'content_type', 'url', 'created_at'])
      .executeTakeFirstOrThrow();

    return record;
  }

  async getWorkItemAttachments(userId: string, workItemId: string) {
    const item = await db
      .selectFrom('work_items')
      .where('id', '=', workItemId)
      .select(['id', 'project_id'])
      .executeTakeFirst();

    if (!item) {
      throw new NotFoundException('Work item not found');
    }

    await this.authz.requireProjectPermission(
      item.project_id,
      userId,
      Permission.WORK_ITEM_VIEW,
    );

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
        'a.created_at',
      ])
      .orderBy('a.created_at', 'desc')
      .execute();
  }

  async getAttachmentFile(userId: string, filename: string) {
    const safeFilename = path.basename(filename);
    const attachmentUrl = `/attachments/file/${safeFilename}`;

    const record = await db
      .selectFrom('work_item_attachments as a')
      .innerJoin('work_items as wi', 'wi.id', 'a.work_item_id')
      .where('a.url', '=', attachmentUrl)
      .select(['a.id', 'a.file_name', 'a.content_type', 'wi.project_id'])
      .executeTakeFirst();

    if (!record) {
      throw new NotFoundException('Attachment not found');
    }

    await this.authz.requireProjectPermission(
      record.project_id,
      userId,
      Permission.WORK_ITEM_VIEW,
    );

    const filePath = path.join(UPLOAD_DIR, safeFilename);

    if (!filePath.startsWith(UPLOAD_DIR) || !fs.existsSync(filePath)) {
      throw new NotFoundException('Attachment file not found');
    }

    return {
      filePath,
      contentType: record.content_type,
      fileName: record.file_name,
    };
  }

  async deleteAttachment(userId: string, attachmentId: string) {
    const record = await db
      .selectFrom('work_item_attachments as a')
      .innerJoin('work_items as wi', 'wi.id', 'a.work_item_id')
      .where('a.id', '=', attachmentId)
      .select(['a.id', 'a.user_id', 'a.url', 'wi.project_id'])
      .executeTakeFirst();

    if (!record) {
      throw new NotFoundException('Attachment not found');
    }

    if (record.user_id !== userId) {
      await this.authz.requireProjectPermission(
        record.project_id,
        userId,
        Permission.WORK_ITEM_DELETE,
      );
    }

    const safeFilename = path.basename(record.url);
    const filePath = path.join(UPLOAD_DIR, safeFilename);

    if (filePath.startsWith(UPLOAD_DIR) && fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath).catch(() => {});
    }

    await db
      .deleteFrom('work_item_attachments')
      .where('id', '=', attachmentId)
      .execute();

    return { success: true };
  }
}
