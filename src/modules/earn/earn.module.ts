import { Module, OnModuleInit } from '@nestjs/common';
import { EarnService } from './earn.service';
import { EarnController } from './earn.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Activity } from './entities/activity.entity';
import { SharedReferral } from '../shared/entities/referral.entity';
import { Transaction } from './entities/transaction.entity';
import { ContractModule } from '../../common/helpers/contract/contract.module';
import { SharedWallet } from '../shared/entities/wallet.entity';
import { SharedUser } from '../shared/entities/user.entity';
import { AnalyticModule } from '../../common/helpers/analytic/analytic.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Activity,
      SharedReferral,
      Transaction,
      SharedWallet,
      SharedUser,
    ]),
    ContractModule,
    AnalyticModule,
  ],
  exports: [EarnService],
  providers: [EarnService],
  controllers: [EarnController],
})
export class EarnModule implements OnModuleInit {
  constructor(private readonly earnService: EarnService) {}

  async onModuleInit() {
    await this.earnService.init();
  }
}
