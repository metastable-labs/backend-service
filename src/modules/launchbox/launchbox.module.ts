import { Module, OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { env } from '../../common/config/env';
import { CloudinaryModule } from '../../common/helpers/cloudinary/cloudinary.module';
import { ContractModule } from '../../common/helpers/contract/contract.module';
import { FarcasterModule } from '../../common/helpers/farcaster/farcaster.module';
import {
  IncentiveAction,
  IncentiveChannel,
  LaunchboxApiCredential,
  LaunchboxToken,
  LaunchboxTokenHolder,
  LaunchboxTokenLeaderboard,
  LaunchboxTokenTransaction,
  LeaderboardParticipant,
  TokenConfiguredAction,
} from './entities/launchbox.entity';
import { LaunchboxController } from './launchbox.controller';
import { LaunchboxService } from './launchbox.service';
import { AnalyticModule } from '../../common/helpers/analytic/analytic.module';
import { SharedModule } from '../shared/shared.module';
import { ApiKeyStrategy } from '../../common/strategies/api-key.strategy';
import { SharedUser } from '../shared/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LaunchboxToken,
      LaunchboxTokenHolder,
      LaunchboxTokenTransaction,
      LaunchboxTokenLeaderboard,
      IncentiveAction,
      IncentiveChannel,
      LeaderboardParticipant,
      TokenConfiguredAction,
      SharedUser,
      LaunchboxApiCredential,
    ]),
    CloudinaryModule,
    FarcasterModule,
    ContractModule,
    SharedModule,
    AnalyticModule,
  ],
  providers: [LaunchboxService, ApiKeyStrategy],
  controllers: [LaunchboxController],
  exports: [LaunchboxService],
})
export class LaunchboxModule implements OnModuleInit, OnApplicationBootstrap {
  constructor(private readonly service: LaunchboxService) {}
  async onModuleInit() {
    await this.service.seedSystemChannels();
  }

  async onApplicationBootstrap() {
    if (env.isProduction) {
      await this.service.init();
    }
  }
}
