"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { ContentItem } from "@/types/content";
import { useRouter } from "next/navigation";
import Image from "next/image";
import React from "react";

interface ContentCardProps {
  item: ContentItem;
  onSave?: (item: ContentItem) => void;
}

interface ArticleContent {
  title: string;
  content: string;
  url: string;
  author?: string;
  publishedAt?: string;
  images: string[];
  error?: string;
}

export const ContentCard = React.memo(function ContentCard({ item, onSave }: ContentCardProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [articleContent, setArticleContent] = useState<ArticleContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (isModalOpen && !articleContent) {
      fetchArticleContent();
    }
  }, [isModalOpen]);

  async function fetchArticleContent() {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/content/article?url=${encodeURIComponent(item.url)}`);
      const result = await response.json();
      if (result.success) {
        setArticleContent(result.data);
      } else {
        setArticleContent({
          title: item.title,
          content: "",
          url: item.url,
          images: [],
          error: result.error || "Failed to fetch article",
        });
      }
    } catch {
      setArticleContent({
        title: item.title,
        content: "",
        url: item.url,
        images: [],
        error: "Failed to fetch article",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function formatScore(score: number): string {
    if (score >= 1000) {
      return `${(score / 1000).toFixed(1)}K`;
    }
    return score.toString();
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function getSourceIcon(source: string): string {
    switch (source) {
      case "hackernews":
        return "🟠";
      case "reddit":
        return "🔴";
      case "devto":
        return "🟣";
      case "googlenews":
        return "🔵";
      default:
        return "📄";
    }
  }

  function getSourceLabel(source: string): string {
    switch (source) {
      case "hackernews":
        return "Hacker News";
      case "reddit":
        return "Reddit";
      case "devto":
        return "DEV.to";
      case "googlenews":
        return "Google News";
      default:
        return source;
    }
  }

  function getPlaceholderGradient(source: string): string {
    switch (source) {
      case "hackernews":
        return "from-orange-50 to-orange-100";
      case "reddit":
        return "from-red-50 to-red-100";
      case "devto":
        return "from-gray-50 to-gray-100";
      case "googlenews":
        return "from-blue-50 to-blue-100";
      default:
        return "from-gray-50 to-gray-100";
    }
  }

  return (
    <>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setIsModalOpen(true)}>
        <div className="relative">
          {item.thumbnail ? (
            <div className="w-full h-48 bg-gray-50 flex items-center justify-center p-4 overflow-hidden relative">
              {imageError ? (
                <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${getPlaceholderGradient(item.source)}`}>
                  <span className="text-4xl">{getSourceIcon(item.source)}</span>
                </div>
              ) : (
                <Image
                  src={item.thumbnail}
                  alt={item.title}
                  fill
                  className="object-contain p-4"
                  unoptimized
                  onError={() => setImageError(true)}
                />
              )}
            </div>
          ) : (
            <div className={`w-full h-48 bg-gradient-to-br ${getPlaceholderGradient(item.source)} flex items-center justify-center`}>
              <span className="text-4xl">{getSourceIcon(item.source)}</span>
            </div>
          )}
          <Badge className="absolute top-2 right-2 bg-black/70 text-white text-xs">
            {getSourceLabel(item.source)}
          </Badge>
          {item.discoveryScore !== undefined && item.discoveryScore > 0 && (
            <Badge className="absolute bottom-2 right-2 bg-blue-600/90 text-white text-xs">
              {item.discoveryScore.toFixed(0)} discovery
            </Badge>
          )}
        </div>

        <CardContent className="p-4">
          <h3 className="font-semibold mb-2 line-clamp-2">{item.title}</h3>
          <p className="text-sm text-gray-600 mb-1">{item.author}</p>
          <p className="text-xs text-gray-500 mb-3">{formatDate(item.publishedAt)}</p>

          <div className="flex flex-wrap gap-2">
            {item.score > 0 && (
              <Badge variant="outline" className="text-xs">
                {formatScore(item.score)} upvotes
              </Badge>
            )}
            {item.commentCount !== undefined && item.commentCount > 0 && (
              <Badge variant="outline" className="text-xs">
                {item.commentCount} comments
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content Detail Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-[868px] max-w-[95vw] max-h-[90vh] overflow-y-auto scrollbar-hide">
          <DialogHeader>
            <DialogTitle className="text-xl">{item.title}</DialogTitle>
            <DialogDescription>
              {item.author} · {formatDate(item.publishedAt)} · {getSourceLabel(item.source)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
              </div>
            )}

            {/* Error State */}
            {articleContent?.error && (
              <div className="rounded-lg bg-red-50 p-4 text-red-700 text-sm">
                {articleContent.error}
              </div>
            )}

            {/* Article Content */}
            {!isLoading && articleContent && (
              <>
                {/* Thumbnail */}
                {item.thumbnail && (
                  <div className="relative w-full h-64">
                    <Image
                      src={item.thumbnail}
                      alt={item.title}
                      fill
                      className="object-contain rounded-lg bg-gray-50"
                      unoptimized
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold">{formatScore(item.score)}</p>
                    <p className="text-xs text-gray-600">Upvotes/Score</p>
                  </div>
                  {item.commentCount !== undefined && (
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold">{item.commentCount}</p>
                      <p className="text-xs text-gray-600">Comments</p>
                    </div>
                  )}
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold">{getSourceLabel(item.source)}</p>
                    <p className="text-xs text-gray-600">Source</p>
                  </div>
                </div>

                {/* Article Content */}
                {articleContent.content && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">Article Content</h4>
                    <div className="text-sm text-gray-600 whitespace-pre-wrap max-h-96 overflow-y-auto p-4 bg-gray-50 rounded-lg">
                      {articleContent.content}
                    </div>
                    {/* Show Open Article button for Google News */}
                    {item.source === "googlenews" && (
                      <Button
                        variant="outline"
                        className="w-full mt-2"
                        onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")}
                      >
                        Open Article on Google News
                      </Button>
                    )}
                  </div>
                )}

                {/* Tags */}
                {item.tags && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {Array.isArray(item.tags) ? (
                        item.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          {item.tags}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons - Same as VideoCard */}
                <div className="flex flex-wrap gap-3 pt-4 border-t">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      setIsModalOpen(false);
                      router.push(`/create/script?contentId=${item.id}&title=${encodeURIComponent(item.title)}&description=${encodeURIComponent(articleContent.content || item.description || "")}`);
                    }}
                  >
                    Generate Script
                  </Button>
                  <Button
                    className="flex-1"
                    variant="outline"
                    onClick={() => {
                      setIsModalOpen(false);
                      router.push(`/create/social?contentId=${item.id}&title=${encodeURIComponent(item.title)}&description=${encodeURIComponent(articleContent.content || item.description || "")}`);
                    }}
                  >
                    Social Posts
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsModalOpen(false);
                      router.push(`/analyze?contentId=${item.id}`);
                    }}
                  >
                    Analyze Structure
                  </Button>
                  {onSave && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        onSave(item);
                        setIsModalOpen(false);
                      }}
                    >
                      Save to Board
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});
