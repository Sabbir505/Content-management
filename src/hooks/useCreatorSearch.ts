"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { User } from "firebase/auth";
import { autoAddToAllFollowing } from "@/hooks/useLocalCreators";

export interface CreatorSearchResult {
  channelId: string;
  title: string;
  description: string;
  thumbnail: string;
  subscriberCount?: number;
  videoCount?: number;
  customUrl?: string;
}

interface UseCreatorSearchArgs {
  user: User | null | undefined;
  addCreator: (creator: {
    userId: string;
    channelId: string;
    channelTitle: string;
    thumbnail: string;
    subscriberCount: number;
    videoCount: number;
    description: string;
    customUrl: string;
  }) => void;
}

interface UseCreatorSearchResult {
  creatorUrl: string;
  setCreatorUrl: React.Dispatch<React.SetStateAction<string>>;
  isTrackingCreator: boolean;
  creatorSearchQuery: string;
  setCreatorSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  creatorSearchResults: CreatorSearchResult[];
  isSearchingCreators: boolean;
  handleSearchCreators: () => Promise<void>;
  handleTrackCreator: () => Promise<void>;
}

export function useCreatorSearch({ user, addCreator }: UseCreatorSearchArgs): UseCreatorSearchResult {
  const [creatorUrl, setCreatorUrl] = useState("");
  const [isTrackingCreator, setIsTrackingCreator] = useState(false);
  const [creatorSearchQuery, setCreatorSearchQuery] = useState("");
  const [creatorSearchResults, setCreatorSearchResults] = useState<CreatorSearchResult[]>([]);
  const [isSearchingCreators, setIsSearchingCreators] = useState(false);

  const handleSearchCreators = useCallback(async () => {
    if (!creatorSearchQuery.trim()) return;
    setIsSearchingCreators(true);
    try {
      const response = await fetch(
        `/api/youtube/channel-search?query=${encodeURIComponent(creatorSearchQuery.trim())}`
      );
      const result = await response.json();
      if (result.success) {
        setCreatorSearchResults(result.data);
      } else {
        toast.error(result.error || "Search failed");
      }
    } catch {
      toast.error("Search failed");
    } finally {
      setIsSearchingCreators(false);
    }
  }, [creatorSearchQuery]);

  const handleTrackCreator = useCallback(async () => {
    if (!user || !creatorUrl.trim()) return;
    setIsTrackingCreator(true);
    try {
      const searchResponse = await fetch(
        `/api/youtube/channel-search?query=${encodeURIComponent(creatorUrl.trim())}`
      );
      const searchResult = await searchResponse.json();
      if (!searchResult.success || !searchResult.data || searchResult.data.length === 0) {
        toast.error("Could not find channel");
        return;
      }
      const channel = searchResult.data[0];

      addCreator({
        userId: user.uid,
        channelId: channel.channelId,
        channelTitle: channel.title,
        thumbnail: channel.thumbnail,
        subscriberCount: channel.subscriberCount || 0,
        videoCount: channel.videoCount || 0,
        description: channel.description || "",
        customUrl: channel.customUrl || "",
      });

      autoAddToAllFollowing(user.uid, channel.channelId);

      setCreatorUrl("");
      toast.success("Creator tracked!");
    } catch {
      toast.error("Failed to track creator");
    } finally {
      setIsTrackingCreator(false);
    }
  }, [user, creatorUrl, addCreator]);

  return {
    creatorUrl,
    setCreatorUrl,
    isTrackingCreator,
    creatorSearchQuery,
    setCreatorSearchQuery,
    creatorSearchResults,
    isSearchingCreators,
    handleSearchCreators,
    handleTrackCreator,
  };
}
