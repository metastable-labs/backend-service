import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LaunchboxService } from './launchbox.service';
import { LaunchboxController } from './launchbox.controller';
import {
  LaunchboxToken,
  LaunchboxTokenHolder,
  LaunchboxTokenTransaction,
  LaunchboxUser,
} from './entities/launchbox.entity';
import { CloudinaryModule } from '../../common/helpers/cloudinary/cloudinary.module';
import { FarcasterModule } from '../../common/helpers/farcaster/farcaster.module';
import { ContractModule } from '../../common/helpers/contract/contract.module';
import { SharedModule } from '../../common/helpers/shared/shared.module';
import { AnalyticModule } from '../../common/helpers/analytic/analytic.module';
import { env } from '../../common/config/env';
import { PrivyModule } from '../../common/helpers/privy/privy.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LaunchboxToken,
      LaunchboxTokenHolder,
      LaunchboxTokenTransaction,
      LaunchboxUser,
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
export class LaunchboxModule implements OnApplicationBootstrap {
  constructor(private readonly launchboxService: LaunchboxService) {}

  async onApplicationBootstrap() {
    if (env.isProduction) {
      await this.launchboxService.init();
    }
  }
}
