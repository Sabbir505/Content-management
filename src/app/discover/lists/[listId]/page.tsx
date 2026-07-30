"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import type { TrackedCreator } from "@/types/creator";
import type { CreatorList } from "@/types/creator";
import { toast } from "sonner";

export default function ListDetailPage() {
  const params = useParams();
  const router = useRouter();
  const listId = params.listId as string;
  const { user } = useAuth();
  const [list, setList] = useState<CreatorList | null>(null);
  const [creators, setCreators] = useState<TrackedCreator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !listId) return;
    loadList();
  }, [user, listId]);

  async function loadList() {
    if (!user || !listId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const listResponse = await fetch(`/api/creator-lists?userId=${user.uid}`);
      const listResult = await listResponse.json();
      if (listResult.success) {
        const foundList = listResult.data.find((l: CreatorList) => l.id === listId);
        if (foundList) {
          setList(foundList);
          const creatorsResponse = await fetch(`/api/creators?userId=${user.uid}`);
          const creatorsResult = await creatorsResponse.json();
          if (creatorsResult.success) {
            const allCreators: TrackedCreator[] = creatorsResult.data;
            const listCreators = allCreators.filter((c) => foundList.creatorIds.includes(c.channelId));
            setCreators(listCreators);
          }
        } else {
          setLoadError("List not found");
          toast.error("List not found");
        }
      } else {
        setLoadError("Failed to load list");
      }
    } catch (error) {
      console.error("Failed to load list:", error);
      setLoadError("Failed to load list");
      toast.error("Failed to load list");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-5 h-5 rounded bg-[#2a2a2a]" />
            <div className="space-y-2">
              <div className="h-5 w-40 rounded bg-[#2a2a2a]" />
              <div className="h-3 w-56 rounded bg-[#2a2a2a]" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#2a2a2a]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/4 rounded bg-[#2a2a2a]" />
                    <div className="h-2 w-1/2 rounded bg-[#2a2a2a]" />
                    <div className="h-2 w-1/3 rounded bg-[#2a2a2a]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loadError && !list) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-6 flex items-center justify-center">
        <div className="max-w-md w-full text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-900/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-white font-medium mb-1">{loadError}</p>
          <p className="text-sm text-[#888] mb-6">
            Something went wrong loading this list.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => loadList()}
              className="px-4 py-2 text-sm font-medium text-white bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#3a3a3a] rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer"
            >
              Retry
            </button>
            <button
              onClick={() => router.push("/discover")}
              className="px-4 py-2 text-sm font-medium text-[#ccc] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer"
            >
              Back to discover
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-6 flex items-center justify-center">
        <div className="max-w-md w-full text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#2a2a2a] flex items-center justify-center">
            <svg className="w-6 h-6 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-white font-medium mb-1">List not found</p>
          <p className="text-sm text-[#888] mb-6">
            This list may have been deleted or you don&apos;t have access.
          </p>
          <button
            onClick={() => router.push("/discover")}
            className="px-4 py-2 text-sm font-medium text-white bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#3a3a3a] rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer"
          >
            Back to discover
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.push("/discover")}
            aria-label="Back to discover"
            className="text-[#888] hover:text-white transition-colors p-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-white truncate">{list.name}</h1>
              <span className="shrink-0 text-xs text-[#888] bg-[#1a1a1a] border border-[#2a2a2a] rounded-full px-2.5 py-0.5">
                {creators.length} {creators.length === 1 ? "creator" : "creators"}
              </span>
            </div>
            {list.description && <p className="text-sm text-[#888] mt-1">{list.description}</p>}
          </div>
        </div>

        {creators.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
              <svg className="w-7 h-7 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4 0" />
              </svg>
            </div>
            <p className="text-white font-medium mb-1">No creators in this list yet</p>
            <p className="text-sm text-[#888] mb-6">
              Add creators from the discover feed to curate this list.
            </p>
            <button
              onClick={() => router.push("/discover")}
              className="px-4 py-2 text-sm font-medium text-white bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#3a3a3a] rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer"
            >
              Browse creators
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {creators.map((creator) => (
              <button
                key={creator.id}
                onClick={() => router.push(`/discover/creators/${creator.channelId}`)}
                className="text-left bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 hover:border-[#3a3a3a] hover:bg-[#1f1f1f] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  {creator.thumbnail ? (
                    <Image
                      src={creator.thumbnail}
                      alt={creator.channelTitle}
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[#2a2a2a] flex items-center justify-center shrink-0">
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
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
