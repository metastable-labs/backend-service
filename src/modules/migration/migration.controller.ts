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
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { MigrationService } from './migration.service';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthRequest } from '../../common/interfaces/request.interface';
import { env } from '../../common/config/env';
import { CustomUploadFileTypeValidator } from '../../common/validators/file.validator';
import { ChainDto, MigrateDto } from './dtos/migration.dto';
import { ErrorResponse } from '../../common/responses';
import { MigrationResponse, MigrationsResponse } from './responses/migration';
import { SharedAuthGuard } from '../../common/guards/shared.auth.guard';

@ApiTags('Migrations')
@ApiBearerAuth()
@UseGuards(SharedAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
@Controller('migrations')
export class MigrationController {
  constructor(private readonly migrationService: MigrationService) {}

  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Migration successful',
    type: MigrationResponse,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Migration failed',
    type: ErrorResponse,
  })
  @UseInterceptors(FileInterceptor('logo'))
  @Post()
  async migrate(
    @Req() req: AuthRequest,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: env.file.maxSize * 1000 * 1024,
          }),
          new CustomUploadFileTypeValidator({
            fileType: env.file.allowedMimes,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() body: MigrateDto,
  ) {
    return this.migrationService.migrate(req.user, file, body);
  }
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Migration updated successful',
    type: MigrationResponse,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Migration failed',
    type: ErrorResponse,
  })
  @Patch('/:id')
  async update(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: ChainDto,
  ) {
    return await this.migrationService.update(req.user, id, body);
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Migration added successful',
    type: MigrationResponse,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Migration failed',
    type: ErrorResponse,
  })
  @UseInterceptors(FileInterceptor('logo'))
  @Post('/:id/superbridge')
  async addSuperbridge(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: env.file.maxSize * 1000 * 1024,
          }),
          new CustomUploadFileTypeValidator({
            fileType: env.file.allowedMimes,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return await this.migrationService.addSuperbridge(req.user, id, file);
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Migrations fetched',
    type: MigrationsResponse,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Error getting all migrations',
    type: ErrorResponse,
  })
  @Get()
  async getAll(@Req() req: AuthRequest) {
    return this.migrationService.getAll(req.user);
  }

  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Migrations fetched',
    type: MigrationResponse,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Error getting all migrations',
    type: ErrorResponse,
  })
  @Get('/:id')
  async getOne(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.migrationService.getOne(req.user, id);
  }
}
