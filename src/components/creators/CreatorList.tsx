"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import type { TrackedCreator } from "@/types/creator";

interface CreatorListProps {
  onSelectCreator: (creator: TrackedCreator) => void;
  selectedCreatorId?: string;
}

export function CreatorList({ onSelectCreator, selectedCreatorId }: CreatorListProps) {
  const { user } = useAuth();
  const [creators, setCreators] = useState<TrackedCreator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [channelUrl, setChannelUrl] = useState("");
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    if (user) {
      loadCreators();
    }
  }, [user]);

  async function loadCreators() {
    if (!user) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/creators?userId=${user.uid}`);
      const result = await response.json();
      if (result.success) {
        setCreators(result.data);
      }
    } catch (error) {
      console.error("Failed to load creators:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTrackCreator() {
    if (!user || !channelUrl.trim()) return;

    setIsTracking(true);
    try {
      const response = await fetch("/api/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          channelUrl: channelUrl.trim(),
        }),
      });

      const result = await response.json();
      if (result.success) {
        setCreators((prev) => [result.data, ...prev]);
        setChannelUrl("");
        toast.success("Creator tracked!");
      } else {
        toast.error(result.error || "Failed to track creator");
      }
    } catch (error) {
      console.error("Failed to track creator:", error);
      toast.error("Failed to track creator");
    } finally {
      setIsTracking(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add Creator */}
      <div className="flex gap-2">
        <Input
          placeholder="Paste YouTube channel URL..."
          value={channelUrl}
          onChange={(e) => setChannelUrl(e.target.value)}
          className="flex-1 bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder-[#666]"
        />
        <Button
          onClick={handleTrackCreator}
          disabled={isTracking || !channelUrl.trim()}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isTracking ? "Tracking..." : "Track"}
        </Button>
      </div>

      {/* Creator List */}
      <div className="space-y-2">
        {creators.length === 0 && (
          <div className="text-center py-8 text-[#666] text-sm">
            <p>No creators tracked yet.</p>
            <p className="mt-1">Paste a YouTube channel URL above to start tracking.</p>
          </div>
        )}

        {creators.map((creator) => (
          <button
            key={creator.id}
            onClick={() => onSelectCreator(creator)}
            className={`w-full text-left p-3 rounded-lg border transition-colors ${
              selectedCreatorId === creator.id
                ? "bg-[#1a1a1a] border-blue-500/50"
                : "bg-[#1a1a1a] border-[#2a2a2a] hover:border-[#3a3a3a]"
            }`}
          >
            <div className="flex items-center gap-3">
              {creator.thumbnail ? (
                <img
                  src={creator.thumbnail}
                  alt={creator.channelTitle}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{creator.channelTitle}</p>
                <p className="text-xs text-[#888]">
                  {creator.subscriberCount?.toLocaleString()} subscribers · {creator.videoCount?.toLocaleString()} videos
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
