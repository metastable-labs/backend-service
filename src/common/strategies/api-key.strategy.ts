import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import Strategy from 'passport-headerapikey';
import { LaunchboxService } from '../../modules/launchbox/launchbox.service';
import { LaunchboxAuthRequest } from '../interfaces/request.interface';

type verify = (err: any, data: any, info: any) => void;

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(private readonly launchboxService: LaunchboxService) {
    super(
      { header: 'x-api-key' },
      true,
      async (apiKey: string, done: verify, req: LaunchboxAuthRequest) => {
        return this.validate(apiKey, done, req);
      },
    );
  }

  async validate(
    key: string,
    done: verify,
    req: LaunchboxAuthRequest,
  ): Promise<any> {
    if (req.user) {
      return done(null, req.user, null);
    }

    try {
      if (!key) {
        return done(
          new UnauthorizedException(
            'Unsupported request, Please read our API documentation',
          ),
          false,
          null,
        );
      }

      const apiCredential = await this.launchboxService.validateApiKey(key);
      if (!apiCredential) {
        return done(new UnauthorizedException('Unauthorized'), false, null);
      }

      return done(null, { apiCredential, externalApiCall: true }, null);
    } catch (err) {
      return done(err, false, null);
    }
  }
}
