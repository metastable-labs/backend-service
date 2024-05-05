import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { User } from '../user/entities/user.entity';
import { IResponse } from '../../common/interfaces/response.interface';
import { ServiceError } from '../../common/errors/service.error';
import { CloudinaryService } from '../../common/helpers/cloudinary/cloudinary.service';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { Migration } from './entities/migration.entity';
import { ChainDto, MigrateDto } from './dtos/migration.dto';
import { GithubService } from '../../common/helpers/github/github.service';
import { Chain, Migrate, PullRequest } from './interfaces/migration.interface';
import { successResponse } from '../../common/responses/success.helper';
import { PrStatus, Status } from './enums/migration.enum';

@Injectable()
export class MigrationService {
  constructor(
    @InjectRepository(Migration)
    private readonly migrationRepository: MongoRepository<Migration>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly githubService: GithubService,
  ) {}

  private readonly logger = new Logger(MigrationService.name);
  async migrate(
    user: User,
    file: Express.Multer.File,
    body: MigrateDto,
  ): Promise<IResponse | ServiceError> {
    try {
      const formattedChains: Chain = JSON.parse(body.chains);

      if (!Array.isArray(formattedChains)) {
        throw new ServiceError('Invalid chains', HttpStatus.BAD_REQUEST);
      }

      this.validateBodyChains(formattedChains);

      const l1Chain: Chain = formattedChains[0];
      const l2Chain: Chain = formattedChains[1];

      const formatedBody: Migrate = {
        ...body,
        chains: formattedChains,
      };

      const logoUrl = await this.cloudinaryService.upload(file);

      if (!logoUrl) {
        throw new ServiceError('Upload failed', HttpStatus.BAD_REQUEST);
      }

      const response = await this.githubService.migrateData(
        formatedBody,
        user.username,
        logoUrl,
        file,
      );

      if (!response.status) {
        throw new ServiceError(
          'Migration failed, please try again',
          HttpStatus.BAD_REQUEST,
        );
      }

      const existMigration = await this.migrationRepository.findOne({
        where: {
          $or: [
            {
              'chains.token_address': l1Chain.token_address,
              'chains.id': l1Chain.id,
            },
            {
              'chains.token_address': l2Chain.token_address,
              'chains.id': l2Chain.id,
            },
          ],
        },
      });

      if (existMigration && existMigration.status !== Status.FAILED) {
        const mergePrs = [
          ...existMigration.pull_requests,
          ...(response.data as PullRequest[]),
        ];

        const uniqueMergedPrs = this.getUniqueMergedPrs(mergePrs);

        await this.migrationRepository.update(
          { id: existMigration.id, logo_url: logoUrl },
          { status: Status.PROCESSING, pull_requests: uniqueMergedPrs },
        );

        const updatedMigration = await this.migrationRepository.findOne({
          where: {
            id: existMigration.id,
          },
        });

        return successResponse({
          status: true,
          message: 'Migration updated successful',
          data: updatedMigration,
        });
      }

      const migration = this.migrationRepository.create({
        id: uuidv4(),
        name: body.name,
        symbol: body.symbol,
        decimals: body.decimals,
        description: body.description,
        website: body.website,
        twitter: body.twitter,
        logo_url: logoUrl,
        user_id: user.id,
        chains: formatedBody.chains,
        status: Status.PENDING,
        metadata: {},
      });

      await this.migrationRepository.save(migration);

      await this.migrationRepository.update(
        { id: migration.id },
        { status: Status.PROCESSING, pull_requests: response.data },
      );

      const updatedMigration = await this.migrationRepository.findOne({
        where: {
          id: migration.id,
        },
      });

      return successResponse({
        status: true,
        message: 'Migration successful',
        data: updatedMigration,
      });
    } catch (error) {
      this.logger.error('Migration Failed', error);

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'Error migrating data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async update(
    user: User,
    id: string,
    body: ChainDto,
  ): Promise<IResponse | ServiceError> {
    try {
      const migration = await this.migrationRepository.findOne({
        where: {
          id,
        },
      });

      if (!migration) {
        throw new ServiceError('Migration not found', HttpStatus.NOT_FOUND);
      }

      const isChainExist = migration.chains.find(
        (chain) =>
          chain.id === body.id && chain.token_address === body.token_address,
      );

      if (isChainExist) {
        throw new ServiceError(
          'Chain already migrated',
          HttpStatus.BAD_REQUEST,
        );
      }

      const migrate: Migrate = {
        name: migration.name,
        symbol: migration.symbol,
        decimals: migration.decimals,
        description: migration.description,
        website: migration.website,
        twitter: migration.twitter,
        chains: [body],
      };

      const response = await this.githubService.migrateData(
        migrate,
        user.username,
        migration.logo_url,
      );

      if (!response.status) {
        throw new ServiceError('Migration failed', HttpStatus.BAD_REQUEST);
      }

      const mergePrs = [
        ...migration.pull_requests,
        ...(response.data as PullRequest[]),
      ];

      const uniqueMergedPrs = this.getUniqueMergedPrs(mergePrs);

      migration.status = Status.PROCESSING;
      migration.pull_requests = uniqueMergedPrs;
      migration.chains.push(body as Chain);

      await this.migrationRepository.save(migration);

      const updatedMigration = await this.migrationRepository.findOne({
        where: {
          id: migration.id,
        },
      });

      return successResponse({
        status: true,
        message: 'Migration updated successful',
        data: updatedMigration,
      });
    } catch (error) {
      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'Error migrating data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async getAll(user: User): Promise<IResponse | ServiceError> {
    try {
      const migrations = await this.migrationRepository.find({
        where: {
          user_id: user.id,
        },
      });

      return successResponse({
        status: true,
        message: 'Migrations fetched',
        data: migrations,
      });
    } catch (error) {
      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'Error getting all migrations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async getOne(user: User, id: string): Promise<IResponse | ServiceError> {
    try {
      const migration = await this.migrationRepository.findOne({
        where: {
          id,
          user_id: user.id,
        },
      });

      if (!migration) {
        throw new ServiceError('Migration not found', HttpStatus.NOT_FOUND);
      }

      const existPendingPullRequest = migration.pull_requests.some(
        (pullRequest) => pullRequest.status === PrStatus.OPEN,
      );

      if (existPendingPullRequest) {
        const prsStatus = (await this.githubService.getPullRequest(
          migration.pull_requests,
        )) as PullRequest[];

        const isStatusChange = this.isStatusChange(
          migration.pull_requests,
          prsStatus,
        );

        if (isStatusChange) {
          const allPrsMerged = prsStatus.some(
            (prStatus) => prStatus.status === PrStatus.MERGED,
          );

          const allPrsClosed = prsStatus.every(
            (prStatus) => prStatus.status === PrStatus.CLOSED,
          );

          let status = Status.PROCESSING;
          if (allPrsMerged) {
            status = Status.COMPLETED;
          } else if (allPrsClosed) {
            status = Status.PROCESSING;
          }

          await this.migrationRepository.update(
            { id: migration.id },
            {
              pull_requests: prsStatus,
              status,
            },
          );
        }
      }

      const updatedMigration = await this.migrationRepository.findOne({
        where: {
          id: migration.id,
        },
      });

      return successResponse({
        status: true,
        message: 'Migration fetched',
        data: updatedMigration,
      });
    } catch (error) {
      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'Error getting migration',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  private isStatusChange(
    pullRequests1: PullRequest[],
    pullRequests2: PullRequest[],
  ): boolean {
    if (pullRequests1.length !== pullRequests2.length) {
      return false;
    }

    for (let i = 0; i < pullRequests1.length; i++) {
      if (pullRequests1[i].status !== pullRequests2[i].status) {
        return true;
      }
    }

    return false;
  }

  private getUniqueMergedPrs(mergePrs: PullRequest[]): PullRequest[] {
    return mergePrs.filter((obj, index, self) => {
      if (!obj.hasOwnProperty('id')) {
        return false;
      }

      const firstIndex = self.findIndex((o) => o.id === obj.id);

      return index === firstIndex;
    });
  }

  private validateBodyChains(chainsData: Chain[]) {
    chainsData.forEach((chain) => {
      const chainDTO = plainToInstance(ChainDto, chain);

      const validationErrors = validateSync(chainDTO);

      if (validationErrors.length > 0) {
        const errorMessage = Object.values(
          validationErrors[0].constraints as {
            [type: string]: string;
          },
        )[0];

        throw new ServiceError(errorMessage, HttpStatus.BAD_REQUEST);
      }
    });
  }
}
