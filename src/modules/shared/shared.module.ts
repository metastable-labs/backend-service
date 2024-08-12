import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedService } from './shared.service';
import { SharedController } from './shared.controller';
import { SharedAuthStrategy } from '../../common/strategies/shared.auth.strategy';
import { SharedUser } from './entities/user.entity';
import { PrivyModule } from '../../common/helpers/privy/privy.module';
import { env } from '../../common/config/env';

@Module({
  imports: [
    TypeOrmModule.forFeature([SharedUser]),
    PrivyModule,
    JwtModule.register({
      secret: env.jwt.secret,
      signOptions: { expiresIn: env.jwt.expiresIn },
    }),
  ],
  providers: [SharedService, SharedAuthStrategy],
  exports: [SharedService],
  controllers: [SharedController],
})
export class SharedModule {}
