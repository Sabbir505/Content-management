"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { CreatorSearchRow } from "@/components/discover/CreatorSearchRow";
import { useCreatorSearch } from "@/hooks/useCreatorSearch";
import { useLocalCreators } from "@/hooks/useLocalCreators";
import type { User } from "firebase/auth";

interface CreatorsTabProps {
  user: User | null;
}

export function CreatorsTab({ user }: CreatorsTabProps) {
  const { creators: trackedCreators, addCreator, refresh: refreshCreators } = useLocalCreators();
  const {
    creatorSearchQuery,
    setCreatorSearchQuery,
    creatorSearchResults,
    isSearchingCreators,
    handleSearchCreators,
  } = useCreatorSearch({ user, addCreator });

  return (
    <div className="space-y-6">
      {/* Search Creators */}
      <div className="flex gap-2 max-w-xl">
        <input
          type="text"
          placeholder="Search by channel name or channel ID..."
          value={creatorSearchQuery}
          onChange={(e) => setCreatorSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearchCreators();
          }}
          className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#3a3a3a] transition-colors"
        />
        <Button
          onClick={handleSearchCreators}
          disabled={isSearchingCreators || !creatorSearchQuery.trim()}
          className="bg-emerald-400 hover:bg-emerald-500 text-black disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSearchingCreators ? "Searching..." : "Search"}
        </Button>
      </div>

      {/* Search Results */}
      {isSearchingCreators && (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-b-2 border-white rounded-full" />
        </div>
      )}

      {!isSearchingCreators && creatorSearchResults.length > 0 && (
        <div className="space-y-3">
          {creatorSearchResults.map((creator) => (
            <CreatorSearchRow
              key={creator.channelId}
              creator={creator}
              isAlreadyAdded={trackedCreators.some((tc) => tc.channelId === creator.channelId)}
              onAdded={() => {
                refreshCreators();
              }}
            />
          ))}
        </div>
      )}

      {!isSearchingCreators && creatorSearchQuery && creatorSearchResults.length === 0 && (
        <div className="rounded-lg border border-dashed border-[#2a2a2a] bg-[#0a0a0a]/50 p-8 text-center">
          <p className="text-[#888] text-sm">No creators found for &ldquo;{creatorSearchQuery}&rdquo;. Try a different name or channel ID.</p>
        </div>
      )}

      {/* Tracked Creators Section */}
      {trackedCreators.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-white">Your creators</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {trackedCreators.map((creator) => (
              <div
                key={creator.id}
                className="text-left bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4"
              >
                <div className="flex items-center gap-3">
                  {creator.thumbnail ? (
                    <Image
                      src={creator.thumbnail}
                      alt={creator.channelTitle}
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[#2a2a2a] flex items-center justify-center">
                      <svg className="w-6 h-6 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{creator.channelTitle}</p>
                    <p className="text-xs text-[#888]">
                      {creator.subscriberCount?.toLocaleString()} subscribers
                    </p>
                    <p className="text-xs text-[#666]">
                      {creator.videoCount?.toLocaleString()} videos
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty */}
      {!isSearchingCreators && creatorSearchResults.length === 0 && trackedCreators.length === 0 && (
        <div className="rounded-lg border border-dashed border-[#2a2a2a] bg-[#0a0a0a]/50 p-8">
          <div className="flex flex-col items-center text-center">
            <svg className="w-12 h-12 mx-auto mb-4 text-[#3a3a3a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <p className="text-base font-medium text-white mb-1">No creators yet</p>
            <p className="text-[#888] text-sm">Search for creators by channel name or ID to add them to your list.</p>
          </div>
        </div>
      )}
    </div>
  );
}
