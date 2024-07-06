import { Injectable } from '@nestjs/common';
import { PrivyClient } from '@privy-io/server-auth';
import { env } from '../../config/env';

@Injectable()
export class PrivyService {
  public readonly clinet: PrivyClient;
  constructor() {
    this.clinet = new PrivyClient(env.privy.appId, env.privy.appSecret);
  }
}
