"use client";

import type { CorrelationResult } from "@/lib/quality/types";

interface CorrelationInsightProps {
  insights: CorrelationResult[];
  type: "working" | "notWorking";
}

export function CorrelationInsight({ insights, type }: CorrelationInsightProps) {
  if (insights.length === 0) return null;

  const title = type === "working" ? "What's Working For You" : "What's Not Working";
  const icon = type === "working" ? "✓" : "✗";
  const textColor = type === "working" ? "text-green-700" : "text-red-700";

  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-sm">{title}</h4>
      <ul className="space-y-1.5">
        {insights.slice(0, 5).map((insight, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className={textColor}>{icon}</span>
            <span className="text-gray-700">{insight.insight}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
