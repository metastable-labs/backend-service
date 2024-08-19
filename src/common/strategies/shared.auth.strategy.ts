import { HttpStatus, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { env } from '../config/env';
import { ServiceError } from '../errors/service.error';
import { User } from '../../modules/shared/entities/user.entity';
import { Wallet } from '../../modules/shared/entities/wallet.entity';

@Injectable()
export class SharedAuthStrategy extends PassportStrategy(
  Strategy,
  'shared-auth',
) {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.jwt.secret,
    });
  }

  async validate(payload: { sub: string }): Promise<User> {
    try {
      const user = await this.userRepository.findOne({
        where: {
          id: payload.sub,
        },
      });

      if (!user) {
        throw new ServiceError('Unauthorized', HttpStatus.UNAUTHORIZED);
      }

      const wallet = await this.walletRepository.findOne({
        where: {
          user_id: user.id,
        },
      });

      if (!wallet) {
        throw new ServiceError('Unauthorized', HttpStatus.UNAUTHORIZED);
      }

      return {
        ...user,
        _id: undefined,
        reference: undefined,
        metadata: undefined,
        github_auth: undefined,
        wallet: {
          ...wallet,
          _id: undefined,
        },
      };
    } catch (error) {
      throw new ServiceError(
        'Unauthorized',
        HttpStatus.UNAUTHORIZED,
      ).toErrorResponse();
    }
  }
}
