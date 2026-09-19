import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/auth/auth.guard.js';
import { QueriesService } from './queries.service.js';
import { CreateQueryDto, UpdateQueryDto } from './dto/queries.dto.js';

@Controller('projects/:projectId/queries')
@UseGuards(AuthGuard)
export class QueriesController {
  constructor(private readonly queriesService: QueriesService) {}

  private getUserId(req: any) {
    return req.user.id;
  }

  @Post()
  create(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() createQueryDto: CreateQueryDto,
  ) {
    return this.queriesService.create(
      this.getUserId(req),
      projectId,
      createQueryDto,
    );
  }

  // Ad-hoc "run" must be declared before @Post(':id/run') so the literal path
  // is matched first.
  @Post('run')
  runAdhoc(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: { definition?: any },
  ) {
    return this.queriesService.runAdhoc(
      this.getUserId(req),
      projectId,
      body?.definition,
    );
  }

  @Get()
  findAll(@Req() req: any, @Param('projectId') projectId: string) {
    return this.queriesService.findAll(this.getUserId(req), projectId);
  }

  // Declared before @Get(':id') so the literal path takes precedence.
  @Get('recent')
  recent(@Req() req: any, @Param('projectId') projectId: string) {
    return this.queriesService.recent(this.getUserId(req), projectId);
  }

  @Get(':id')
  findOne(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.queriesService.findOne(this.getUserId(req), projectId, id);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() updateQueryDto: UpdateQueryDto,
  ) {
    return this.queriesService.update(
      this.getUserId(req),
      projectId,
      id,
      updateQueryDto,
    );
  }

  @Delete(':id')
  remove(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.queriesService.remove(this.getUserId(req), projectId, id);
  }

  @Post(':id/run')
  runSaved(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.queriesService.runSaved(this.getUserId(req), projectId, id);
  }
}