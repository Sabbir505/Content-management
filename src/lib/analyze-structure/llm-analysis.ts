import type {
  SourceType,
  StructuralBreakdown,
  TimedSegment,
  ArticleSegment,
  TranscriptQuality,
  VideoSourceSpecific,
  ArticleSourceSpecific,
} from "./types";
import { getProxyUrl } from "../proxy";

const API_URL = process.env.KIMI_API_ENDPOINT || "https://ai2.18.show/v1/chat/completions";
const API_KEY = process.env.KIMI_API_KEY;
const MODEL = process.env.KIMI_MODEL || "DeepSeek-V4-Pro";

interface ApiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ApiResponse {
  choices: {
    message: {
      content: string;
    };
    finish_reason?: string;
  }[];
}

async function callLLM(messages: ApiMessage[], temperature: number = 0.3): Promise<string> {
  if (!API_KEY) {
    throw new Error("KIMI_API_KEY not configured");
  }

  // The Kimi endpoint is directly reachable in most environments; the local proxy
  // auto-detected by getProxyUrl() is flaky for this host and causes ECONNRESET /
  // connect timeouts. Only route through the proxy if explicitly requested.
  const useProxy = process.env.KIMI_USE_PROXY === "true";
  const proxyUrl = useProxy ? await getProxyUrl() : undefined;
  let fetchFn: typeof fetch = fetch;
  if (proxyUrl) {
    const { ProxyAgent, fetch: undiciFetch } = await import("undici");
    const dispatcher = new ProxyAgent({
      uri: proxyUrl,
      connectTimeout: 30000,
    });
    fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
      let url: string;
      let options: RequestInit = {};
      if (typeof input === "string") {
        url = input;
      } else if (input instanceof URL) {
        url = input.toString();
      } else {
        url = input.url;
        options = { method: input.method, headers: input.headers, body: input.body };
      }
      if (init) {
        options = { ...options, ...init };
        if (init.headers) {
          const merged = new Headers(options.headers);
          new Headers(init.headers).forEach((v, k) => merged.set(k, v));
          options.headers = merged;
        }
      }
      return undiciFetch(url, { ...options, dispatcher } as never) as unknown as Response;
    }) as typeof fetch;
  }

  const response = await fetchFn(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature,
      max_tokens: 6000,
    }),
    signal: AbortSignal.timeout(180000),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data: ApiResponse = await response.json();
  const choice = data.choices[0];
  if (choice?.finish_reason === "length") {
    throw new Error("Analysis response was truncated. The transcript or beats may be too long.");
  }
  return choice?.message?.content || "{}";
}

function buildSystemPrompt(): string {
  return `You are TubeForge's content analyst. Your job is to analyze any piece of
content — a YouTube video transcript or a written article — and extract its
structural DNA: the exact blueprint that made it work.

You are not summarising the content. You are mapping HOW it was built:
the hook technique, the narrative structure, the pacing choices, the
payoff/CTA method.

The content has already been segmented into beats for you. Your job is to:
1. Characterize each beat (its purpose and technique)
2. Identify the hook type and why it works
3. Identify the outro/CTA style
4. Assess overall pacing and format
5. Score how replicable this structure is for a different topic

Be specific and actionable. "The hook is good" is useless.
"The hook opens with a false assumption the reader holds, then contradicts
it in one sentence" is useful.

This works identically whether the source is a video transcript or a
written article — analyze the STRUCTURE, not the medium.

OUTPUT FORMAT
- Return valid JSON only
- No preamble or explanation outside the JSON
- Follow the exact schema in the user prompt`;
}

function buildUserPrompt(params: {
  sourceType: SourceType;
  title: string;
  creator: string;
  engagement: string;
  niche: string;
  durationSeconds?: number;
  transcriptQuality?: TranscriptQuality;
  wordCount?: number;
  readTimeMinutes?: number;
  hadHeaders?: boolean;
  segmentedBeats: string;
}): string {
  const videoMeta = params.sourceType === "video"
    ? `VIDEO-SPECIFIC METADATA
-----------------------------------------------------------
Duration (seconds):  ${params.durationSeconds}
Transcript quality:  ${params.transcriptQuality}
`
    : "";

  const articleMeta = params.sourceType === "article"
    ? `ARTICLE-SPECIFIC METADATA
-------------------------------------------------------------
Word count:           ${params.wordCount}
Estimated read time:  ${params.readTimeMinutes} minutes
Had header structure: ${params.hadHeaders}
`
    : "";

  return `Analyze the structural DNA of the following content.

SOURCE METADATA
---------------
Source type:         ${params.sourceType}
Title / Headline:    ${params.title}
Creator / Author:    ${params.creator}
Engagement metric:   ${params.engagement}
Niche:               ${params.niche}

${videoMeta}${articleMeta}
PRE-SEGMENTED BEATS
--------------------
${params.segmentedBeats}

Respond using this exact JSON schema:

{
  "source_type": "video | article",
  "structural_breakdown": {
    "hook": {
      "type": "bold_claim | question | story | statistic | counter_intuitive | controversy | other",
      "technique": "",
      "exact_text": "",
      "why_it_works": ""
    },
    "intro": {
      "approach": "",
      "viewer_promise": ""
    },
    "beats": [
      {
        "beat_number": 1,
        "label": "",
        "purpose": "",
        "technique_used": "",
        "transition_to_next": ""
      }
    ],
    "outro": {
      "style": "",
      "cta_type": "",
      "cta_exact_phrase": ""
    },
    "overall": {
      "dominant_format": "educational | opinion | story | listicle | documentary | hybrid",
      "pacing": "fast | medium | slow",
      "tone": "",
      "replicability_score": 0,
      "replicability_note": "",
      "best_for_niches": []
    }
  },
  "source_specific": {
    "video": {
      "duration_seconds": 0,
      "transcript_quality": "high | medium | low"
    },
    "article": {
      "word_count": 0,
      "read_time_minutes": 0,
      "had_headers": true
    }
  }
}`;
}

export function parseStructuralResponse(content: string): StructuralBreakdown {
  const cleanJson = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    const parsed = JSON.parse(cleanJson);
    if (!parsed.structural_breakdown) {
      throw new Error("Missing structural_breakdown");
    }
    return parsed.structural_breakdown as StructuralBreakdown;
  } catch (err) {
    console.error("[LLM PARSE ERROR]", err instanceof Error ? err.message : err);
    console.error("[LLM RAW RESPONSE]", content.slice(0, 2000));
    // Return a fallback breakdown if parsing fails
    return {
      hook: {
        type: "other",
        technique: "Unable to parse hook from response",
        exact_text: "",
        why_it_works: "",
      },
      intro: {
        approach: "",
        viewer_promise: "",
      },
      beats: [],
      outro: {
        style: "",
        cta_type: "",
        cta_exact_phrase: "",
      },
      overall: {
        dominant_format: "educational",
        pacing: "medium",
        tone: "",
        replicability_score: 5,
        replicability_note: "Analysis failed — partial structure only",
        best_for_niches: [],
      },
    };
  }
}

// Main LLM analysis function
export async function analyzeStructureWithLLM(params: {
  sourceType: SourceType;
  title: string;
  creator: string;
  engagement: string;
  niche: string;
  durationSeconds?: number;
  transcriptQuality?: TranscriptQuality;
  wordCount?: number;
  readTimeMinutes?: number;
  hadHeaders?: boolean;
  beats: TimedSegment[] | ArticleSegment[];
  videoMetadata?: {
    id: string;
    title: string;
    channel_title: string;
    thumbnail_url: string;
    view_count?: number;
    published_at?: string;
  };
  articleMetadata?: {
    url: string;
    title: string;
    author?: string;
    published_at?: string;
  };
}): Promise<{
  structuralBreakdown: StructuralBreakdown;
  sourceSpecific: {
    video: VideoSourceSpecific | null;
    article: ArticleSourceSpecific | null;
  };
  sourceMetadata: {
    video: {
      id: string;
      title: string;
      channel_title: string;
      thumbnail_url: string;
      view_count?: number;
      published_at?: string;
    } | null;
    article: {
      url: string;
      title: string;
      author?: string;
      published_at?: string;
    } | null;
  };
}> {
  // Format beats for the prompt
  const segmentedBeats = params.beats.map((beat, index) => {
    if ("start_time_seconds" in beat) {
      // Video beat
      return `Beat ${index + 1} [${beat.start_time_seconds}s - ${beat.end_time_seconds}s]: ${beat.text.slice(0, 200)}${beat.text.length > 200 ? "..." : ""}`;
    } else {
      // Article beat
      return `Beat ${index + 1} [words ${beat.start_word_index}-${beat.end_word_index}]${beat.had_header ? ` (Header: ${beat.header_text})` : ""}: ${beat.text.slice(0, 200)}${beat.text.length > 200 ? "..." : ""}`;
    }
  }).join("\n\n");

  const messages: ApiMessage[] = [
    { role: "system", content: buildSystemPrompt() },
    {
      role: "user",
      content: buildUserPrompt({
        sourceType: params.sourceType,
        title: params.title,
        creator: params.creator,
        engagement: params.engagement,
        niche: params.niche,
        durationSeconds: params.durationSeconds,
        transcriptQuality: params.transcriptQuality,
        wordCount: params.wordCount,
        readTimeMinutes: params.readTimeMinutes,
        hadHeaders: params.hadHeaders,
        segmentedBeats,
      }),
    },
  ];

  const content = await callLLM(messages, 0.3);
  const structuralBreakdown = parseStructuralResponse(content);

  const sourceSpecific = {
    video: params.sourceType === "video"
      ? {
          duration_seconds: params.durationSeconds || 0,
          transcript_quality: params.transcriptQuality || "medium",
        }
      : null,
    article: params.sourceType === "article"
      ? {
          word_count: params.wordCount || 0,
          read_time_minutes: params.readTimeMinutes || 0,
          had_headers: params.hadHeaders || false,
        }
      : null,
  };

  const sourceMetadata = {
    video: params.sourceType === "video" ? params.videoMetadata || null : null,
    article: params.sourceType === "article" ? params.articleMetadata || null : null,
  };

  return { structuralBreakdown, sourceSpecific, sourceMetadata };
}
