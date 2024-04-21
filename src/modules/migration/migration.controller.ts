import {
  Body,
  Controller,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { MigrationService } from './migration.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/guards/auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthRequest } from '../../common/interfaces/request.interface';
import { env } from '../../common/config/env';
import { CustomUploadFileTypeValidator } from '../../common/validators/file.validator';
import { MigrateDto } from './dtos/migration.dto';

@ApiTags('Migration')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('migrations')
export class MigrationController {
  constructor(private readonly migrationService: MigrationService) {}

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
}