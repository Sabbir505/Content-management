"use client";

import { RefObject } from "react";
import { VideoWithOutlier } from "@/types/video";
import { ContentItem } from "@/types/content";
import { VideoCard } from "@/components/discover/VideoCard";
import { ContentCard } from "@/components/discover/ContentCard";

interface ChatItem {
  item: VideoWithOutlier | ContentItem;
  type: "video" | "article";
  initialPrompt?: string;
}

type MixedItem = (VideoWithOutlier & { contentType: "video" }) | (ContentItem & { contentType: "article" });

interface DiscoverContentGridProps {
  videos?: VideoWithOutlier[];
  articles?: ContentItem[];
  mixed?: MixedItem[];
  displayCount: number;
  loadMoreRef: RefObject<HTMLDivElement | null>;
  onVideoSave: (video: VideoWithOutlier) => void;
  onContentSave: (item: ContentItem) => void;
  onChatOpen: (chatItem: ChatItem) => void;
}

export function DiscoverContentGrid({
  videos,
  articles,
  mixed,
  displayCount,
  loadMoreRef,
  onVideoSave,
  onContentSave,
  onChatOpen,
}: DiscoverContentGridProps) {
  if (mixed) {
    return (
      <>
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
          {mixed.slice(0, displayCount).map((item) => (
            <div key={item.id} className="break-inside-avoid mb-4">
              {item.contentType === "video" ? (
                <VideoCard
                  video={item}
                  onSave={onVideoSave}
                  onChatOpen={(video, prompt) => onChatOpen({ item: video, type: "video", initialPrompt: prompt })}
                />
              ) : (
                <ContentCard
                  item={item}
                  onSave={onContentSave}
                  onChatOpen={(contentItem, prompt) => onChatOpen({ item: contentItem, type: "article", initialPrompt: prompt })}
                />
              )}
            </div>
          ))}
        </div>
        {displayCount < mixed.length && (
          <div ref={loadMoreRef} className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white/40" />
          </div>
        )}
      </>
    );
  }

  if (videos) {
    return (
      <>
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
          {videos.slice(0, displayCount).map((video) => (
            <div key={video.id} className="break-inside-avoid mb-4">
              <VideoCard
                video={video}
                onSave={onVideoSave}
                onChatOpen={(v, prompt) => onChatOpen({ item: v, type: "video", initialPrompt: prompt })}
              />
            </div>
          ))}
        </div>
        {displayCount < videos.length && (
          <div ref={loadMoreRef} className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white/40" />
          </div>
        )}
      </>
    );
  }

  if (articles) {
    return (
      <>
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
          {articles.slice(0, displayCount).map((item) => (
            <div key={item.id} className="break-inside-avoid mb-4">
              <ContentCard
                item={item}
                onSave={onContentSave}
                onChatOpen={(contentItem, prompt) => onChatOpen({ item: contentItem, type: "article", initialPrompt: prompt })}
              />
            </div>
          ))}
        </div>
        {displayCount < articles.length && (
          <div ref={loadMoreRef} className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white/40" />
          </div>
        )}
      </>
    );
  }

  return null;
}
