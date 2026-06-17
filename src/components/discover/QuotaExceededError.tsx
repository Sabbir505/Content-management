"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Database, RefreshCw } from "lucide-react";

interface QuotaExceededErrorProps {
  retryAfter?: number;
  onRetry?: () => void;
  hasCachedResults?: boolean;
  onViewCached?: () => void;
}

export function QuotaExceededError({
  retryAfter,
  onRetry,
  hasCachedResults = false,
  onViewCached,
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
    <Card className="border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 shadow-lg">
      <CardContent className="p-0">
        {/* Header */}
        <div className="bg-amber-100 px-6 py-4 border-b border-amber-200">
          <div className="flex items-center gap-3">
            <div className="bg-amber-200 rounded-full p-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-amber-900">
                  YouTube API Quota Exceeded
                </h3>
                <Badge className="bg-amber-200 text-amber-800 border-amber-300 hover:bg-amber-200">
                  Temporary
                </Badge>
              </div>
              <p className="text-amber-700 text-sm mt-1">
                Daily search limit reached — quota resets in <span className="font-semibold">{timeRemaining}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Info cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 border border-amber-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="font-medium text-gray-800">Resets Daily</span>
              </div>
              <p className="text-sm text-gray-600">
                Quota resets at midnight Pacific time (8-9 AM UTC)
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 border border-amber-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-4 h-4 text-green-500" />
                <span className="font-medium text-gray-800">Cached Results</span>
              </div>
              <p className="text-sm text-gray-600">
                Search results are cached for 30 minutes — try similar keywords
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 border border-amber-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="w-4 h-4 text-blue-500" />
                <span className="font-medium text-gray-800">Auto-Retry</span>
              </div>
              <p className="text-sm text-gray-600">
                Page will work normally once quota resets
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            {hasCachedResults && (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
                <Database className="w-4 h-4" />
                <span className="font-medium">Showing cached results below</span>
              </div>
            )}
            {onRetry && (
              <Button
                variant="outline"
                onClick={onRetry}
                className="border-amber-300 text-amber-700 hover:bg-amber-100 hover:border-amber-400"
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