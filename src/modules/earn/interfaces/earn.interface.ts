import { ActivitySlug, ActivityType } from '../enums/earn.enum';

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
  walletAddress: string;
  activityId: string;
  activityType: ActivityType;
  points: number;
  description: string;
}

export interface RecordActivityPoint {
  userId: string;
  walletId: string;
  walletAddress: string;
  activitySlug: ActivitySlug;
  points?: number;
}
