export type PeriodType = 'hours' | 'days' | 'weeks' | 'months';

export interface PriceDataPoint {
  date: string;
  timestamp: number;
  price: string;
  priceInEth: string;
}

export interface PriceAnalytics {
  percentageChange: string;
  isIncreased: boolean;
  dataPoints: PriceDataPoint[];
}

export interface CacheEntry {
  data: PriceAnalytics | number;
  expiry: number;
}

export type PeriodKey = '1h' | '24h' | '1w' | '1m';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}
