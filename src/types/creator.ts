export interface TrackedCreator {
  id: string;
  userId: string;
  channelId: string;
  channelTitle: string;
  thumbnail?: string;
  subscriberCount?: number;
  videoCount?: number;
  description?: string;
  customUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatorVideo {
  id: string;
  creatorId: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  duration: string;
  outlierScore: number;
  hookType: string;
  estimatedStructure: string;
}

export interface CreatorList {
  id: string;
  userId: string;
  name: string;
  description?: string;
  creatorIds: string[];
  createdAt: string;
  updatedAt: string;
}
