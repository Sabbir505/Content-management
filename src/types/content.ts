export interface ContentItem {
  id: string;
  title: string;
  url: string;
  source: "hackernews" | "reddit" | "devto" | "x" | "substack" | "instagram" | "tiktok" | "linkedin";
  author: string;
  authorUrl?: string;
  score: number; // upvotes, likes, etc.
  commentCount?: number;
  shareCount?: number;
  likeCount?: number;
  outlierScore?: number;
  publishedAt: string;
  thumbnail?: string;
  description?: string;
  tags?: string[];
  discoveryScore?: number;
}

export interface ContentSearchResult {
  items: ContentItem[];
  source: string;
  fromCache: boolean;
  fetchedAt: string;
  error?: string;
}

export interface ContentSearchError {
  type: "api_error" | "rate_limited" | "unknown";
  message: string;
}
