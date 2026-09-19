import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../../common/auth/auth.guard.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.js';
import { AttachmentsService } from './attachments.service.js';
import type { Response } from 'express';

@Controller()
@UseGuards(AuthGuard)
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post('work-items/:workItemId/attachments')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workItemId') workItemId: string,
    @UploadedFile() file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ) {
    return this.attachmentsService.uploadAttachment(user.id, workItemId, file);
  }

  @Get('work-items/:workItemId/attachments')
  async getWorkItemAttachments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workItemId') workItemId: string,
  ) {
    return this.attachmentsService.getWorkItemAttachments(user.id, workItemId);
  }

  @Get('attachments/file/:filename')
  async getAttachmentFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const fileInfo = await this.attachmentsService.getAttachmentFile(user.id, filename);
    res.setHeader('Content-Type', fileInfo.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${fileInfo.fileName}"`);
    res.sendFile(fileInfo.filePath);
  }

  @Delete('attachments/:id')
  async deleteAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.attachmentsService.deleteAttachment(user.id, id);
  }
}
