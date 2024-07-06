export interface Channel {
  createdAtTimestamp: string;
  channelId: string;
  name: string;
  description: string;
  imageUrl: string;
  leadIds: string[];
  url: string;
  dappName: string;
  followerCount: number;
}

export interface ChannelDataPoint {
  date: Date;
  castsCount: number;
}

export interface ChannelAnalytics {
  percentageChange: number;
  isIncreased: boolean;
  dataPoints: ChannelDataPoint[];
}
