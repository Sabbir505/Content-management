export interface ContentItem {
  id: string;
  title: string;
  url: string;
  source: "hackernews" | "reddit" | "devto" | "googlenews";
  author: string;
  authorUrl?: string;
  score: number; // upvotes, likes, etc.
  commentCount?: number;
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
