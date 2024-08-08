import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LiquidityService } from './liquidity.service';
import { LiquidityController } from './liquidity.controller';
import { LiquidityPool } from './entities/liquidity.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LiquidityPool])],
  providers: [LiquidityService],
  controllers: [LiquidityController],
  exports: [LiquidityService],
})
export class LiquidityModule implements OnModuleInit {
  constructor(private readonly liquidityService: LiquidityService) {}
  async onModuleInit() {
    await this.liquidityService.seedPools();
  }
}
