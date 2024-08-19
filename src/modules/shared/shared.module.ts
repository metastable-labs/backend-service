import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedService } from './shared.service';
import { SharedController } from './shared.controller';
import { SharedAuthStrategy } from '../../common/strategies/shared.auth.strategy';
import { User } from './entities/user.entity';
import { PrivyModule } from '../../common/helpers/privy/privy.module';
import { env } from '../../common/config/env';
import { Referral } from './entities/referral.entity';
import { EarnModule } from '../earn/earn.module';
import { Wallet } from './entities/wallet.entity';
import { GithubModule } from '../../common/helpers/github/github.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Referral, Wallet]),
    PrivyModule,
    JwtModule.register({
      secret: env.jwt.secret,
      signOptions: { expiresIn: env.jwt.expiresIn },
    }),
    EarnModule,
    GithubModule,
  ],
  providers: [SharedService, SharedAuthStrategy],
  exports: [SharedService],
  controllers: [SharedController],
})
export class SharedModule {}
