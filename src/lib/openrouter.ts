import { cookies } from "next/headers";

async function getLlmConfig(): Promise<{ apiUrl: string; apiKey: string; model: string }> {
  try {
    const cookieStore = await cookies();
    const configCookie = cookieStore.get("tubeforge_llm_config");
    if (configCookie?.value) {
      const config = JSON.parse(configCookie.value);
      if (config.apiKey && config.apiEndpoint) {
        return {
          apiUrl: config.apiEndpoint,
          apiKey: config.apiKey,
          model: config.model || "Kimi-K2.6",
        };
      }
    }
  } catch {
    // cookies() throws outside server context — fall back to env
  }

  return {
    apiUrl: process.env.KIMI_API_ENDPOINT || "https://ai2.18.show/v1/chat/completions",
    apiKey: process.env.KIMI_API_KEY || "",
    model: process.env.KIMI_MODEL || "Kimi-K2.6",
  };
}

interface ApiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ApiResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export async function generateScript(
  videoTitle: string,
  videoDescription: string,
  tone: string,
  userVoice: string
): Promise<string> {
  const { apiUrl, apiKey, model } = await getLlmConfig();

  const messages: ApiMessage[] = [
    {
      role: "system",
      content: `You are an expert YouTube scriptwriter. Generate a compelling YouTube video script based on the provided video information. The script should be written in the user's unique voice and style.

Voice Profile: ${userVoice}

Format the script with clear sections:
- [HOOK - 0-10s]: Grab attention immediately
- [INTRO - 10-45s]: Set up the video's premise
- [MAIN BEATS]: The core content, broken into 3-5 sections
- [OUTRO + CTA - last 30s]: Wrap up and call to action

Keep the script engaging, conversational, and optimized for YouTube retention.`,
    },
    {
      role: "user",
      content: `Generate a ${tone} YouTube script based on this video:

Title: ${videoTitle}
Description: ${videoDescription}

Please provide the full script with section markers.`,
    },
  ];

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.8,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to generate script from API");
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const body = await response.text();
    console.error("[OpenRouter] Non-JSON response:", body.slice(0, 500));
    throw new Error(`Expected JSON but received ${contentType}`);
  }

  const data: ApiResponse = await response.json();
  return data.choices[0]?.message?.content || "";
}

export async function generateSocialPosts(
  videoTitle: string,
  videoDescription: string,
  platform: "x" | "instagram" | "facebook",
  userVoice: string
): Promise<string> {
  const { apiUrl, apiKey, model } = await getLlmConfig();

  const platformPrompts: Record<string, string> = {
    x: "Create a Twitter/X thread (5-8 tweets) that teases the video content and drives engagement.",
    instagram: "Create an Instagram caption with emojis, save/share bait, and 30 relevant hashtags.",
    facebook: "Create a conversational Facebook post that encourages discussion and sharing.",
  };

  const messages: ApiMessage[] = [
    {
      role: "system",
      content: `You are a social media expert. Generate platform-optimized content based on the video information. Write in the user's unique voice.

Voice Profile: ${userVoice}`,
    },
    {
      role: "user",
      content: `Generate a ${platform} post based on this video:

Title: ${videoTitle}
Description: ${videoDescription}

${platformPrompts[platform]}`,
    },
  ];

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.8,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to generate social post from API");
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const body = await response.text();
    console.error("[OpenRouter] Non-JSON response:", body.slice(0, 500));
    throw new Error(`Expected JSON but received ${contentType}`);
  }

  const data: ApiResponse = await response.json();
  return data.choices[0]?.message?.content || "";
}

export async function generateSeoPackage(
  videoTitle: string,
  videoDescription: string,
  existingTags: string[]
): Promise<{
  titles: string[];
  description: string;
  tags: string[];
  thumbnailIdeas: string[];
  chapters: string[];
  pinnedComment: string;
}> {
  const { apiUrl, apiKey, model } = await getLlmConfig();

  const messages: ApiMessage[] = [
    {
      role: "system",
      content: `You are an expert YouTube SEO specialist. Generate a complete SEO optimization package for a YouTube video.

Respond ONLY with a valid JSON object in this exact format:
{
  "titles": ["title 1", "title 2", "title 3", "title 4", "title 5"],
  "description": "optimized video description with timestamps and links",
  "tags": ["tag1", "tag2", ...],
  "thumbnailIdeas": ["idea 1", "idea 2", "idea 3"],
  "chapters": ["0:00 Intro", "1:30 Chapter Name", ...],
  "pinnedComment": "engaging pinned comment text"
}

Rules:
- Titles: 5 options, catchy, keyword-rich, under 60 chars each
- Description: SEO-optimized, include timestamps, CTAs, social links placeholder
- Tags: 15 relevant tags
- Thumbnail ideas: 3 descriptive concepts
- Chapters: 5-8 timestamped sections
- Pinned comment: engaging, asks a question or drives engagement`,
    },
    {
      role: "user",
      content: `Generate an SEO package for this video:

Title: ${videoTitle}
Description: ${videoDescription}
Existing Tags: ${existingTags.join(", ")}

Return ONLY the JSON object, no markdown formatting.`,
    },
  ];

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.8,
      max_tokens: 2500,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to generate SEO package from API");
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const body = await response.text();
    console.error("[OpenRouter] Non-JSON response:", body.slice(0, 500));
    throw new Error(`Expected JSON but received ${contentType}`);
  }

  const data: ApiResponse = await response.json();
  const content = data.choices[0]?.message?.content || "{}";

  // Clean up potential markdown code blocks
  const cleanJson = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    const parsed = JSON.parse(cleanJson);
    return {
      titles: parsed.titles || [],
      description: parsed.description || "",
      tags: parsed.tags || [],
      thumbnailIdeas: parsed.thumbnailIdeas || [],
      chapters: parsed.chapters || [],
      pinnedComment: parsed.pinnedComment || "",
    };
  } catch {
    // Fallback if JSON parsing fails
    return {
      titles: [videoTitle, `${videoTitle} - Tutorial`, `${videoTitle} Guide`, `How to ${videoTitle}`, `${videoTitle} Explained`],
      description: `Learn about ${videoTitle}.\n\nSubscribe for more content!`,
      tags: existingTags.length > 0 ? existingTags : ["youtube", "tutorial", "how to"],
      thumbnailIdeas: ["Close-up reaction shot", "Before/after split screen", "Bold text overlay"],
      chapters: ["0:00 Intro", "1:00 Main Topic", "5:00 Key Points", "8:00 Summary"],
      pinnedComment: `What did you think about ${videoTitle}? Let me know in the comments!`,
    };
  }
}

export async function regenerateSection(
  sectionType: string,
  currentScript: string,
  userVoice: string
): Promise<string> {
  const { apiUrl, apiKey, model } = await getLlmConfig();

  const messages: ApiMessage[] = [
    {
      role: "system",
      content: `You are an expert YouTube scriptwriter. Regenerate a specific section of a script while maintaining consistency with the rest. Voice: ${userVoice}`,
    },
    {
      role: "user",
      content: `Regenerate the [${sectionType}] section of this script:

${currentScript}

Please provide only the new ${sectionType} section.`,
    },
  ];

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.9,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to regenerate section from API");
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const body = await response.text();
    console.error("[OpenRouter] Non-JSON response:", body.slice(0, 500));
    throw new Error(`Expected JSON but received ${contentType}`);
  }

  const data: ApiResponse = await response.json();
  return data.choices[0]?.message?.content || "";
}
