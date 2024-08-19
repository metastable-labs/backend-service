import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { GithubModule } from '../../common/helpers/github/github.module';
import { env } from '../../common/config/env';
import { User } from '../shared/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    GithubModule,
    JwtModule.register({
      secret: env.jwt.secret,
      signOptions: { expiresIn: env.jwt.expiresIn },
    }),
  ],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
