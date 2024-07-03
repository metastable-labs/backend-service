import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { ServiceError } from '../errors/service.error';
import { PrivyService } from '../helpers/privy/privy.service';

@Injectable()
export class PrivyGuard implements CanActivate {
  constructor(private readonly privyService: PrivyService) {}
  async canActivate(context: ExecutionContext): Promise<boolean | any> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new ServiceError(
        'Unauthorized',
        HttpStatus.UNAUTHORIZED,
      ).toErrorResponse();
    }

    try {
      const verifiedClaims =
        await this.privyService.clinet.verifyAuthToken(token);

      console.log(verifiedClaims);

      request.body = {
        ...request.body,
        userId: verifiedClaims.userId,
      };

      return true;
    } catch (error) {
      console.log(error);
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
