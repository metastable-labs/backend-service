import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { EarnService } from './earn.service';
import { ErrorResponse } from '../../common/responses';
import { SanitizerGuard } from '../../common/guards/sanitizer.guard';
import { SharedAuthGuard } from '../../common/guards/shared.auth.guard';
import { SharedAuthRequest } from '../../common/interfaces/request.interface';
import { PaginateDto, UpdateFeaturedDto } from './dtos/earn.dto';
import { AdminGuard } from '../../common/guards/admin.guard';

@ApiTags('Earnings')
@UseInterceptors(ClassSerializerInterceptor)
@UseGuards(SanitizerGuard)
@Controller('earnings')
export class EarnController {
  constructor(private readonly earnService: EarnService) {}

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Get leaderboard',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Error getting leaderboard',
    type: ErrorResponse,
  })
  @Get('leaderboard')
  getLeaderboard() {
    return this.earnService.getLeaderboard();
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Get activities',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Error getting activities',
    type: ErrorResponse,
  })
  @Get('activities')
  getActivities() {
    return this.earnService.getActivities();
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Get featured tokens',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Error getting featured tokens',
    type: ErrorResponse,
  })
  @Get('featured_tokens')
  getFeaturedTokens() {
    return this.earnService.getFeaturedTokens();
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'NFT earnings claimed successfully',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Error claiming NFT earnings',
    type: ErrorResponse,
  })
  @HttpCode(HttpStatus.OK)
  @UseGuards(SharedAuthGuard)
  @Post('nft/claim')
  async claimNFTEarnings(@Req() req: SharedAuthRequest) {
    return this.earnService.claimNFTEarnings(req.user);
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Get user earnings',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Error getting user earnings',
    type: ErrorResponse,
  })
  @UseGuards(SharedAuthGuard)
  @Get()
  getEarnings(@Req() req: SharedAuthRequest) {
    return this.earnService.getEarnings(req.user);
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Get user  transactions',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Error getting user transactions',
    type: ErrorResponse,
  })
  @UseGuards(SharedAuthGuard)
  @Get('transactions')
  getTransactions(@Req() req: SharedAuthRequest, @Query() query: PaginateDto) {
    return this.earnService.getTransactions(req.user, query);
  }

  /** Admin Endpoints */

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'process pending balances',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Error processing pending balances',
    type: ErrorResponse,
  })
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  @Post('balances/process')
  async processPendingBalances() {
    return this.earnService.processPendingBalances();
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Update featured tokens',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Error updating featured tokens',
    type: ErrorResponse,
  })
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  @Patch('featured_tokens/:id')
  async updateFeaturedTokens(
    @Param('id') id: string,
    @Body() body: UpdateFeaturedDto,
  ) {
    return this.earnService.updateFeaturedToken(id, body);
  }
}
