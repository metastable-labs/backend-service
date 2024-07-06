import { Module, OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { env } from 'src/common/config/env';
import { CloudinaryModule } from '../../common/helpers/cloudinary/cloudinary.module';
import { ContractModule } from '../../common/helpers/contract/contract.module';
import { FarcasterModule } from '../../common/helpers/farcaster/farcaster.module';
import {
  IncentiveAction,
  IncentiveChannel,
  LaunchboxToken,
  LaunchboxTokenHolder,
  LaunchboxTokenLeaderboard,
  LaunchboxTokenTransaction,
  LaunchboxUser,
  LeaderboardParticipant,
  TokenConfiguredAction,
} from './entities/launchbox.entity';
import { LaunchboxController } from './launchbox.controller';
import { LaunchboxService } from './launchbox.service';

import { JwtModule } from '@nestjs/jwt';
import { AnalyticModule } from '../../common/helpers/analytic/analytic.module';
import { PrivyModule } from '../../common/helpers/privy/privy.module';
import { SharedModule } from '../../common/helpers/shared/shared.module';


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
      LaunchboxUser
    ]),
    CloudinaryModule,
    FarcasterModule,
    ContractModule,
    SharedModule,
    AnalyticModule,
    PrivyModule,
    JwtModule.register({
      secret: env.jwt.secret,
      signOptions: { expiresIn: env.jwt.expiresIn },
    }),
  ],
  providers: [LaunchboxService],
  controllers: [LaunchboxController],
  exports: [LaunchboxService],
})
export class LaunchboxModule implements OnModuleInit, OnApplicationBootstrap {
  constructor(private readonly service: LaunchboxService) { }
  async onModuleInit() {
    await this.service.seedSystemChannels()

  }

  async onApplicationBootstrap() {
    if (env.isProduction) {
      await this.service.init();
    }
  }

}