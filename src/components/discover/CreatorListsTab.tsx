"use client";

import Image from "next/image";
import { useState } from "react";
import { useLocalCreatorLists, useLocalCreators } from "@/hooks/useLocalCreators";
import { ListContentGrid } from "./ListContentGrid";
import type { VideoWithOutlier } from "@/types/video";

interface CreatorListsTabProps {
  onChatOpen?: (video: VideoWithOutlier, initialPrompt?: string) => void;
}

export function CreatorListsTab({ onChatOpen }: CreatorListsTabProps = {}) {
  const { lists, isLoading } = useLocalCreatorLists();
  const { creators } = useLocalCreators();
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  const selectedList = lists.find((l) => l.id === selectedListId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-b-2 border-white rounded-full" />
      </div>
    );
  }

  if (selectedList) {
    return (
      <ListContentGrid
        list={selectedList}
        creators={creators}
        onBack={() => setSelectedListId(null)}
        onChatOpen={onChatOpen}
      />
    );
  }

  if (lists.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#2a2a2a] bg-[#0a0a0a]/50 p-8">
        <div className="flex flex-col items-center text-center">
          <svg className="w-12 h-12 mx-auto mb-4 text-[#3a3a3a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-base font-medium text-white mb-1">No lists yet</p>
          <p className="text-[#888] text-sm">Add creators from the Creators tab to organize them into lists.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {lists.map((list) => {
        const listCreators = creators.filter((c) => (list.creatorIds || []).includes(c.channelId));
        const previewCreators = listCreators.slice(0, 4);
        const creatorCount = listCreators.length;

        return (
          <button
            key={list.id}
            onClick={() => setSelectedListId(list.id)}
            className="text-left bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-5 hover:border-[#3a3a3a] transition-colors cursor-pointer"
          >
            <div className="flex items-center mb-4">
              {previewCreators.length > 0 ? (
                <div className="flex -space-x-2">
                  {previewCreators.map((creator, index) => (
                    <div
                      key={creator.channelId}
                      className="relative w-10 h-10 rounded-full border-2 border-[#1a1a1a] overflow-hidden"
                      style={{ zIndex: previewCreators.length - index }}
                    >
                      {creator.thumbnail ? (
                        <Image
                          src={creator.thumbnail}
                          alt={creator.channelTitle}
                          fill
                          sizes="40px"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#2a2a2a] flex items-center justify-center">
                          <span className="text-xs text-[#666]">{(creator.channelTitle || "?")[0].toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              )}
            </div>
            <h3 className="text-base font-medium text-white mb-1">{list.name}</h3>
            <p className="text-sm text-[#666]">{creatorCount} creators</p>
          </button>
        );
      })}
    </div>
  );
}
