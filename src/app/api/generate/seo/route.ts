import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { evaluateAndDeliver } from "@/lib/quality/regeneration";
import { enrichGenerationContext } from "@/lib/quality/grounding/grounding-pipeline";
import { callLLM, type ApiMessage } from "@/lib/generation/llm";
import { parseBody, guardApiKey } from "@/lib/api-helpers";
import { generationMetadataSchema, buildRegenerationContext } from "@/lib/generation/schemas";
import {
  enrichWithScores,
  parseSeoResponse,
  buildSeoSystemPrompt,
  buildSeoUserPrompt,
} from "@/lib/generation/seo-prompts";
import type { SeoPackage } from "@/lib/optimize-types";

const seoSchema = z.object({
  videoTitle: z.string().min(1, "Video title is required"),
  videoDescription: z.string().optional(),
  existingTags: z.array(z.string()).optional(),
  primaryKeyword: z.string().optional(),
  secondaryKeywords: z.array(z.string()).optional(),
}).merge(generationMetadataSchema);

const LLM_OPTS = { temperature: 0.3, maxTokens: 2500, timeoutMs: 30000, maxRetries: 0, emptyFallback: "{}" } as const;


export async function POST(request: NextRequest) {
  try {
    const guard = await guardApiKey("KIMI_API_KEY");
    if (guard) return guard;

    const validation = await parseBody(request, seoSchema);
    if (!validation.success) return validation.errorResponse;

    const {
      videoTitle,
      videoDescription,
      existingTags,
      topic,
      primaryKeyword,
      secondaryKeywords,
    } = validation.data;

    if (!videoTitle.trim()) {
      return NextResponse.json(
        { success: false, error: "Video title is required" },
        { status: 400 }
      );
    }

    // Layer 1: Data Grounding — enrich with real search data
    const groundingContext = await enrichGenerationContext(
      topic || videoTitle
    );

    const pk = primaryKeyword || videoTitle;
    const sk = secondaryKeywords || [];

    const userPrompt = buildSeoUserPrompt({
      videoTitle,
      videoDescription: videoDescription || "",
      existingTags: existingTags || [],
      primaryKeyword: pk,
      secondaryKeywords: sk,
      trendsData: groundingContext.trendsData,
      autocompleteSuggestions: groundingContext.autocompleteData?.suggestions,
    });

    // First LLM call to generate initial output
    const initialMessages: ApiMessage[] = [
      { role: "system", content: buildSeoSystemPrompt() },
      { role: "user", content: userPrompt },
    ];
    const initialContent = await callLLM(initialMessages, LLM_OPTS);
    const initialOutput = parseSeoResponse(initialContent, videoTitle, existingTags || []);

    // Score and auto-regenerate if needed
    const scoredOutput = await evaluateAndDeliver(
      initialOutput,
      "seo",
      { trendsData: groundingContext.trendsData },
      async (_prevOutput, issues, suggestions) => {
        const regenerationContext = buildRegenerationContext(issues, suggestions);

        const messages: ApiMessage[] = [
          { role: "system", content: buildSeoSystemPrompt() },
          { role: "user", content: regenerationContext + userPrompt },
        ];

        const content = await callLLM(messages, { ...LLM_OPTS, temperature: 0.2 }); // Drop temperature by 0.1 for regeneration
        return parseSeoResponse(content, videoTitle, existingTags || []);
      }
    );

    // Enrich individual items with SEO scores
    const enrichedOutput = {
      ...scoredOutput,
      output: enrichWithScores(
        scoredOutput.output as SeoPackage,
        pk,
        groundingContext.trendsData
      ),
    };

    return NextResponse.json({ success: true, data: enrichedOutput });
  } catch (error) {
    console.error("SEO generation error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
