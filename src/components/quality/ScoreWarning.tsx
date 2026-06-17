"use client";

import type { QualityScore } from "@/lib/quality/types";
import { Button } from "@/components/ui/button";

interface ScoreWarningProps {
  score: QualityScore;
  attempt: number;
  onRetry: () => void;
  onEdit: () => void;
  onAccept: () => void;
}

export function ScoreWarning({ score, attempt, onRetry, onEdit, onAccept }: ScoreWarningProps) {
  const allIssues = Object.values(score.breakdown)
    .flatMap((b) => b.issues);

  return (
    <div className="border-2 border-orange-300 bg-orange-50 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">⚠️</span>
        <h3 className="text-lg font-semibold text-orange-800">
          Quality Warning
        </h3>
      </div>

      <p className="text-sm text-orange-700 mb-4">
        This output scored <strong>{score.score}/100</strong> after{" "}
        {attempt} generation attempts. It may not perform well. Here&apos;s why:
      </p>

      <ul className="space-y-1 mb-4">
        {allIssues.map((issue, i) => (
          <li key={i} className="text-sm text-orange-800 flex items-start gap-2">
            <span className="mt-0.5">·</span>
            <span>{issue}</span>
          </li>
        ))}
      </ul>

      <div className="flex gap-3">
        <Button variant="default" size="sm" onClick={onRetry}>
          Try Again
        </Button>
        <Button variant="outline" size="sm" onClick={onEdit}>
          Edit Manually
        </Button>
        <Button variant="ghost" size="sm" onClick={onAccept}>
          Use Anyway
        </Button>
      </div>
    </div>
  );
}