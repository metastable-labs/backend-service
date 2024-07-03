import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { LaunchboxService } from './launchbox.service';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import {
  CustomUploadFileTypeValidator,
  ParseFilesPipe,
} from '../../common/validators/file.validator';
import { env } from '../../common/config/env';
import {
  CreateDto,
  PaginateDto,
  PriceAnalyticQueryDto,
  UpdateDto,
  WebsiteBuilderDto,
} from './dtos/launchbox.dto';
import { FileMimes } from '../../common/enums/index.enum';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { ErrorResponse } from '../../common/responses';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { flattenValidationErrors } from 'src/common/utils';

@ApiTags('Launchbox')
@UseInterceptors(ClassSerializerInterceptor)
@Controller('launchbox')
export class LaunchboxController {
  constructor(private readonly launchboxService: LaunchboxService) {}

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
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'logo', maxCount: 1 },
      { name: 'hero', maxCount: 1 },
    ]),
  )
  @HttpCode(HttpStatus.OK)
  @Post('/tokens/:id/website-builder')
  async updateWebsiteBuilder(
    @Param('id') id: string,
    @Body() body: Record<string, string>,
    @UploadedFiles(
      new ParseFilesPipe(
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
      ),
    )
    files: {
      logo: Express.Multer.File[];
      hero: Express.Multer.File[];
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

    return this.launchboxService.updateWebsiteBuilder(id, dto, files);
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
  async getChannelsByAddress(
    @Param('address') address: string,
    @Query() query: PaginateDto,
  ) {
    return this.launchboxService.getChannelsByAddress(
      address,
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
}
