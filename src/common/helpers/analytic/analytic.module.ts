import { Module } from '@nestjs/common';
import { AnalyticService } from './analytic.service';
import { ContractModule } from '../contract/contract.module';

@Module({
  imports: [ContractModule],
  providers: [AnalyticService],
  exports: [AnalyticService],
})
export class AnalyticModule {}
