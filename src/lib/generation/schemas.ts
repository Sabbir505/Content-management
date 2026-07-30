import { z } from "zod";

export const voiceProfileSchema = z.object({
  hookStyle: z.string(),
  sentenceLength: z.string(),
  tone: z.string(),
  vocabulary: z.string(),
  humorLevel: z.string(),
  ctaPattern: z.string(),
  sampleSentences: z.array(z.string()).optional(),
});

export const generationMetadataSchema = z.object({
  topic: z.string().optional(),
  niche: z.string().optional(),
});

export function buildRegenerationContext(issues: string[], suggestions: string[]): string {
  if (issues.length === 0) return "";
  return `REGENERATION CONTEXT
The previous generation attempt had these issues:
${issues.map((i) => `- ${i}`).join("\n")}

Required improvements:
${suggestions.map((s) => `- ${s}`).join("\n")}

---
`;
}
