"use client";

import type { ScoreGrade } from "@/lib/quality/types";
import { cn } from "@/lib/utils";

interface ScoreGradeBadgeProps {
  grade: ScoreGrade;
  score: number;
}

const gradeColors: Record<ScoreGrade, string> = {
  A: "bg-green-100 text-green-800 border-green-300",
  "B+": "bg-teal-100 text-teal-800 border-teal-300",
  B: "bg-blue-100 text-blue-800 border-blue-300",
  C: "bg-yellow-100 text-yellow-800 border-yellow-300",
  D: "bg-orange-100 text-orange-800 border-orange-300",
  F: "bg-red-100 text-red-800 border-red-300",
};

export function ScoreGradeBadge({ grade, score }: ScoreGradeBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-md border font-semibold text-sm",
        gradeColors[grade]
      )}
    >
      <span className="text-lg font-bold">{grade}</span>
      <span>{score}/100</span>
    </div>
  );
}