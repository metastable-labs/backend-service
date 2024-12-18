import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { SharedService } from './shared.service';
import { ErrorResponse } from '../../common/responses';
import { PrivyGuard } from '../../common/guards/privy.guard';
import { SharedAuthRequest } from '../../common/interfaces/request.interface';
import { SharedAuthGuard } from '../../common/guards/shared.auth.guard';
import { AuthDto } from './dtos/shared.dto';
import { GithubAuthDto } from '../auth/dtos/auth.dto';

@ApiTags('Shared')
@UseInterceptors(ClassSerializerInterceptor)
@Controller('shared')
export class SharedController {
  constructor(private readonly sharedService: SharedService) {}

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Authenticated successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized request',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'An error occurred while authenticating',
    type: ErrorResponse,
  })
  @HttpCode(HttpStatus.OK)
  @UseGuards(PrivyGuard)
  @Post('auth')
  async auth(@Req() request: SharedAuthRequest, @Body() body: AuthDto) {
    return this.sharedService.authenticate(
      request.body.userId,
      body.referral_code,
    );
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Github authentication',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized request',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'An error occurred while authenticating',
    type: ErrorResponse,
  })
  @HttpCode(HttpStatus.OK)
  @UseGuards(SharedAuthGuard)
  @Post('/auth/github')
  async github(@Req() request: SharedAuthRequest, @Body() body: GithubAuthDto) {
    const ip = request.clientIp as string;

    return this.sharedService.github(request.user, body.code, ip);
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Authenticated session',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized request',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'An error occurred while authenticating the session',
    type: ErrorResponse,
  })
  @HttpCode(HttpStatus.OK)
  @UseGuards(SharedAuthGuard)
  @Get('auth/session')
  async authSession(@Req() request: SharedAuthRequest) {
    return this.sharedService.authSession(request.user);
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Caddy Verify Domain',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized request',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'An error occurred while authenticating the session',
    type: ErrorResponse,
  })
  @HttpCode(HttpStatus.OK)
  @Get('caddy/verify')
  async verifyDomain(@Query() query: { domain: string }) {
    return this.sharedService.verifyDomain(query.domain);
  }
}
