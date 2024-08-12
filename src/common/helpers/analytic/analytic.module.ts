import { Module } from '@nestjs/common';
import { AnalyticService } from './analytic.service';
import { ContractModule } from '../contract/contract.module';
import { SharedModule } from '../../../modules/shared/shared.module';

@Module({
  imports: [ContractModule, SharedModule],
  providers: [AnalyticService],
  exports: [AnalyticService],
})
export class AnalyticModule {}
