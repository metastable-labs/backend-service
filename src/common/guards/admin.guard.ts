import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { ServiceError } from '../errors/service.error';
import { env } from '../config/env';

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean | any> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    try {
      if (!token) {
        throw new ServiceError(
          'Unauthorized',
          HttpStatus.UNAUTHORIZED,
        ).toErrorResponse();
      }

      const adminKey = env.admin.key;

      if (token !== adminKey) {
        throw new ServiceError(
          'Unauthorized',
          HttpStatus.UNAUTHORIZED,
        ).toErrorResponse();
      }

      return true;
    } catch (error) {
      this.logger.error(
        '[AuthGuard]: An error occurred while validating admin key',
        error.stack,
      );

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
