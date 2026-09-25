import { Module, forwardRef } from '@nestjs/common';
import { CsvImportController } from './csv-import.controller.js';
import { CsvImportService } from './csv-import.service.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { BackgroundJobsModule } from '../background-jobs/background-jobs.module.js';

@Module({
  imports: [
    AuthorizationModule,
    forwardRef(() => BackgroundJobsModule),
  ],
  controllers: [CsvImportController],
  providers: [CsvImportService],
  exports: [CsvImportService],
})
export class CsvImportModule {}
