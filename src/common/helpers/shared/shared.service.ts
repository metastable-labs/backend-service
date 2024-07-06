import { Injectable, Logger } from '@nestjs/common';
import { chromium } from 'playwright';
import { env } from '../../config/env';

@Injectable()
export class SharedService {
  private readonly cache: { ethPrice: number; timestamp: number } = {
    ethPrice: 0,
    timestamp: 0,
  };

  private readonly Logger = new Logger(SharedService.name);

  async getEthPriceInUsd(): Promise<number> {
    const CACHE_DURATION = 5 * 60 * 1000; // Cache duration in milliseconds (5 minutes)
    const currentTime = Date.now();

    if (this.cache && currentTime - this.cache.timestamp < CACHE_DURATION) {
      return this.cache.ethPrice;
    }

    const ethPrice = await this.fetchEthPrice();
    this.cache.ethPrice = ethPrice;
    this.cache.timestamp = currentTime;

    return ethPrice;
  }

  private async fetchEthPrice(): Promise<number> {
    try {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(env.blockchainPrice.url, {
        waitUntil: 'domcontentloaded',
      });

      const ethPrice = await page.$eval('.sc-bb87d037-10', (el) =>
        el.textContent ? el.textContent.trim() : '',
      );
      const ethPriceInNumber = parseFloat(ethPrice.replace(/[^0-9.-]+/g, ''));

      await browser.close();

      return ethPriceInNumber;
    } catch (error) {
      this.Logger.error(
        `SharedService.getEthPriceInUsd: Error while fetching ETH price`,
        error,
      );

      return 0;
    }
  }
}
