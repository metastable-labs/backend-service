import { Module } from '@nestjs/common';
import { MigrationService } from './migration.service';
import { MigrationController } from './migration.controller';
import { CloudinaryModule } from '../../common/helpers/cloudinary/cloudinary.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { GithubModule } from '../../common/helpers/github/github.module';
import { Migration } from './entities/migration.entity';
import { HttpModule } from '@nestjs/axios';
import { User } from '../shared/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Migration]),
    CloudinaryModule,
    JwtModule,
    GithubModule,
    HttpModule,
  ],
  providers: [MigrationService],
  controllers: [MigrationController],
  exports: [MigrationService],
})
export class MigrationModule {}
