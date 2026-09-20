import { Injectable, Logger } from '@nestjs/common';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface PresignedUploadResult {
  uploadUrl: string;
  objectKey: string;
  method: string;
  headers: Record<string, string>;
  expiresAt: string;
}

export interface PresignedDownloadResult {
  downloadUrl: string;
  expiresAt: string;
}

export interface ObjectMetadata {
  contentLength: number;
  contentType: string;
  lastModified?: Date;
}

@Injectable()
export class ObjectStorageService {
  private readonly logger = new Logger(ObjectStorageService.name);

  private readonly endpoint: string;
  private readonly region: string;
  private readonly bucket: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly forcePathStyle: boolean;
  private readonly isS3Configured: boolean;
  private readonly uploadDir: string;

  constructor() {
    this.endpoint = process.env.S3_ENDPOINT || '';
    this.region = process.env.S3_REGION || 'us-east-1';
    this.bucket = process.env.S3_BUCKET || 'worklane-attachments';
    this.accessKeyId = process.env.S3_ACCESS_KEY_ID || '';
    this.secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || '';
    this.forcePathStyle = process.env.S3_FORCE_PATH_STYLE !== 'false';
    this.uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');

    this.isS3Configured = Boolean(this.endpoint && this.accessKeyId && this.secretAccessKey);

    if (this.isS3Configured) {
      this.logger.log(`S3 Object Storage initialized targeting bucket "${this.bucket}" at endpoint ${this.endpoint}`);
    } else {
      this.logger.log(`S3 environment variables not set. Using local object storage driver at "${this.uploadDir}"`);
      if (!fs.existsSync(this.uploadDir)) {
        fs.mkdirSync(this.uploadDir, { recursive: true });
      }
    }
  }

  /**
   * Generates a safe object key scoped by project and work item
   */
  generateObjectKey(projectId: string, workItemId: string, fileName: string): string {
    const ext = path.extname(fileName).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const baseName = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
    const uniqueId = crypto.randomUUID();
    return `projects/${projectId}/work-items/${workItemId}/${uniqueId}-${baseName}${ext}`;
  }

  /**
   * Generates a presigned URL for direct client PUT upload
   */
  async generatePresignedUploadUrl(
    objectKey: string,
    contentType: string,
    expiresInSeconds = 900,
  ): Promise<PresignedUploadResult> {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    if (this.isS3Configured) {
      const url = this.buildSigV4PresignedUrl('PUT', objectKey, contentType, expiresInSeconds);
      return {
        uploadUrl: url,
        objectKey,
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
        },
        expiresAt,
      };
    }

    // Local fallback presigned URL
    const token = this.generateLocalToken('upload', objectKey, contentType, expiresInSeconds);
    const baseUrl = process.env.PUBLIC_API_URL || 'http://localhost:3001';
    const uploadUrl = `${baseUrl}/attachments/mock-s3-upload?token=${token}&key=${encodeURIComponent(objectKey)}`;

    return {
      uploadUrl,
      objectKey,
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      expiresAt,
    };
  }

  /**
   * Generates a short-lived presigned URL for secure private bucket GET downloads
   */
  async generatePresignedDownloadUrl(
    objectKey: string,
    fileName: string,
    contentType: string,
    expiresInSeconds = 900,
  ): Promise<PresignedDownloadResult> {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    if (this.isS3Configured) {
      const url = this.buildSigV4PresignedUrl('GET', objectKey, contentType, expiresInSeconds, fileName);
      return {
        downloadUrl: url,
        expiresAt,
      };
    }

    // Local fallback presigned download URL
    const token = this.generateLocalToken('download', objectKey, contentType, expiresInSeconds);
    const baseUrl = process.env.PUBLIC_API_URL || 'http://localhost:3001';
    const downloadUrl = `${baseUrl}/attachments/mock-s3-download?token=${token}&key=${encodeURIComponent(objectKey)}&filename=${encodeURIComponent(fileName)}`;

    return {
      downloadUrl,
      expiresAt,
    };
  }

  /**
   * Verifies object presence and returns basic metadata
   */
  async getObjectMetadata(objectKey: string): Promise<ObjectMetadata | null> {
    if (this.isS3Configured) {
      try {
        const headUrl = this.buildSigV4PresignedUrl('HEAD', objectKey, 'application/octet-stream', 60);
        const res = await fetch(headUrl, { method: 'HEAD' });
        if (!res.ok) return null;

        const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
        const contentType = res.headers.get('content-type') || 'application/octet-stream';
        return { contentLength, contentType };
      } catch (err) {
        this.logger.error(`S3 HEAD object error for ${objectKey}:`, err);
        return null;
      }
    }

    // Local fallback
    const localPath = path.join(this.uploadDir, objectKey.replace(/\//g, '_'));
    if (!fs.existsSync(localPath)) return null;

    const stat = await fs.promises.stat(localPath);
    return {
      contentLength: stat.size,
      contentType: 'application/octet-stream',
      lastModified: stat.mtime,
    };
  }

  /**
   * Write data directly (for mock/local or fallback direct upload)
   */
  async saveLocalObject(objectKey: string, buffer: Buffer): Promise<string> {
    const localPath = path.join(this.uploadDir, objectKey.replace(/\//g, '_'));
    await fs.promises.writeFile(localPath, buffer);
    return localPath;
  }

  /**
   * Read data directly (for local fallback download)
   */
  async getLocalObject(objectKey: string): Promise<Buffer | null> {
    const localPath = path.join(this.uploadDir, objectKey.replace(/\//g, '_'));
    if (!fs.existsSync(localPath)) return null;
    return await fs.promises.readFile(localPath);
  }

  /**
   * Delete object from storage
   */
  async deleteObject(objectKey: string): Promise<boolean> {
    if (this.isS3Configured) {
      try {
        const deleteUrl = this.buildSigV4PresignedUrl('DELETE', objectKey, '', 60);
        await fetch(deleteUrl, { method: 'DELETE' });
        return true;
      } catch (err) {
        this.logger.error(`Failed to delete S3 object key ${objectKey}`, err);
        return false;
      }
    }

    // Local fallback
    const localPath = path.join(this.uploadDir, objectKey.replace(/\//g, '_'));
    if (fs.existsSync(localPath)) {
      await fs.promises.unlink(localPath).catch(() => {});
    }
    return true;
  }

  /**
   * AWS SigV4 URL Generator for S3 / MinIO
   */
  private buildSigV4PresignedUrl(
    method: string,
    objectKey: string,
    contentType: string,
    expiresInSeconds: number,
    contentDispositionFileName?: string,
  ): string {
    const now = new Date();
    const isoDate = now.toISOString().replace(/[:-]/g, '').split('.')[0] + 'Z';
    const dateStamp = isoDate.slice(0, 8);

    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;

    let host = new URL(this.endpoint).host;
    let urlPath = `/${this.bucket}/${objectKey}`;

    if (!this.forcePathStyle && !this.endpoint.includes('localhost') && !this.endpoint.includes('127.0.0.1')) {
      host = `${this.bucket}.${host}`;
      urlPath = `/${objectKey}`;
    }

    const queryParams: Record<string, string> = {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${this.accessKeyId}/${credentialScope}`,
      'X-Amz-Date': isoDate,
      'X-Amz-Expires': expiresInSeconds.toString(),
      'X-Amz-SignedHeaders': 'host',
    };

    if (contentDispositionFileName) {
      queryParams['response-content-disposition'] = `inline; filename="${encodeURIComponent(contentDispositionFileName)}"`;
    }

    const canonicalQueryString = Object.keys(queryParams)
      .sort()
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
      .join('&');

    const canonicalHeaders = `host:${host}\n`;
    const signedHeaders = 'host';
    const payloadHash = 'UNSIGNED-PAYLOAD';

    const canonicalRequest = [
      method,
      urlPath,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      isoDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const signingKey = this.getSignatureKey(this.secretAccessKey, dateStamp, this.region, 's3');
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    const protocol = this.endpoint.startsWith('https') ? 'https' : 'http';
    return `${protocol}://${host}${urlPath}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
  }

  private getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Buffer {
    const kDate = crypto.createHmac('sha256', `AWS4${key}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
    return crypto.createHmac('sha256', kService).update('aws4_request').digest();
  }

  /**
   * Helper to sign local tokens for fallback driver
   */
  private generateLocalToken(action: 'upload' | 'download', objectKey: string, contentType: string, expiresInSeconds: number): string {
    const secret = process.env.JWT_SECRET || 'worklane-local-secret-2026';
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const payload = JSON.stringify({ action, objectKey, contentType, expiresAt });
    const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return Buffer.from(JSON.stringify({ payload, hmac })).toString('base64url');
  }

  verifyLocalToken(token: string): { action: string; objectKey: string; contentType: string } | null {
    try {
      const secret = process.env.JWT_SECRET || 'worklane-local-secret-2026';
      const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
      const expectedHmac = crypto.createHmac('sha256', secret).update(decoded.payload).digest('hex');

      if (crypto.timingSafeEqual(Buffer.from(decoded.hmac), Buffer.from(expectedHmac))) {
        const payload = JSON.parse(decoded.payload);
        if (payload.expiresAt < Date.now()) return null;
        return payload;
      }
      return null;
    } catch {
      return null;
    }
  }
}
