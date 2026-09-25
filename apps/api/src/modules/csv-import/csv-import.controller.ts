import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../../common/auth/auth.guard.js';
import { CsvImportService } from './csv-import.service.js';
import type { CsvImportMode } from './csv-import.types.js';

@Controller('projects/:projectId/csv-import')
@UseGuards(AuthGuard)
export class CsvImportController {
  constructor(private readonly csvImportService: CsvImportService) {}

  /**
   * POST /projects/:projectId/csv-import/parse
   * Accepts CSV file upload or raw CSV string in body and returns headers, sample rows, and suggested mappings.
   */
  @Post('parse')
  @UseInterceptors(FileInterceptor('file'))
  async parseCsv(
    @UploadedFile() file?: any,
    @Body('csvContent') csvContent?: string,
  ) {
    let content = csvContent;
    if (file && file.buffer) {
      content = file.buffer.toString('utf-8');
    }

    if (!content || !content.trim()) {
      throw new BadRequestException('Please provide a CSV file or csvContent string in request body');
    }

    return this.csvImportService.parse(content);
  }

  /**
   * POST /projects/:projectId/csv-import/validate
   * Validates parsed rows against the project domain context (states, users, areas, iterations, hierarchy).
   */
  @Post('validate')
  async validateCsv(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: { rows: Record<string, string>[]; mapping: Record<string, string> },
  ) {
    if (!body || !Array.isArray(body.rows) || !body.mapping) {
      throw new BadRequestException('Body must contain rows array and mapping object');
    }

    return this.csvImportService.validate(
      req.user.id,
      projectId,
      body.rows,
      body.mapping,
    );
  }

  /**
   * POST /projects/:projectId/csv-import/execute
   * Executes the transactional import (synchronous for small batches, background job for large batches).
   */
  @Post('execute')
  async executeImport(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body()
    body: {
      rows: Record<string, string>[];
      mapping: Record<string, string>;
      mode?: CsvImportMode;
      async?: boolean;
    },
  ) {
    if (!body || !Array.isArray(body.rows) || !body.mapping) {
      throw new BadRequestException('Body must contain rows array and mapping object');
    }

    return this.csvImportService.execute(
      req.user.id,
      projectId,
      body.rows,
      body.mapping,
      body.mode || 'ALL_OR_NOTHING',
      Boolean(body.async),
    );
  }
}
