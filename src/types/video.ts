export interface YouTubeVideo {
  id: string;
  title: string;
  channelTitle: string;
  channelId: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  thumbnail: string;
  publishedAt: string;
  duration: string;
  description: string;
  tags: string[];
  subscriberCount?: number;
}

export interface VideoWithOutlier extends YouTubeVideo {
  channelAvgViews: number;
  outlierScore: number;
  hookType: string;
  estimatedStructure: string;
  discoveryScore?: number;
  velocityTrend?: number; // views per hour change since last fetch
  nicheBaseline?: number; // average views for this niche
  subscriberWeightedOutlier?: number; // outlier adjusted for subscriber count
  transcript?: string;
}

export interface TrendingFilter {
  niche: string;
  timeRange: "day" | "week" | "month" | "year";
  minViews: number;
  maxViews: number;
  minOutlier: number;
  maxDuration: number;
  minSubs: number;
  maxSubs: number;
  sortBy: "views" | "outlier" | "recent" | "comments";
  language: "any" | "en";
}
