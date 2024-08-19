import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import ormConfig from 'ormconfig';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { env } from './common/config/env';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AnalyticModule } from './common/helpers/analytic/analytic.module';
import { CloudinaryModule } from './common/helpers/cloudinary/cloudinary.module';
import { ContractModule } from './common/helpers/contract/contract.module';
import { FarcasterModule } from './common/helpers/farcaster/farcaster.module';
import { GithubModule } from './common/helpers/github/github.module';
import { PrivyModule } from './common/helpers/privy/privy.module';
import { SharedModule } from './modules/shared/shared.module';
import { LoggerMiddleware } from './common/middlewares/logger.middleware';
import { getEnvPath } from './common/utils';
import { AuthModule } from './modules/auth/auth.module';
import { EarnModule } from './modules/earn/earn.module';
import { HealthModule } from './modules/health/health.module';
import { LaunchboxModule } from './modules/launchbox/launchbox.module';
import { LiquidityModule } from './modules/liquidity/liquidity.module';
import { MigrationModule } from './modules/migration/migration.module';
import { UserModule } from './modules/user/user.module';

const envPath = getEnvPath();
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [envPath],
    }),
    TypeOrmModule.forRoot(ormConfig),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: env.throttle.ttl,
          limit: env.throttle.limit,
        },
      ],
    }),
    HealthModule,
    UserModule,
    MigrationModule,
    AuthModule,
    GithubModule,
    CloudinaryModule,
    LiquidityModule,
    EarnModule,
    ContractModule,
    LaunchboxModule,
    FarcasterModule,
    SharedModule,
    AnalyticModule,
    PrivyModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
