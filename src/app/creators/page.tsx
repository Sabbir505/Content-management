"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CreatorList } from "@/components/creators/CreatorList";
import { CreatorFeed } from "@/components/creators/CreatorFeed";
import type { TrackedCreator } from "@/types/creator";

export default function CreatorsPage() {
  const router = useRouter();
  const [selectedCreator, setSelectedCreator] = useState<TrackedCreator | null>(null);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      {/* Left Sidebar */}
      <div className="w-80 bg-[#0a0a0a] border-r border-[#1a1a1a] flex flex-col">
        <div className="p-4 border-b border-[#1a1a1a]">
          <h1 className="text-lg font-semibold text-white">Creators</h1>
          <p className="text-xs text-[#888] mt-1">Track and analyze creators</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <CreatorList
            onSelectCreator={(creator) => setSelectedCreator(creator)}
            selectedCreatorId={selectedCreator?.id}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {!selectedCreator ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-[#666]">
              <svg className="w-12 h-12 mx-auto mb-4 text-[#3a3a3a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <p className="text-sm">Select a creator to view their content</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCreator(null)}
                className="text-[#888] hover:text-white"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </Button>
            </div>
            <CreatorFeed creator={selectedCreator} />
          </div>
        )}
      </div>
    </div>
  );
}
