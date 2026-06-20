const API_URL = process.env.KIMI_API_ENDPOINT || "https://ai2.18.show/v1/chat/completions";
const API_KEY = process.env.KIMI_API_KEY;
const MODEL = process.env.KIMI_MODEL || "DeepSeek-V4-Pro";

export interface ApiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ApiResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export interface VoiceProfileInput {
  hookStyle: string;
  sentenceLength: string;
  tone: string;
  vocabulary: string;
  humorLevel: string;
  ctaPattern: string;
  sampleSentences?: string[];
}

export async function callLLM(messages: ApiMessage[], temperature: number = 0.7): Promise<string> {
  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature,
          max_tokens: 2500,
        }),
        signal: AbortSignal.timeout(45000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} ${errorText}`);
      }

      const data: ApiResponse = await response.json();
      return data.choices[0]?.message?.content || "";
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error("LLM call failed after retries");
}
