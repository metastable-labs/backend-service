import { Module } from '@nestjs/common';
import { LiquidityService } from './liquidity.service';
import { LiquidityController } from './liquidity.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Liquidity } from './entities/liquidity.entity';
import { JwtModule } from '@nestjs/jwt';
import { User } from '../shared/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Liquidity, User]), JwtModule],
  providers: [LiquidityService],
  controllers: [LiquidityController],
  exports: [LiquidityService],
})
export class LiquidityModule {}
