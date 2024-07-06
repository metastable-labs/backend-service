export type PeriodType = 'hours' | 'days' | 'weeks' | 'months';

export interface PriceDataPoint {
  date: string;
  timestamp: number;
  price: string;
}

export interface PriceAnalytics {
  averagePrice: string;
  minPrice: string;
  maxPrice: string;
  priceAtStart: string;
  priceAtEnd: string;
  percentageChange: string;
  isIncreased: boolean;
  dataPoints: PriceDataPoint[];
}

export interface CacheEntry {
  data: PriceAnalytics;
  expiry: number;
}

export type PeriodKey = '1h' | '24h' | '1w' | '1m';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}
