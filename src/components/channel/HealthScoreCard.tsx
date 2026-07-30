"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getHealthScoreColor, getHealthScoreBg } from "@/lib/channel-analytics";

interface HealthScoreBreakdown {
  avgPerf: number;
  consistency: number;
  topRatio: number;
}

interface HealthScoreCardProps {
  score: number;
  breakdown: HealthScoreBreakdown;
}

export function HealthScoreCard({ score, breakdown }: HealthScoreCardProps) {
  const colorClass = getHealthScoreColor(score);
  const bgClass = getHealthScoreBg(score);
  return (
    <Card className={`${bgClass} bg-[#1a1a1a] border-[#2a2a2a] text-white`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[#888] mb-1">Channel Health Score</p>
            <p className={`text-4xl font-bold ${colorClass}`}>{score} <span className="text-lg text-[#666]">/ 100</span></p>
          </div>
          <div className="text-right">
            <div className="text-2xl">
              {score >= 80 ? "🟢" : score >= 60 ? "🟡" : score >= 40 ? "🟠" : "🔴"}
            </div>
            <p className="text-xs text-[#888] mt-1">
              {score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Needs Work" : "Critical"}
            </p>
          </div>
        </div>
        <div className="mt-4"><Progress value={score} className="h-2 bg-[#2a2a2a] [&>div>div]:bg-white" /></div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="bg-[#1a1a1a] rounded-lg p-2">
            <p className="text-xs text-[#888]">Avg Performance</p>
            <p className="text-sm font-semibold text-white">{breakdown.avgPerf}%</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-lg p-2">
            <p className="text-xs text-[#888]">Consistency</p>
            <p className="text-sm font-semibold text-white">{breakdown.consistency}%</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-lg p-2">
            <p className="text-xs text-[#888]">Top Performers</p>
            <p className="text-sm font-semibold text-white">{breakdown.topRatio}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
