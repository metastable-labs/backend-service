import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ServiceError } from '../errors/service.error';
import { env } from '../config/env';
import { LaunchboxUser } from '../../modules/launchbox/entities/launchbox.entity';

@Injectable()
export class LaunchboxAuthGuard implements CanActivate {
  constructor(
    @InjectRepository(LaunchboxUser)
    private readonly launchboxUserRepository: Repository<LaunchboxUser>,
    private jwtService: JwtService,
  ) {}

  private readonly logger = new Logger(LaunchboxAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean | any> {
    const request = context.switchToHttp().getRequest();

    try {
      const token = this.extractTokenFromHeader(request);

      if (!token) {
        throw new ServiceError('Unauthorized', HttpStatus.UNAUTHORIZED);
      }

      const payload: {
        sub: string;
        iat: string;
        exp: string;
      } = await this.jwtService.verifyAsync(token, {
        secret: env.jwt.secret,
      });

      const user = await this.launchboxUserRepository.findOne({
        where: {
          id: payload.sub,
        },
      });

      if (!user) {
        throw new ServiceError('Unauthorized', HttpStatus.UNAUTHORIZED);
      }

      request.user = user;

      return true;
    } catch (error) {
      this.logger.error(`[AuthGuard]: An error occurred`, error.stack);

      if (error instanceof ServiceError) {
        return error.toErrorResponse();
      }

      throw new ServiceError(
        'Unauthorized',
        HttpStatus.UNAUTHORIZED,
      ).toErrorResponse();
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
