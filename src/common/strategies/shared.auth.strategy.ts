import { HttpStatus, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { env } from '../config/env';
import { ServiceError } from '../errors/service.error';
import { SharedUser } from '../../modules/shared/entities/user.entity';

@Injectable()
export class SharedAuthStrategy extends PassportStrategy(
  Strategy,
  'shared-auth',
) {
  constructor(
    @InjectRepository(SharedUser)
    private readonly sharedUserRepository: Repository<SharedUser>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.jwt.secret,
    });
  }

  async validate(payload: { sub: string }): Promise<SharedUser> {
    const user = await this.sharedUserRepository.findOne({
      where: {
        id: payload.sub,
      },
    });

    if (!user) {
      throw new ServiceError('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    return user;
  }
}