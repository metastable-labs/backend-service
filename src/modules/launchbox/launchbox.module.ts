import { HttpModule } from '@nestjs/axios';
import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
  LeaderboardParticipant,
  TokenConfiguredAction,
} from './entities/launchbox.entity';
import { LaunchboxController } from './launchbox.controller';
import { LaunchboxService } from './launchbox.service';

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
      TokenConfiguredAction
    ]),
    CloudinaryModule,
    FarcasterModule,
    HttpModule,
    ContractModule,
  ],
  providers: [LaunchboxService],
  controllers: [LaunchboxController],
  exports: [LaunchboxService],
})
export class LaunchboxModule implements OnModuleInit {
  constructor(private readonly service: LaunchboxService) { }
  async onModuleInit() {
    // await this.service.seedSystemChannels()
  }
}
