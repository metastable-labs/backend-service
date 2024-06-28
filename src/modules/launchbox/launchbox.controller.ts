import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { env } from '../../common/config/env';

import { CreateDto, PaginateDto, UpdateDto } from './dtos/launchbox.dto';

import { FileMimes } from '../../common/enums/index.enum';
import { ErrorResponse } from '../../common/responses';
import { CustomUploadFileTypeValidator } from '../../common/validators/file.validator';
import { ActionDTO, PlayDTO, RankingPaginateDto } from './dtos/launchbox.dto';
import { LaunchboxService } from './launchbox.service';

@ApiTags('Launchbox')
@UseInterceptors(ClassSerializerInterceptor)
@Controller('launchbox')
export class LaunchboxController {
  constructor(private readonly launchboxService: LaunchboxService) { }

  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Token created successfully',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'An error occurred while creating the token',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Token already exists',
    type: ErrorResponse,
  })
  @UseInterceptors(FileInterceptor('logo'))
  @Post('/tokens')
  async create(
    @Body() createDto: CreateDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: env.file.maxSize * 1000 * 1024,
          }),
          new CustomUploadFileTypeValidator({
            fileType: [
              FileMimes.PNG,
              FileMimes.JPEG,
              FileMimes.JPG,
              FileMimes.SVG,
            ],
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.launchboxService.create(createDto, file);
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tokens fetched successfully',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description:
      'An error occurred while fetching the tokens. Please try again later.',
    type: ErrorResponse,
  })
  @Get('/tokens')
  async findAll(@Query() query: PaginateDto) {
    return this.launchboxService.findAll(query);
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token fetched successfully',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description:
      'An error occurred while fetching the token. Please try again later.',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Token not found',
    type: ErrorResponse,
  })
  @Patch('/tokens/:id')
  async updateOne(@Param('id') id: string, @Body() body: UpdateDto) {
    return this.launchboxService.updateOne(id, body);
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token fetched successfully',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description:
      'An error occurred while fetching the token. Please try again later.',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Token not found',
    type: ErrorResponse,
  })
  @Get('/tokens/:reference')
  async findOne(@Param('reference') reference: string) {
    return this.launchboxService.findOne(reference);
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token holders fetched successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Token not found',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description:
      'An error occurred while fetching the token holders. Please try again later.',
    type: ErrorResponse,
  })
  @Get('/tokens/:id/holders')
  async getTokenHolders(@Query() query: PaginateDto, @Param('id') id: string) {
    return this.launchboxService.getTokenHolders(query, id);
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token transactions fetched successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Token not found',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description:
      'An error occurred while fetching the token transactions. Please try again later.',
    type: ErrorResponse,
  })
  @Get('/tokens/:id/transactions')
  async getTokenTransactions(
    @Query() query: PaginateDto,
    @Param('id') id: string,
  ) {
    return this.launchboxService.getTokenTransactions(query, id);
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token casts fetched successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Token not found',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description:
      'An error occurred while fetching the token casts. Please try again later.',
    type: ErrorResponse,
  })
  @Get('/tokens/:id/casts')
  async getTokenCasts(@Param('id') id: string) {
    return this.launchboxService.getTokenCasts(id);
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Get farcaster channels by address',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'An error occurred while fetching the channels',
    type: ErrorResponse,
  })
  @Get('/channels/:address')
  async getChannelsByAddress(@Param('address') address: string) {
    return this.launchboxService.getChannelsByAddress(address);
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Get current coin price in USD',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'An error occurred while fetching the price',
    type: ErrorResponse,
  })
  @Get('/price')
  async getPrice(@Query() query: { coin: string; currency: string }) {
    query.currency = query.currency || 'usd';
    query.coin = query.coin || 'ethereum';

    return this.launchboxService.getCoinPrice(query);
  }

  @Get('tokens/holders/seed')
  async seedHolders() {
    return this.launchboxService.seedTokenHolders();
  }

  @Get('tokens/transactions/seed')
  async seedTransactions() {
    return this.launchboxService.seedTokenTransactions();
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Get token leaderboard',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'An error occurred while fetching the leaderboard',
    type: ErrorResponse,
  })
  @Get("/tokens/:id/ranking")
  async getLeaderBoard(@Param('id') id: string) {
    return this.launchboxService.getTokenLeaderBoard(id)
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Get System default incentive channels',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'An error occurred while fetching the channels',
    type: ErrorResponse,
  })
  @Get("/incentive_channels")
  async getSystemChannels() {
    return this.launchboxService.getSystemChannels()
  }


  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Get System default incentive channels',
  })
  @Post("/tokens/:id/incentives")
  async activateIncentive(@Param('id') id: string, @Body() action: ActionDTO) {
    return this.launchboxService.addIncentiveAction(id, action)
  }


  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Get Active incentive channels',
  })
  @Post("/tokens/:id/incentives")
  async getActiveIncentives(@Param('id') id: string, @Body() action: ActionDTO) {
    return this.launchboxService.getChannelsByAddress
  }


  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Participate in activities to earn points',
  })
  @Post("/tokens/:id/earn")
  async earnPoints(@Param('id') id: string, @Body() body: PlayDTO) {
    return this.launchboxService.earnPoints(id, body)
  }


  @Get("/tokens/:id/rank")
  async getWalletRank(@Param('id') id: string, @Query("adddress") user_address: string) {
    return this.launchboxService.getRank(user_address, id)
  }

  @Get("/tokens/:id/leaderboard")
  async getTokenLeaderboard(@Param("id") id: string, @Query() query: RankingPaginateDto) {
    return this.launchboxService.getAllRanking(id, query)
  }

}
