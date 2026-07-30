"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useKeywords } from "@/hooks/useKeywords";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Plus, X, Search, Tag } from "lucide-react";

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const { keywords, isLoading, addKeyword, deleteKeyword } = useKeywords(user?.uid);
  const [newKeyword, setNewKeyword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAddKeyword(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyword.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await addKeyword(newKeyword);
      setNewKeyword("");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSearchWithKeyword(keyword: string) {
    router.push(`/discover?query=${encodeURIComponent(keyword)}`);
  }

  function handleSearchAllKeywords() {
    router.push("/discover?auto=1");
  }

  async function handleDelete(id: string) {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await deleteKeyword(id);
    } finally {
      setDeletingId(null);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-[#888] mb-4">Please sign in to access your dashboard.</p>
          <Button
            onClick={() => router.push("/auth/login")}
            className="bg-emerald-400 text-[#0a0a0a] hover:bg-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-white">Dashboard</h1>
          <p className="text-[#888]">Manage your content keywords</p>
        </div>

        <Card className="mb-6 bg-[#1a1a1a] border-[#2a2a2a]">
          <CardHeader>
            <CardTitle className="text-white">Add Keyword</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddKeyword} className="flex gap-2">
              <Input
                type="text"
                placeholder="Enter a keyword (e.g., 'productivity tips')..."
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                disabled={isSubmitting}
                className="flex-1 bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder:text-[#666] focus-visible:ring-1 focus-visible:ring-[#3a3a3a] focus-visible:border-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <Button
                type="submit"
                disabled={!newKeyword.trim() || isSubmitting}
                className="bg-emerald-400 text-[#0a0a0a] hover:bg-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="mb-6 bg-[#1a1a1a] border-[#2a2a2a]">
          <CardHeader>
            <CardTitle className="text-white">Your Keywords</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-7 w-28 rounded-full bg-[#2a2a2a] animate-pulse"
                  />
                ))}
              </div>
            ) : keywords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-[#2a2a2a] flex items-center justify-center mb-4">
                  <Tag className="w-5 h-5 text-[#666]" />
                </div>
                <p className="text-[#ccc] mb-1">No keywords yet</p>
                <p className="text-sm text-[#666] mb-4">
                  Add a keyword above to start tracking content.
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {keywords.map((item) => (
                  <div key={item.id} className="flex items-center gap-1">
                    <Badge
                      variant="secondary"
                      className="cursor-pointer bg-[#2a2a2a] text-[#ccc] border border-transparent hover:bg-[#3a3a3a] hover:text-white hover:border-[#3a3a3a] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a3a3a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]"
                      onClick={() => handleSearchWithKeyword(item.keyword)}
                    >
                      {item.keyword}
                    </Badge>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      aria-label={`Remove keyword ${item.keyword}`}
                      className={cn(
                        "flex items-center justify-center w-5 h-5 rounded-full text-[#666] hover:text-red-400 hover:bg-red-900/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button
            onClick={handleSearchAllKeywords}
            disabled={keywords.length === 0}
            className="bg-emerald-400 text-[#0a0a0a] hover:bg-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Search className="w-4 h-4 mr-1" />
            Go to Discover
          </Button>
        </div>
      </div>
    </div>
  );
}
