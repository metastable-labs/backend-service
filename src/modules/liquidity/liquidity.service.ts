import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { v4 as uuidv4 } from 'uuid';
import { MongoRepository } from 'typeorm';
import { Liquidity } from './entities/liquidity.entity';
import { CreateDto } from './dtos/liquidity.dto';
import { IResponse } from '../../common/interfaces/response.interface';
import { ServiceError } from '../../common/errors/service.error';
import { successResponse } from 'src/common/responses/success.helper';
import { User } from '../shared/entities/user.entity';

@Injectable()
export class LiquidityService {
  constructor(
    @InjectRepository(Liquidity)
    private readonly liquidityRepository: MongoRepository<Liquidity>,
  ) {}

  private readonly logger = new Logger(LiquidityService.name);

  async create(user: User, body: CreateDto): Promise<IResponse | ServiceError> {
    try {
      const liquidityExist = await this.liquidityRepository.findOne({
        where: {
          transaction_hash: body.transaction_hash,
          'chain.id': body.chain.id,
        },
      });

      if (liquidityExist) {
        throw new ServiceError('Liquidity already exist', HttpStatus.CONFLICT);
      }

      const liquidity = this.liquidityRepository.create({
        id: uuidv4(),
        user_id: user.id,
        ...body,
      });

      await this.liquidityRepository.save(liquidity);

      return successResponse({
        status: true,
        message: 'Liquidity creation successful',
        data: liquidity,
      });
    } catch (error) {
      this.logger.error('Liquidity creation failed', error);

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'Error recording liquidity',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async getAll(user: User): Promise<IResponse | ServiceError> {
    try {
      const liquidities = await this.liquidityRepository.find({
        where: {
          user_id: user.id,
        },
      });

      return successResponse({
        status: true,
        message: 'Liquidities fetched',
        data: liquidities,
      });
    } catch (error) {
      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'Error getting all liquidities',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }

  async getOne(user: User, id: string): Promise<IResponse | ServiceError> {
    try {
      const liquidity = await this.liquidityRepository.findOne({
        where: {
          id,
          user_id: user.id,
        },
      });

      if (!liquidity) {
        throw new ServiceError('Liquidity not found', HttpStatus.NOT_FOUND);
      }

      return successResponse({
        status: true,
        message: 'Liquidity fetched',
        data: liquidity,
      });
    } catch (error) {
      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'Error getting liquidity',
        HttpStatus.INTERNAL_SERVER_ERROR,
      ).toErrorResponse();
    }
  }
}
