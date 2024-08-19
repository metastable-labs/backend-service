import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import Strategy from 'passport-headerapikey';
import { LaunchboxService } from '../../modules/launchbox/launchbox.service';
import { SharedAuthRequest } from '../interfaces/request.interface';

type verify = (err: any, data: any, info: any) => void;

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(private readonly launchboxService: LaunchboxService) {
    super(
      { header: 'x-api-key' },
      true,
      async (apiKey: string, done: verify, req: SharedAuthRequest) => {
        return this.validate(apiKey, done, req);
      },
    );
  }

  async validate(
    key: string,
    done: verify,
    req: SharedAuthRequest,
  ): Promise<any> {
    try {
      if (req?.user) {
        return done(null, req.user, null);
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
