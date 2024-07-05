import { Injectable } from '@nestjs/common';
import Launchbox from 'channels-lib';

import { Channel } from 'channels-libz';
import { env } from '../../config/env';

@Injectable()
export class FarcasterService {
  private readonly launchbox: Launchbox;

  constructor() {
    const currentEnv = env.airstack.env as 'prod' | 'dev';
    this.launchbox = new Launchbox(env.airstack.key, currentEnv);
  }

  async getChannelsByAddress(address: string): Promise<Channel[]> {
    try {
      const channels = await this.launchbox.getChannelsByUserAddress(
        address as `0x${string}`,
      );

      return channels
    } catch (error) {
      return [];
    }
  }

  async getChannelCasts(channelName: string) {
    try {
      return await this.launchbox.getChannelCasts(channelName)
    } catch (error) {
      return [];
    }
  }
}
