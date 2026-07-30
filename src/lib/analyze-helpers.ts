import type { AnalyzeResult } from "@/lib/analyze-structure/types";

export interface AnalysisError {
  message: string;
  canRetry: boolean;
}

export function formatDate(dateString?: string): string {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "N/A";
  }
}

export function formatAnalysisAsMarkdown(result: AnalyzeResult): string {
  const { structural_breakdown } = result;
  return `# Structure Analysis

## Hook
**Type:** ${structural_breakdown.hook.type}
**Technique:** ${structural_breakdown.hook.technique}
${structural_breakdown.hook.exact_text ? `**Exact text:** "${structural_breakdown.hook.exact_text}"\n` : ""}**Why it works:** ${structural_breakdown.hook.why_it_works}

## Intro
**Approach:** ${structural_breakdown.intro.approach}
**Viewer promise:** ${structural_breakdown.intro.viewer_promise}

## Beats
${structural_breakdown.beats.map((beat) => `${beat.beat_number}. **${beat.label}** — ${beat.purpose} (${beat.technique_used})`).join("\n")}

## Outro
**Style:** ${structural_breakdown.outro.style}
**CTA type:** ${structural_breakdown.outro.cta_type}
${structural_breakdown.outro.cta_exact_phrase ? `**CTA phrase:** "${structural_breakdown.outro.cta_exact_phrase}"\n` : ""}

## Overall
**Format:** ${structural_breakdown.overall.dominant_format}
**Pacing:** ${structural_breakdown.overall.pacing}
**Tone:** ${structural_breakdown.overall.tone}
**Replicability:** ${structural_breakdown.overall.replicability_score}/10
**Best for:** ${structural_breakdown.overall.best_for_niches.join(", ") || "General"}
`;
}
