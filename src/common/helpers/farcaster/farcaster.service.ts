import { Injectable, Logger } from '@nestjs/common';
import Launchbox, { Channel } from 'channels-lib';
import { getDateRangeFromKey, getDates, getPeriod } from 'src/common/utils';
import { env } from '../../config/env';
import { Period } from '../analytic/enums/analytic.enum';
import { PeriodKey, PeriodType } from '../analytic/interfaces/analytic.interface';
import { ChannelAnalytics, ChannelDataPoint } from './interfaces/farcaster.interface';

@Injectable()
export class FarcasterService {
  private readonly launchbox: Launchbox;
  private readonly defaultLimit = 200;

  constructor() {
    const currentEnv = env.airstack.env as 'prod' | 'dev';
    this.launchbox = new Launchbox(env.airstack.key, currentEnv);
  }

  private readonly logger = new Logger(FarcasterService.name);

  async getChannelsByAddress(
    address: string,
    limit: number,
  ): Promise<Channel[]> {
    try {
      const channels = await this.launchbox.getChannelsByUserAddress(
        address as `0x${string}`,
        limit,
      );

      return channels as Channel[];
    } catch (error) {
      return [];
    }
  }

  async getChannelCasts(channelName: string, limit: number) {
    try {
      return await this.launchbox.getChannelCasts(channelName, limit);
    } catch (error) {
      return [];
    }
  }

  async getNumberOfWeeklyCasts(channelName: string): Promise<{
    castsCount: number;
    percentageChange: number;
    isIncreased: boolean;
  }> {
    try {
      const currentDate = new Date();
      const sevenDaysAgo = this.subtractDays(currentDate, 7);
      const fourteenDaysAgo = this.subtractDays(currentDate, 14);

      const [recentCasts, previousCasts] = await Promise.all([
        this.launchbox.getChannelCasts(
          channelName,
          this.defaultLimit,
          sevenDaysAgo,
          currentDate,
        ),
        this.launchbox.getChannelCasts(
          channelName,
          this.defaultLimit,
          fourteenDaysAgo,
          sevenDaysAgo,
        ),
      ]);

      const recentCount = recentCasts.length;
      const previousCount = previousCasts.length;

      const { percentageChange, isIncreased } = this.calculatePercentageChange(
        previousCount,
        recentCount,
      );

      return {
        castsCount: recentCount,
        percentageChange,
        isIncreased,
      };
    } catch (error) {
      this.logger.error('Error in getNumberOfWeeklyCasts:', error.stack);

      return {
        castsCount: 0,
        percentageChange: 0,
        isIncreased: false,
      };
    }
  }

  async getSocialCapitalNumber(channelName: string, tokenAddress: string) {
    try {
      return await this.launchbox.getChannelSocialCapital(
        channelName,
        tokenAddress as `0x${string}`,
      );
    } catch (error) {
      return 0;
    }
  }

  async getChannelAnalytics(
    channelName: string,
    period: Period,
    startDate: Date,
    endDate: Date,
  ) {
    const dates = getDates(period as PeriodType, startDate, endDate);

    const dataPointPromises = dates.map(async (date) => {
      const nextDate = this.getNextDate(date.toDate(), period as PeriodType);

      const casts = await this.launchbox.getChannelCasts(
        channelName,
        this.defaultLimit,
        date.toDate(),
        nextDate,
      );

      return {
        date: date.toDate(),
        castsCount: casts.length,
      };
    });

    const dataPoints: ChannelDataPoint[] = await Promise.all(dataPointPromises);
    const startPoint = dataPoints[0]?.castsCount ?? 0;
    const endPoint = dataPoints[dataPoints.length - 1]?.castsCount ?? 0;
    const { percentageChange, isIncreased } = this.calculatePercentageChange(
      startPoint,
      endPoint,
    );

    const result: ChannelAnalytics = {
      percentageChange,
      isIncreased,
      dataPoints: dataPoints,
    };

    return result;
  }

  async getChannelAnalyticsByKey(channelUrl: string, periodKey: PeriodKey) {
    const { startDate, endDate } = getDateRangeFromKey(periodKey);

    const period = getPeriod(periodKey);

    return this.getChannelAnalytics(channelUrl, period, startDate, endDate);
  }

  getNextDate(date: Date, period: PeriodType): Date {
    const nextDate = new Date(date);
    switch (period) {
      case 'hours':
        nextDate.setHours(date.getHours() + 1);
        break;
      case 'days':
        nextDate.setDate(date.getDate() + 1);
        break;
      case 'weeks':
        nextDate.setDate(date.getDate() + 7);
        break;
      case 'months':
        nextDate.setMonth(date.getMonth() + 1);
        break;
      default:
        throw new Error(`Unsupported period: ${period}`);
    }
    return nextDate;
  }

  private subtractDays(date: Date, days: number): Date {
    return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
  }

  private calculatePercentageChange(
    oldValue: number,
    newValue: number,
  ): { percentageChange: number; isIncreased: boolean } {
    if (oldValue === 0) {
      return {
        percentageChange: newValue > 0 ? 100 : 0,
        isIncreased: newValue > 0,
      };
    }

    const percentageChange = ((newValue - oldValue) / oldValue) * 100;
    return {
      percentageChange: Number(Math.abs(percentageChange).toFixed(2)),
      isIncreased: percentageChange >= 0,
    };
  }
}
