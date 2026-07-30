"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Database, RefreshCw } from "lucide-react";

interface QuotaExceededErrorProps {
  retryAfter?: number;
  onRetry?: () => void;
  hasCachedResults?: boolean;
}

export function QuotaExceededError({
  retryAfter,
  onRetry,
  hasCachedResults = false,
}: QuotaExceededErrorProps) {
  const formatTimeRemaining = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} minutes`;
  };

  const timeRemaining = retryAfter ? formatTimeRemaining(retryAfter) : "midnight PST";

  return (
    <Card className="border border-[#2a2a2a] bg-[#1a1a1a] shadow-lg">
      <CardContent className="p-0">
        {/* Header */}
        <div className="bg-[#0a0a0a] px-6 py-4 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-3">
            <div className="bg-[#2a2a2a] rounded-full p-2">
              <AlertTriangle className="w-5 h-5 text-[#ccc]" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">
                  YouTube API Quota Exceeded
                </h3>
                <Badge className="bg-[#2a2a2a] text-[#888] border-[#3a3a3a] hover:bg-[#2a2a2a]">
                  Temporary
                </Badge>
              </div>
              <p className="text-[#888] text-sm mt-1">
                Daily search limit reached — quota resets in <span className="font-semibold text-white">{timeRemaining}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Info cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#2a2a2a]">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-[#ccc]" />
                <span className="font-medium text-white">Resets Daily</span>
              </div>
              <p className="text-sm text-[#888]">
                Quota resets at midnight Pacific time (8-9 AM UTC)
              </p>
            </div>

            <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#2a2a2a]">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <span className="font-medium text-white">Cached Results</span>
              </div>
              <p className="text-sm text-[#888]">
                Search results are cached for 30 minutes — try similar keywords
              </p>
            </div>

            <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#2a2a2a]">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="w-4 h-4 text-[#ccc]" />
                <span className="font-medium text-white">Auto-Retry</span>
              </div>
              <p className="text-sm text-[#888]">
                Page will work normally once quota resets
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            {hasCachedResults && (
              <div className="flex items-center gap-2 text-emerald-400 bg-[#0a0a0a] px-4 py-2 rounded-lg border border-[#2a2a2a]">
                <Database className="w-4 h-4" />
                <span className="font-medium text-sm">Showing cached results below</span>
              </div>
            )}
            {onRetry && (
              <Button
                variant="outline"
                onClick={onRetry}
                className="border-[#3a3a3a] text-white hover:bg-[#2a2a2a] hover:border-[#3a3a3a] cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
