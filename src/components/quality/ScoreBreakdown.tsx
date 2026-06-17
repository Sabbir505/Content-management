"use client";

import type { ScoreBreakdown } from "@/lib/quality/types";
import { cn } from "@/lib/utils";

interface ScoreBreakdownProps {
  breakdown: ScoreBreakdown;
}

const categoryLabels: Record<string, string> = {
  title: "Title",
  description: "Description",
  tags: "Tags",
  keyword_data: "Keyword Data",
  hook: "Hook",
  hook_tweet: "Hook Tweet",
  structure: "Structure",
  thread_structure: "Thread Structure",
  pacing: "Pacing",
  voice: "Voice",
  caption_structure: "Caption Structure",
  hashtags: "Hashtags",
  engagement: "Engagement",
  post_structure: "Post Structure",
};

function getBarColor(ratio: number): string {
  if (ratio >= 0.8) return "bg-green-500";
  if (ratio >= 0.6) return "bg-blue-500";
  if (ratio >= 0.4) return "bg-yellow-500";
  return "bg-red-500";
}

export function ScoreBreakdown({ breakdown }: ScoreBreakdownProps) {
  return (
    <div className="space-y-3">
      {Object.entries(breakdown).map(([key, item]) => {
        const ratio = item.max > 0 ? item.score / item.max : 0;
        const label = categoryLabels[key] || key;

        return (
          <div key={key} className="flex items-center gap-3">
            <span className="text-sm font-medium w-28 shrink-0">{label}</span>
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", getBarColor(ratio))}
                style={{ width: `${ratio * 100}%` }}
              />
            </div>
            <span className="text-sm text-gray-600 w-12 shrink-0 text-right">
              {item.score}/{item.max}
            </span>
            {item.issues.length > 0 ? (
              <span className="text-xs text-orange-600 shrink-0">⚠ {item.issues[0]}</span>
            ) : (
              <span className="text-xs text-green-600 shrink-0">✓</span>
            )}
          </div>
        );
      })}
    </div>
  );
}