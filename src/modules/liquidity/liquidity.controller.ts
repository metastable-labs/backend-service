import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { LiquidityService } from './liquidity.service';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { ErrorResponse } from '../../common/responses';
import { PaginateDto } from './dtos/liquidity.dto';

@ApiTags('Liquidities')
@UseInterceptors(ClassSerializerInterceptor)
@Controller('liquidities')
export class LiquidityController {
  constructor(private readonly liquidityService: LiquidityService) {}

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Liquidity pools fetched',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Error getting all liquidity pools',
    type: ErrorResponse,
  })
  @Get('/pools')
  async getPools(@Query() query: PaginateDto) {
    return this.liquidityService.getPools(query);
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Liquidity pool fetched',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Liquidity pool not found',
    type: ErrorResponse,
  })
  @Get('/pools/:id')
  async getOnePool(@Param('id') id: string) {
    return this.liquidityService.getOnePool(id);
  }
}
