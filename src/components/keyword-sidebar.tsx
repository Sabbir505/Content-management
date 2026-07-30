"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useKeywords } from "@/hooks/useKeywords";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Plus, X, Search, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type TimeRange = "day" | "week" | "month" | "year";

interface KeywordSidebarProps {
  onKeywordClick?: (keyword: string) => void;
  onSearchAll?: () => void;
  onSearch?: (query: string) => void;
  onCollapseChange?: (collapsed: boolean) => void;
  timeRange?: TimeRange;
  onTimeRangeChange?: (range: TimeRange) => void;
}

export function KeywordSidebar({ onKeywordClick, onSearchAll, onSearch, onCollapseChange, timeRange = "week", onTimeRangeChange }: KeywordSidebarProps) {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const { keywords, isLoading, addKeyword, deleteKeyword } = useKeywords(user?.uid);
  const [newKeyword, setNewKeyword] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);

  async function handleAddKeyword(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    await addKeyword(newKeyword);
    setNewKeyword("");
  }

  function handleKeywordClick(keyword: string) {
    if (onKeywordClick) {
      onKeywordClick(keyword);
    } else {
      router.push(`/discover?query=${encodeURIComponent(keyword)}`);
    }
  }

  function handleSearchAll() {
    if (onSearchAll) {
      onSearchAll();
    } else {
      router.push("/discover?auto=1");
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    if (onSearch) {
      onSearch(searchQuery.trim());
    } else {
      router.push(`/discover?query=${encodeURIComponent(searchQuery.trim())}`);
    }
    setSearchQuery("");
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed left-0 top-16 h-[calc(100vh-4rem)] bg-[#1a1a1a] border-r border-[#2a2a2a] transition-all duration-300 z-40 flex flex-col",
        isCollapsed ? "w-12" : "w-72"
      )}
    >
      {/* Toggle button */}
      <button
        onClick={() => {
          const newCollapsed = !isCollapsed;
          setIsCollapsed(newCollapsed);
          onCollapseChange?.(newCollapsed);
        }}
        className="absolute -right-3 top-4 w-6 h-6 bg-[#1a1a1a] border border-[#3a3a3a] rounded-full flex items-center justify-center shadow-sm hover:bg-[#2a2a2a] hover:border-[#3a3a3a] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3a3a3a] cursor-pointer"
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? (
          <ChevronRight className="w-3 h-3 text-[#ccc]" />
        ) : (
          <ChevronLeft className="w-3 h-3 text-[#ccc]" />
        )}
      </button>

      {isCollapsed ? (
        <div className="flex-1 flex flex-col items-center pt-4 gap-2">
          {keywords.slice(0, 5).map((item) => (
            <button
              key={item.id}
              onClick={() => handleKeywordClick(item.keyword)}
              className="w-8 h-8 rounded-full bg-[#2a2a2a] hover:bg-[#3a3a3a] flex items-center justify-center text-xs font-medium text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3a3a3a] cursor-pointer"
              title={item.keyword}
            >
              {item.keyword.charAt(0).toUpperCase()}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          {/* Header */}
          <div className="mb-5 pb-4 border-b border-[#2a2a2a]">
            <h2 className="text-base font-bold text-white tracking-tight">Keywords</h2>
            <p className="text-xs text-[#666] mt-1">Click to search videos</p>
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#666]" />
              <Input
                type="text"
                placeholder="Search videos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder:text-[#666] focus-visible:border-[#3a3a3a] focus-visible:ring-[#3a3a3a] transition-colors"
              />
            </div>
            <Button type="submit" size="sm" className="h-9 w-9 p-0 bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#2a2a2a] text-white focus-visible:ring-[#3a3a3a]">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </form>

          {/* Add keyword */}
          <form onSubmit={handleAddKeyword} className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Plus className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#666]" />
              <Input
                type="text"
                placeholder="Add keyword..."
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                className="pl-8 h-9 text-sm bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder:text-[#666] focus-visible:border-[#3a3a3a] focus-visible:ring-[#3a3a3a] transition-colors"
              />
            </div>
            <Button type="submit" size="sm" className="h-9 w-9 p-0 bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#2a2a2a] text-white focus-visible:ring-[#3a3a3a]">
              <Plus className="w-4 h-4" />
            </Button>
          </form>

          {/* Search all button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSearchAll}
            className="mb-4 w-full bg-[#0a0a0a] border-[#3a3a3a] text-white hover:bg-[#2a2a2a] hover:text-white hover:border-[#3a3a3a] focus-visible:ring-[#3a3a3a] cursor-pointer"
          >
            Search All Keywords
          </Button>

          {/* Time Range Filter */}
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5 text-[#888]" />
              <span className="text-xs font-medium text-[#ccc]">Time Period</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(["day", "week", "month", "year"] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => onTimeRangeChange?.(range)}
                  className={cn(
                    "text-xs py-1.5 px-2 rounded-md border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3a3a3a] cursor-pointer",
                    timeRange === range
                      ? "bg-[#2a2a2a] border-[#3a3a3a] text-white font-medium"
                      : "bg-[#0a0a0a] border-[#2a2a2a] text-[#ccc] hover:bg-[#1a1a1a] hover:border-[#3a3a3a] hover:text-[#ccc]"
                  )}
                >
                  {range === "day" && "24 Hours"}
                  {range === "week" && "7 Days"}
                  {range === "month" && "30 Days"}
                  {range === "year" && "1 Year"}
                </button>
              ))}
            </div>
          </div>

          {/* Keywords list */}
          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            <div className="flex flex-wrap gap-2 content-start">
              {isLoading ? (
                <div className="flex items-center gap-2 py-3 px-2 w-full">
                  <div className="w-4 h-4 border-2 border-[#2a2a2a] border-t-[#888] rounded-full animate-spin" />
                  <p className="text-sm text-[#666]">Loading keywords...</p>
                </div>
              ) : keywords.length === 0 ? (
                <div className="py-8 px-2 text-center w-full">
                  <p className="text-sm text-[#888] mb-1">No keywords yet</p>
                  <p className="text-xs text-[#666]">Add one above to get started</p>
                </div>
              ) : (
                keywords.map((item) => (
                  <div
                    key={item.id}
                    className="group inline-flex items-center justify-center gap-1 py-1.5 px-3 rounded-full bg-[#0a0a0a] hover:bg-[#2a2a2a] cursor-pointer transition-colors border border-[#2a2a2a] hover:border-[#3a3a3a]"
                  >
                    <span
                      className="text-sm font-medium text-[#ccc] hover:text-white cursor-pointer whitespace-nowrap text-center"
                      onClick={() => handleKeywordClick(item.keyword)}
                    >
                      {item.keyword}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteKeyword(item.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-[#666] hover:text-red-400 transition-all rounded-full hover:bg-red-900/20 flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3a3a3a] cursor-pointer"
                      aria-label={`Remove ${item.keyword}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
