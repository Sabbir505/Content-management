import { rateLimiter } from "@/lib/rate-limiter";
import type { ContentItem, ContentSearchResult } from "@/types/content";
import { proxyFetch } from "../proxy";

interface DevToArticle {
  id: number;
  title: string;
  url: string;
  user: {
    name: string;
    username: string;
  };
  published_at: string;
  published_timestamp: string;
  positive_reactions_count: number;
  comments_count: number;
  cover_image?: string;
  description?: string;
  tags?: string[];
  reading_time_minutes?: number;
}

export async function fetchDevToArticles(tag: string = "ai", limit = 20): Promise<ContentSearchResult> {
  return rateLimiter.executeWithRetry("devto", async () => {
    const response = await proxyFetch(
      `https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&per_page=${limit}&top=7`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`DEV.to API error: ${response.status}`);
    }

    const articles: DevToArticle[] = await response.json();

    const items: ContentItem[] = articles.map((article) => ({
      id: `devto-${article.id}`,
      title: article.title,
      url: article.url,
      source: "devto" as const,
      author: article.user.name || article.user.username,
      authorUrl: `https://dev.to/${article.user.username}`,
      score: article.positive_reactions_count,
      commentCount: article.comments_count,
      publishedAt: article.published_at || article.published_timestamp,
      thumbnail: article.cover_image,
      description: article.description,
      tags: article.tags || [tag],
    }));

    return {
      items,
      source: "devto",
      fromCache: false,
      fetchedAt: new Date().toISOString(),
    };
  });
}

export async function searchDevToArticles(query: string, limit = 20): Promise<ContentSearchResult> {
  return rateLimiter.executeWithRetry("devto", async () => {
    // Strategy 1: Try tag-based search first (more reliable)
    const tagResponse = await proxyFetch(
      `https://dev.to/api/articles?tag=${encodeURIComponent(query.toLowerCase())}&per_page=${limit}&top=7`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    let articles: DevToArticle[] = [];

    if (tagResponse.ok) {
      articles = await tagResponse.json();
    }

    // Strategy 2: If no results from tag, fetch top articles and filter client-side
    if (articles.length === 0) {
      console.log(`[DEV.to] No tag results for "${query}", falling back to top articles`);
      const fallbackResponse = await proxyFetch(
        `https://dev.to/api/articles?per_page=${limit * 2}&top=7`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (fallbackResponse.ok) {
        const allArticles: DevToArticle[] = await fallbackResponse.json();
        const queryLower = query.toLowerCase();
        articles = allArticles.filter(
          (article) => {
            const titleMatch = article.title.toLowerCase().includes(queryLower);
            const descMatch = article.description && article.description.toLowerCase().includes(queryLower);
            // tags can be a string or array from the API, handle both
            let tagMatch = false;
            if (article.tags) {
              const tags = article.tags as unknown;
              if (Array.isArray(tags)) {
                tagMatch = (tags as string[]).some((tag) => tag.toLowerCase().includes(queryLower));
              } else if (typeof tags === "string") {
                tagMatch = (tags as string).toLowerCase().includes(queryLower);
              }
            }
            return titleMatch || descMatch || tagMatch;
          }
        );
      }
    }

    const items: ContentItem[] = articles.map((article) => ({
      id: `devto-${article.id}`,
      title: article.title,
      url: article.url,
      source: "devto" as const,
      author: article.user.name || article.user.username,
      authorUrl: `https://dev.to/${article.user.username}`,
      score: article.positive_reactions_count,
      commentCount: article.comments_count,
      publishedAt: article.published_at || article.published_timestamp,
      thumbnail: article.cover_image,
      description: article.description,
      tags: Array.isArray(article.tags) ? article.tags : article.tags ? [article.tags] : [query],
    }));

    return {
      items,
      source: "devto",
      fromCache: false,
      fetchedAt: new Date().toISOString(),
    };
  });
}
