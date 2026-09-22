import { Module } from '@nestjs/common';
import { DeliveryPlansController } from './delivery-plans.controller.js';
import { WorkItemDependenciesController } from './work-item-dependencies.controller.js';
import { DeliveryPlansService } from './delivery-plans.service.js';
import { DeliveryPlansRepository } from './delivery-plans.repository.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';

@Module({
  imports: [AuthorizationModule],
  controllers: [DeliveryPlansController, WorkItemDependenciesController],
  providers: [DeliveryPlansService, DeliveryPlansRepository],
  exports: [DeliveryPlansService, DeliveryPlansRepository],
})
export class DeliveryPlansModule {}