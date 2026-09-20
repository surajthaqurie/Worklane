import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttachmentsService } from './attachments.service.js';
import { ObjectStorageService } from './object-storage.service.js';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('AttachmentsService unit tests (Phase 13)', () => {
  let service: AttachmentsService;
  let objectStorage: ObjectStorageService;
  let mockAuthz: any;

  beforeEach(() => {
    mockAuthz = {
      requireProjectPermission: vi.fn().mockResolvedValue(true),
    };
    objectStorage = new ObjectStorageService();
    service = new AttachmentsService(mockAuthz, objectStorage);
  });

  describe('File Validation', () => {
    it('should reject file exceeding maximum file size (25MB)', () => {
      expect(() =>
        service.validateFileMeta('huge.png', 50 * 1024 * 1024, 'image/png'),
      ).toThrow(BadRequestException);
    });

    it('should reject blacklisted dangerous file extensions (.exe, .sh, .bat)', () => {
      expect(() =>
        service.validateFileMeta('malware.exe', 1024, 'application/octet-stream'),
      ).toThrow(BadRequestException);

      expect(() =>
        service.validateFileMeta('script.sh', 1024, 'text/plain'),
      ).toThrow(BadRequestException);
    });

    it('should reject unsupported MIME types', () => {
      expect(() =>
        service.validateFileMeta('video.mp4', 1024, 'video/mp4'),
      ).toThrow(BadRequestException);
    });

    it('should reject mismatched file extension and MIME type', () => {
      expect(() =>
        service.validateFileMeta('document.pdf', 1024, 'image/png'),
      ).toThrow(BadRequestException);
    });

    it('should accept valid file types (e.g. PNG, PDF, DOCX, ZIP)', () => {
      expect(() =>
        service.validateFileMeta('photo.png', 1024, 'image/png'),
      ).not.toThrow();

      expect(() =>
        service.validateFileMeta('report.pdf', 2048, 'application/pdf'),
      ).not.toThrow();
    });
  });

  describe('Presigned Upload URLs & Confirmation Security', () => {
    it('should reject upload confirmation if object key prefix does not match project/work-item scope', async () => {
      const maliciousObjectKey = 'projects/other-proj/work-items/other-item/stolen.png';

      await expect(
        service.confirmUpload('user-1', 'proj-123', 'item-456', {
          objectKey: maliciousObjectKey,
          fileName: 'photo.png',
          fileSize: 1024,
          contentType: 'image/png',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
