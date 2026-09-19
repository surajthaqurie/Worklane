import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttachmentsService } from './attachments.service.js';
import { BadRequestException } from '@nestjs/common';

describe('AttachmentsService unit tests', () => {
  let service: AttachmentsService;
  let mockAuthz: any;

  beforeEach(() => {
    mockAuthz = {
      requireProjectPermission: vi.fn(),
    };
    service = new AttachmentsService(mockAuthz);
  });

  it('should reject file upload when no file is provided', async () => {
    await expect(
      service.uploadAttachment('user-1', 'item-1', null as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject file exceeding maximum file size', async () => {
    const hugeFile = {
      originalname: 'huge.png',
      mimetype: 'image/png',
      size: 50 * 1024 * 1024, // 50MB
      buffer: Buffer.from('test'),
    };

    await expect(
      service.uploadAttachment('user-1', 'item-1', hugeFile),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject file with unsupported MIME type', async () => {
    const forbiddenFile = {
      originalname: 'script.sh',
      mimetype: 'application/x-sh',
      size: 1024,
      buffer: Buffer.from('echo 1'),
    };

    await expect(
      service.uploadAttachment('user-1', 'item-1', forbiddenFile),
    ).rejects.toThrow(BadRequestException);
  });
});
