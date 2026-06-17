"use client";

import type { ScoredOutput, ScoreGrade } from "@/lib/quality/types";
import { cn } from "@/lib/utils";
import { ScoreGradeBadge } from "./ScoreGradeBadge";
import { ScoreBreakdown } from "./ScoreBreakdown";
import { ScoreSuggestions } from "./ScoreSuggestions";
import { ScoreWarning } from "./ScoreWarning";
import { Button } from "@/components/ui/button";

interface ScoreCardProps<T> {
  scoredOutput: ScoredOutput<T>;
  onApplySuggestions?: (suggestions: string[]) => void;
  onEdit?: () => void;
  onRegenerate?: () => void;
  onAccept?: () => void;
}

function getOverallBarColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-blue-500";
  if (score >= 45) return "bg-yellow-500";
  return "bg-red-500";
}

function getThresholdLabel(score: number, grade: ScoreGrade): string {
  if (score >= 90) return "Excellent — ready to publish";
  if (score >= 80) return "Strong — good to publish";
  if (score >= 70) return "Good — consider suggestions";
  if (score >= 60) return "Acceptable — review suggestions";
  return "Below threshold — review carefully";
}

export function ScoreCard<T>({
  scoredOutput,
  onApplySuggestions,
  onEdit,
  onRegenerate,
  onAccept,
}: ScoreCardProps<T>) {
  const { score, attempt, autoRegenerated } = scoredOutput;

  // Show warning state if score < 60 after 2 attempts
  if (!score.passedThreshold && attempt >= 2) {
    return (
      <ScoreWarning
        score={score}
        attempt={attempt}
        onRetry={onRegenerate || (() => {})}
        onEdit={onEdit || (() => {})}
        onAccept={onAccept || (() => {})}
      />
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-5 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Quality Score
        </h3>
        <ScoreGradeBadge grade={score.grade} score={score.score} />
      </div>

      {/* Overall score bar */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", getOverallBarColor(score.score))}
            style={{ width: `${score.score}%` }}
          />
        </div>
        <span className={cn(
          "text-sm font-medium",
          score.passedThreshold ? "text-green-600" : "text-orange-600"
        )}>
          {getThresholdLabel(score.score, score.grade)}
        </span>
      </div>

      {autoRegenerated && (
        <p className="text-xs text-gray-500 mb-3">
          Auto-regenerated from attempt 1 (original scored below 60)
        </p>
      )}

      {/* Category breakdown */}
      <ScoreBreakdown breakdown={score.breakdown} />

      {/* Suggestions */}
      <ScoreSuggestions
        suggestions={score.suggestions}
        onApply={onApplySuggestions ? (s) => onApplySuggestions([s]) : undefined}
      />

      {/* Action buttons */}
      <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200">
        {onApplySuggestions && (
          <Button variant="default" size="sm" onClick={() => onApplySuggestions(score.suggestions)}>
            Apply Suggestions
          </Button>
        )}
        {onEdit && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            Edit Manually
          </Button>
        )}
        {onRegenerate && (
          <Button variant="outline" size="sm" onClick={onRegenerate}>
            Regenerate
          </Button>
        )}
      </div>
    </div>
  );
}