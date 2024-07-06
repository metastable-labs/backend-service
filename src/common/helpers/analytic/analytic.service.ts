import { ethers, utils } from 'ethers';
import * as EthDater from 'ethereum-block-by-date';
import { Injectable, Logger } from '@nestjs/common';
import {
  CacheEntry,
  PeriodKey,
  PeriodType,
  PriceAnalytics,
  PriceDataPoint,
} from './interfaces/analytic.interface';
import { ContractService } from '../contract/contract.service';
import { Period } from './enums/analytic.enum';
import { getDateRangeFromKey, getPeriod } from '../../utils';

@Injectable()
export class AnalyticService {
  private cache: Map<string, CacheEntry> = new Map();
  private cacheDuration = 5 * 60 * 1000; // 5m Cache duration in milliseconds

  constructor(private readonly contractService: ContractService) {}

  private readonly logger = new Logger(AnalyticService.name);

  private getProvider(): ethers.providers.Provider {
    return this.contractService.getProvider();
  }

  private roundToNearest(date: Date, interval: number): Date {
    return new Date(Math.floor(date.getTime() / interval) * interval);
  }

  private getCacheKey(
    contractAddress: string,
    period: Period,
    startDate: Date,
    endDate: Date,
  ): string {
    const roundedStart = this.roundToNearest(startDate, 5 * 60 * 1000);
    const roundedEnd = this.roundToNearest(endDate, 5 * 60 * 1000);

    return `${contractAddress}-${period}-${roundedStart.getTime()}-${roundedEnd.getTime()}`;
  }

  private setCacheEntry(key: string, data: PriceAnalytics): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.cacheDuration,
    });
  }

  private getCacheEntry(key: string): PriceAnalytics | null {
    const entry = this.cache.get(key);
    if (entry && entry.expiry > Date.now()) {
      return entry.data;
    }
    if (entry) {
      this.cache.delete(key);
    }
    return null;
  }

  async getPriceAnalytics(
    contractAddress: string,
    period: Period,
    startDate: Date,
    endDate: Date,
  ): Promise<PriceAnalytics> {
    const cacheKey = this.getCacheKey(
      contractAddress,
      period,
      startDate,
      endDate,
    );
    const cachedResult = this.getCacheEntry(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const provider = this.getProvider();
    const dater = new EthDater(provider);

    const blocks = await dater.getEvery(
      period as PeriodType,
      startDate,
      endDate,
    );

    const ABI = [
      'function getTokenPriceinETH() external view returns (uint256 ethAmount)',
    ];

    const contract = new ethers.Contract(
      contractAddress,
      ABI,
      this.getProvider(),
    );

    let totalPrice = ethers.BigNumber.from(0);
    let minPrice = ethers.constants.MaxUint256;
    let maxPrice = ethers.BigNumber.from(0);
    const dataPoints: PriceDataPoint[] = [];

    for (const blockItem of blocks) {
      try {
        const tokenEthPrice = await contract.getTokenPriceinETH({
          blockTag: blockItem.block,
        });

        totalPrice = totalPrice.add(tokenEthPrice);
        minPrice = tokenEthPrice.lt(minPrice) ? tokenEthPrice : minPrice;
        maxPrice = tokenEthPrice.gt(maxPrice) ? tokenEthPrice : maxPrice;

        dataPoints.push({
          date: blockItem.date,
          timestamp: blockItem.timestamp,
          price: utils.formatEther(tokenEthPrice),
        });
      } catch (error) {
        this.logger.error(
          `Error fetching price at block ${blockItem.block}:`,
          error.stack,
        );
      }
    }

    const firstPrice = ethers.BigNumber.from(
      utils.parseEther(dataPoints[0]?.price),
    );
    const lastPrice = ethers.BigNumber.from(
      utils.parseEther(dataPoints[dataPoints.length - 1]?.price),
    );

    const averagePrice = totalPrice.div(dataPoints.length);
    const startPrice = firstPrice || ethers.BigNumber.from(0);
    const endPrice = lastPrice || ethers.BigNumber.from(0);

    let percentageChange = '0';
    let isIncreased = false;

    if (!startPrice.isZero()) {
      const change = endPrice.sub(startPrice);
      const changePercentage = change.mul(10000).div(startPrice);
      percentageChange = (Math.abs(changePercentage.toNumber()) / 100).toFixed(
        2,
      );
      isIncreased = change.gte(0);
    }

    const result: PriceAnalytics = {
      averagePrice: utils.formatEther(averagePrice),
      minPrice: utils.formatEther(minPrice),
      maxPrice: utils.formatEther(maxPrice),
      priceAtStart: utils.formatEther(startPrice),
      priceAtEnd: utils.formatEther(endPrice),
      percentageChange,
      isIncreased,
      dataPoints,
    };

    this.setCacheEntry(cacheKey, result);
    return result;
  }

  async getPriceAnalyticsByKey(
    contractAddress: string,
    periodKey: PeriodKey,
  ): Promise<PriceAnalytics> {
    const { startDate, endDate } = getDateRangeFromKey(periodKey);

    const period = getPeriod(periodKey);

    return this.getPriceAnalytics(contractAddress, period, startDate, endDate);
  }
}
