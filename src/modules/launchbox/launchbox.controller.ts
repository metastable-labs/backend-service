import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { env } from '../../common/config/env';

import {
  ActionsArrayDTO,
  CreateApiKeyDto,
  CreateDto,
  PaginateDto,
  PriceAnalyticQueryDto,
  RemoveActionDTO,
  UpdateDto,
  WebsiteBuilderDto,
  RankingPaginateDto,
} from './dtos/launchbox.dto';

import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { FileMimes } from '../../common/enums/index.enum';
import { LaunchboxAuthGuard } from '../../common/guards/lauchbox.auth.guard';
import { PrivyGuard } from '../../common/guards/privy.guard';
import { LaunchboxAuthRequest } from '../../common/interfaces/request.interface';
import { ErrorResponse } from '../../common/responses';
import { flattenValidationErrors } from '../../common/utils';
import {
  CustomUploadFileTypeValidator,
  ParseFilesPipe,
} from '../../common/validators/file.validator';
import { LaunchboxService } from './launchbox.service';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Launchbox')
@UseInterceptors(ClassSerializerInterceptor)
@Controller('launchbox')
export class LaunchboxController {
  constructor(private readonly launchboxService: LaunchboxService) {}

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
  async auth(@Req() request: LaunchboxAuthRequest) {
    return this.launchboxService.authenticate(request.body.userId);
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
  @UseGuards(LaunchboxAuthGuard)
  @Get('auth/session')
  async authSession(@Req() request: LaunchboxAuthRequest) {
    return this.launchboxService.authSession(request.user);
  }

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
  @UseGuards(AuthGuard(['launchbox-auth', 'api-key']))
  @UseInterceptors(FileInterceptor('logo'))
  @Post('/tokens')
  async create(
    @Req() req: LaunchboxAuthRequest,
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
    return this.launchboxService.create(req.user, createDto, file);
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
  @UseGuards(LaunchboxAuthGuard)
  @Patch('/tokens/:id')
  async updateOne(
    @Req() req: LaunchboxAuthRequest,
    @Param('id') id: string,
    @Body() body: UpdateDto,
  ) {
    return this.launchboxService.updateOne(req.user, id, body);
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
    description: 'Token price analytics fetched successfully',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description:
      'An error occurred while fetching the token price analytics. Please try again later.',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Token not found',
    type: ErrorResponse,
  })
  @Get('/tokens/:reference/price-analytics')
  async getPriceAnalytics(
    @Param('reference') reference: string,
    @Query() query: PriceAnalyticQueryDto,
  ) {
    return this.launchboxService.getPriceAnalytics(reference, query.period);
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token channel analytics fetched successfully',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description:
      'An error occurred while fetching the token channel analytics. Please try again later.',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Token not found',
    type: ErrorResponse,
  })
  @Get('/tokens/:reference/channel-analytics')
  async getChannelAnalytics(
    @Param('reference') reference: string,
    @Query() query: PriceAnalyticQueryDto,
  ) {
    return this.launchboxService.getChannelAnalytics(reference, query.period);
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
  async getTokenCasts(@Param('id') id: string, @Query() query: PaginateDto) {
    return this.launchboxService.getTokenCasts(id, parseInt(query.take));
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token website builder created successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Token not found',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description:
      'An error occurred while creating website builder. Please try again later.',
    type: ErrorResponse,
  })
  @UseGuards(LaunchboxAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'logo', maxCount: 1 },
      { name: 'hero', maxCount: 1 },
      { name: 'about', maxCount: 1 },
    ]),
  )
  @HttpCode(HttpStatus.OK)
  @Patch('/tokens/:id/website-builder')
  async updateWebsiteBuilder(
    @Req() req: LaunchboxAuthRequest,
    @Param('id') id: string,
    @Body() body: Record<string, string>,
    @UploadedFiles(
      new ParseFilesPipe(
        new ParseFilePipe({
          fileIsRequired: false,
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
      ),
    )
    files: {
      logo: Express.Multer.File[];
      hero: Express.Multer.File[];
      about: Express.Multer.File[];
    },
  ) {
    const parsedFormData = Object.entries(body).reduce(
      (acc, [key, value]) => {
        try {
          acc[key] = JSON.parse(value);
        } catch {
          acc[key] = value;
        }
        return acc;
      },
      {} as Record<string, any>,
    );

    const dto = plainToInstance(WebsiteBuilderDto, {
      ...parsedFormData,
    });

    const validationErrors = validateSync(dto);

    if (validationErrors.length > 0) {
      const flatErrors = flattenValidationErrors(validationErrors);
      throw new BadRequestException(flatErrors);
    }

    return this.launchboxService.updateWebsiteBuilder(req.user, id, dto, files);
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
  @UseGuards(LaunchboxAuthGuard)
  @Get('/channels/:address')
  async getChannelsByAddress(
    @Req() req: LaunchboxAuthRequest,
    @Query() query: PaginateDto,
  ) {
    return this.launchboxService.getChannelsByAddress(
      req.user,
      parseInt(query.take),
    );
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
  async getPrice() {
    return this.launchboxService.getCoinPrice();
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
  @Get('/tokens/:id/ranking')
  async getLeaderBoard(@Param('id') id: string) {
    return this.launchboxService.getTokenLeaderBoard(id);
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
  @Get('/incentive_channels')
  async getSystemChannels() {
    return this.launchboxService.getSystemChannels();
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Add Incentive Action to leaderboard',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'An error occurred while adding the incentive action',
    type: ErrorResponse,
  })
  @Post('/tokens/:id/incentives')
  @UseGuards(LaunchboxAuthGuard)
  async activateIncentive(
    @Param('id') token_id: string,
    @Body() actions: ActionsArrayDTO,
    @Req() req: LaunchboxAuthRequest,
  ) {
    return this.launchboxService.addIncentiveAction(
      req.user,
      token_id,
      actions,
    );
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Remove Configured Incentive Action',
  })
  @Delete('/tokens/:id/incentives')
  @UseGuards(LaunchboxAuthGuard)
  async removeIncentive(
    @Param('id') token_id: string,
    @Body() { action_id }: RemoveActionDTO,
    @Req() req: LaunchboxAuthRequest,
  ) {
    return this.launchboxService.removeIncentiveAction(
      req.user,
      token_id,
      action_id,
    );
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Calculate Ranks',
  })
  @Get('/calculate_rankings')
  async scoreParticipants() {
    return this.launchboxService.calculateRanks();
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Participate in activities to earn points',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'An error occurred while earning points',
    type: ErrorResponse,
  })
  @Post('/tokens/:id/earn')
  @UseGuards(LaunchboxAuthGuard)
  async earnPoints(@Req() req: LaunchboxAuthRequest, @Param('id') id: string) {
    return this.launchboxService.earnPoints(req.user, id);
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Get wallet rank',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'An error occurred while fetching the rank',
    type: ErrorResponse,
  })
  @Get('/tokens/:id/rank')
  async getWalletRank(
    @Param('id') id: string,
    @Query('adddress') user_address: string,
  ) {
    return this.launchboxService.getRank(user_address, id);
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
  @Get('/tokens/:id/leaderboard')
  async getTokenLeaderboard(
    @Param('id') id: string,
    @Query() query: RankingPaginateDto,
  ) {
    return this.launchboxService.getAllRanking(id, query);
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Activate token leaderboard',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'An error occurred while fetching the leaderboard',
    type: ErrorResponse,
  })
  @UseGuards(LaunchboxAuthGuard)
  @Put('/tokens/:id/leaderboard/status')
  async activateTokenLeaderboard(
    @Req() req: LaunchboxAuthRequest,
    @Param('id') id: string,
  ) {
    return this.launchboxService.activateLeaderboard(req.user, id);
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Create API key',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'An error occurred while creating the API key',
    type: ErrorResponse,
  })
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  @Post('/admin/api-keys')
  async createApiKey(@Body() body: CreateApiKeyDto) {
    return this.launchboxService.createApiKey(body);
  }
}
