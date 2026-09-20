import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BackgroundJobsService } from './background-jobs.service.js';
import { dispatchJobSchema, getJobsQuerySchema } from './dto/background-job.dto.js';
import { AuthGuard } from '../../common/auth/auth.guard.js';

@Controller('background-jobs')
@UseGuards(AuthGuard)
export class BackgroundJobsController {
  constructor(private readonly jobsService: BackgroundJobsService) {}

  @Post('dispatch')
  @HttpCode(HttpStatus.ACCEPTED)
  async dispatch(@Body() body: unknown) {
    const parseResult = dispatchJobSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.flatten());
    }

    const { job, isDuplicate } = await this.jobsService.dispatchJob(parseResult.data);
    return {
      message: isDuplicate ? 'Job already dispatched (idempotent request)' : 'Job dispatched successfully',
      isDuplicate,
      job,
    };
  }

  @Get()
  async listJobs(@Query() query: unknown) {
    const parseResult = getJobsQuerySchema.safeParse(query);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.flatten());
    }

    const jobs = await this.jobsService.listJobs(parseResult.data);
    return { jobs };
  }

  @Get(':id')
  async getJobStatus(@Param('id') id: string) {
    const job = await this.jobsService.getJobStatus(id);
    return { job };
  }

  @Post(':id/retry')
  async retryJob(@Param('id') id: string) {
    const job = await this.jobsService.retryJob(id);
    return {
      message: 'Retry initiated for background job',
      job,
    };
  }
}
