"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ChevronLeft, ChevronRight, Plus, X, Search, Clock } from "lucide-react";

type TimeRange = "day" | "week" | "month" | "year";

interface KeywordItem {
  id: string;
  keyword: string;
  createdAt: { seconds: number; nanoseconds: number } | null;
}

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
  const [keywords, setKeywords] = useState<KeywordItem[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, "users", user.uid, "keywords"),
      orderBy("createdAt", "desc")
    );

    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map((docSnapshot) => ({
            id: docSnapshot.id,
            ...docSnapshot.data(),
          })) as KeywordItem[];
          setKeywords(items);
          setIsLoading(false);
        },
        (error) => {
          console.error("[KeywordSidebar] Failed to load keywords:", error);
          setIsLoading(false);
          toast.error(
            error.message?.includes("index")
              ? "Database index is being created. Keywords will load shortly."
              : "Failed to load keywords. Please try again."
          );
        }
      );
    } catch (error) {
      console.error("[KeywordSidebar] Failed to set up keyword listener:", error);
      setIsLoading(false);
      toast.error("Failed to load keywords. Please try again.");
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  async function handleAddKeyword(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyword.trim() || !user) return;

    try {
      await addDoc(collection(db, "users", user.uid, "keywords"), {
        keyword: newKeyword.trim(),
        createdAt: serverTimestamp(),
      });
      setNewKeyword("");
      toast.success("Keyword added");
    } catch (error) {
      toast.error("Failed to add keyword");
    }
  }

  async function handleDeleteKeyword(id: string) {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "keywords", id));
      toast.success("Keyword removed");
    } catch (error) {
      toast.error("Failed to remove keyword");
    }
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
      className={`fixed left-0 top-16 h-[calc(100vh-4rem)] bg-white border-r border-gray-200 transition-all duration-300 z-40 flex flex-col ${
        isCollapsed ? "w-12" : "w-72"
      }`}
    >
      {/* Toggle button */}
      <button
        onClick={() => {
          const newCollapsed = !isCollapsed;
          setIsCollapsed(newCollapsed);
          onCollapseChange?.(newCollapsed);
        }}
        className="absolute -right-3 top-4 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50"
      >
        {isCollapsed ? (
          <ChevronRight className="w-3 h-3 text-gray-600" />
        ) : (
          <ChevronLeft className="w-3 h-3 text-gray-600" />
        )}
      </button>

      {isCollapsed ? (
        <div className="flex-1 flex flex-col items-center pt-4 gap-2">
          {keywords.slice(0, 5).map((item) => (
            <button
              key={item.id}
              onClick={() => handleKeywordClick(item.keyword)}
              className="w-8 h-8 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center text-xs font-medium text-blue-700"
              title={item.keyword}
            >
              {item.keyword.charAt(0).toUpperCase()}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          {/* Header */}
          <div className="mb-5 pb-4 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900 tracking-tight">Keywords</h2>
            <p className="text-xs text-gray-400 mt-1">Click to search videos</p>
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search videos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-400 transition-colors"
              />
            </div>
            <Button type="submit" size="sm" className="h-9 w-9 p-0 bg-blue-600 hover:bg-blue-700">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </form>

          {/* Add keyword */}
          <form onSubmit={handleAddKeyword} className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Plus className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input
                type="text"
                placeholder="Add keyword..."
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                className="pl-8 h-9 text-sm bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-400 transition-colors"
              />
            </div>
            <Button type="submit" size="sm" className="h-9 w-9 p-0 bg-gray-900 hover:bg-gray-800">
              <Plus className="w-4 h-4" />
            </Button>
          </form>

          {/* Search all button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSearchAll}
            className="mb-4 w-full bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:text-blue-800 hover:border-blue-300"
          >
            Search All Keywords
          </Button>

          {/* Time Range Filter */}
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs font-medium text-gray-700">Time Period</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(["day", "week", "month", "year"] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => onTimeRangeChange?.(range)}
                  className={`text-xs py-1.5 px-2 rounded-md border transition-colors ${
                    timeRange === range
                      ? "bg-blue-50 border-blue-300 text-blue-700 font-medium"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300"
                  }`}
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
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                  <p className="text-sm text-gray-400">Loading keywords...</p>
                </div>
              ) : keywords.length === 0 ? (
                <div className="py-8 px-2 text-center w-full">
                  <p className="text-sm text-gray-400 mb-1">No keywords yet</p>
                  <p className="text-xs text-gray-300">Add one above to get started</p>
                </div>
              ) : (
                keywords.map((item) => (
                  <div
                    key={item.id}
                    className="group inline-flex items-center justify-center gap-1 py-1.5 px-3 rounded-full bg-gray-100 hover:bg-blue-100 cursor-pointer transition-colors border border-gray-200 hover:border-blue-200"
                  >
                    <span
                      className="text-sm font-medium text-gray-700 hover:text-blue-700 cursor-pointer whitespace-nowrap text-center"
                      onClick={() => handleKeywordClick(item.keyword)}
                    >
                      {item.keyword}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteKeyword(item.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all rounded-full hover:bg-red-50 flex-shrink-0"
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
