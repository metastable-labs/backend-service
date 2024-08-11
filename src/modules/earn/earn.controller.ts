import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { EarnService } from './earn.service';
import { ErrorResponse } from '../../common/responses';
import { RegisterDto } from './dtos/earn.dto';
import { SanitizerGuard } from '../../common/guards/sanitizer.guard';

@ApiTags('Earns')
@UseInterceptors(ClassSerializerInterceptor)
@UseGuards(SanitizerGuard)
@Controller('earns')
export class EarnController {
  constructor(private readonly earnService: EarnService) {}

  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Earn registration successful',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Error registering to earn',
    type: ErrorResponse,
  })
  @Post('register')
  async register(@Req() req: Request, @Body() body: RegisterDto) {
    const ip = req.clientIp as string;

    return this.earnService.register(body, ip);
  }

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
    description: 'Claim NFT earnings successful',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Error claiming NFT earnings',
    type: ErrorResponse,
  })
  @Post('nft/claim/:address')
  async claimNFTEarnings(@Param('address') address: string) {
    return this.earnService.claimNFTEarnings(address);
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Get user earns',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Error getting user earns',
    type: ErrorResponse,
  })
  @Get('/:address')
  getEarns(@Req() req: Request, @Param('address') address: string) {
    return this.earnService.getEarns(address);
  }
}
