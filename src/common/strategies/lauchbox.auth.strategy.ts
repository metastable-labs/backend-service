import { HttpStatus, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { env } from '../config/env';
import { LaunchboxUser } from '../../modules/launchbox/entities/launchbox.entity';
import { ServiceError } from '../errors/service.error';

@Injectable()
export class LaunchboxAuthStrategy extends PassportStrategy(
  Strategy,
  'launchbox-auth',
) {
  constructor(
    @InjectRepository(LaunchboxUser)
    private readonly launchboxUserRepository: Repository<LaunchboxUser>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.jwt.secret,
    });
  }

  async validate(payload: { sub: string }): Promise<LaunchboxUser> {
    const user = await this.launchboxUserRepository.findOne({
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
