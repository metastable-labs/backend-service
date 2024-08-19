import { Module, OnModuleInit } from '@nestjs/common';
import { EarnService } from './earn.service';
import { EarnController } from './earn.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Activity } from './entities/activity.entity';
import { Referral } from '../shared/entities/referral.entity';
import { Transaction } from './entities/transaction.entity';
import { ContractModule } from '../../common/helpers/contract/contract.module';
import { Wallet } from '../shared/entities/wallet.entity';
import { User } from '../shared/entities/user.entity';
import { AnalyticModule } from '../../common/helpers/analytic/analytic.module';
import { Cache } from '../shared/entities/cache.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Activity,
      Referral,
      Transaction,
      Wallet,
      User,
      Cache,
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
