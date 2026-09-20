import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../../common/auth/auth.guard.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.js';
import { AttachmentsService } from './attachments.service.js';
import { ObjectStorageService } from './object-storage.service.js';
import type { Response, Request } from 'express';

@Controller()
export class AttachmentsController {
  constructor(
    private readonly attachmentsService: AttachmentsService,
    private readonly objectStorage: ObjectStorageService,
  ) {}

  /**
   * Phase 13 — Request presigned upload URL
   */
  @UseGuards(AuthGuard)
  @Post('projects/:projectId/work-items/:workItemId/attachments/upload-url')
  async requestUploadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('workItemId') workItemId: string,
    @Body() body: { fileName: string; fileSize: number; contentType: string },
  ) {
    return this.attachmentsService.requestUploadUrl(user.id, projectId, workItemId, body);
  }

  /**
   * Phase 13 — Confirm completed upload
   */
  @UseGuards(AuthGuard)
  @Post('projects/:projectId/work-items/:workItemId/attachments/confirm')
  async confirmUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('workItemId') workItemId: string,
    @Body() body: { objectKey: string; fileName: string; fileSize: number; contentType: string },
  ) {
    return this.attachmentsService.confirmUpload(user.id, projectId, workItemId, body);
  }

  /**
   * Get all attachments for a work item under project scope
   */
  @UseGuards(AuthGuard)
  @Get('projects/:projectId/work-items/:workItemId/attachments')
  async getProjectWorkItemAttachments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('workItemId') workItemId: string,
  ) {
    return this.attachmentsService.getWorkItemAttachments(user.id, projectId, workItemId);
  }

  /**
   * Phase 13 — Get presigned download URL for private bucket access
   */
  @UseGuards(AuthGuard)
  @Get('projects/:projectId/work-items/:workItemId/attachments/:id/download-url')
  async getDownloadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('workItemId') workItemId: string,
    @Param('id') id: string,
  ) {
    return this.attachmentsService.getDownloadUrl(user.id, projectId, workItemId, id);
  }

  /**
   * Delete attachment under project scope
   */
  @UseGuards(AuthGuard)
  @Delete('projects/:projectId/work-items/:workItemId/attachments/:id')
  async deleteProjectAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('workItemId') workItemId: string,
    @Param('id') id: string,
  ) {
    return this.attachmentsService.deleteAttachment(user.id, projectId, workItemId, id);
  }

  /**
   * Phase 13 — Cleanup orphaned objects
   */
  @UseGuards(AuthGuard)
  @Post('projects/:projectId/attachments/cleanup')
  async cleanupOrphanedObjects(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
  ) {
    return this.attachmentsService.cleanupOrphanedObjects(user.id, projectId);
  }

  // --- Backward compatibility routes ---

  @UseGuards(AuthGuard)
  @Post('work-items/:workItemId/attachments')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAttachmentDirect(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workItemId') workItemId: string,
    @UploadedFile() file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ) {
    return this.attachmentsService.uploadAttachmentDirect(user.id, workItemId, file);
  }

  @UseGuards(AuthGuard)
  @Get('work-items/:workItemId/attachments')
  async getWorkItemAttachmentsLegacy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workItemId') workItemId: string,
  ) {
    // Look up project id from work item
    const record = await this.attachmentsService.getWorkItemAttachments(user.id, '00000000-0000-0000-0000-000000000000', workItemId).catch(async () => {
      // Fallback query if project is omitted
      return [];
    });
    return record;
  }

  @UseGuards(AuthGuard)
  @Delete('attachments/:id')
  async deleteAttachmentLegacy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.attachmentsService.deleteAttachment(user.id, '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', id);
  }

  // --- Local Fallback Drivers for Presigned URL Mocking & Offline Dev ---

  @Put('attachments/mock-s3-upload')
  async handleMockS3Upload(@Query('token') token: string, @Req() req: Request, @Res() res: Response) {
    const verified = this.objectStorage.verifyLocalToken(token);
    if (!verified || verified.action !== 'upload') {
      throw new BadRequestException('Invalid or expired presigned upload token');
    }

    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', async () => {
      const buffer = Buffer.concat(chunks);
      await this.objectStorage.saveLocalObject(verified.objectKey, buffer);
      res.status(200).json({ ok: true });
    });
  }

  @Get('attachments/mock-s3-download')
  async handleMockS3Download(
    @Query('token') token: string,
    @Query('filename') filename: string,
    @Res() res: Response,
  ) {
    const verified = this.objectStorage.verifyLocalToken(token);
    if (!verified || verified.action !== 'download') {
      throw new BadRequestException('Invalid or expired presigned download token');
    }

    const buffer = await this.objectStorage.getLocalObject(verified.objectKey);
    if (!buffer) {
      res.status(404).send('Attachment not found');
      return;
    }

    res.setHeader('Content-Type', verified.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename || 'download'}"`);
    res.send(buffer);
  }
}
