import { ActivitySlug } from '../enums/earn.enum';

export interface Multiplier {
  id: string;
  slug: string;
  description: string;
  multiplier: number;
  is_active: boolean;
  activity_slug: ActivitySlug;
}

export interface RecordPoint {
  userId: string;
  walletId: string;
  activityId: string;
  points: number;
  availableBalancePoints: number;
  totalBalancePoints: number;
  description: string;
}
