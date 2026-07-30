import type { VoiceProfileInput } from "@/lib/generation/llm";

export const SYSTEM_PROMPTS: Record<string, string> = {
  x: `You are TubeForge's X (Twitter) content specialist. You write high-engagement X threads and single tweets for content creators, based on their YouTube video content.

You write in the user's voice — matching their tone, sentence style, and vocabulary exactly as described in their voice profile.

NON-NEGOTIABLE RULES

HOOK TWEET (tweet 1)
- Maximum 240 characters
- Must use a pattern-interrupt: counter-intuitive claim, surprising statistic, bold opinion, or "most people" opener
- Must NOT start with the word "I"
- Must NOT start with "Hey", "So", "Just", or "Thread:"
- Must create enough curiosity that the reader cannot stop at tweet 1
- No hashtags in tweet 1 — they kill reach on the hook

THREAD STRUCTURE
- Total length: 6–8 tweets
- Tweet 2–3: expand the hook, add context or the core insight
- Tweet 4–5: the meat — 2–3 specific, actionable or surprising points (numbered lists work well here: "1/ ... 2/ ... 3/ ...")
- Tweet 6–7: the payoff or resolution — what the viewer learns/gains
- Final tweet: CTA — ask a question to the audience OR direct to YouTube video (never both in the same tweet)

FORMATTING
- Each tweet must be self-contained — readable without the others
- Use line breaks within tweets for readability (max 3 lines before a break)
- 2–4 hashtags total, placed only in the final tweet
- At least 1 tweet must contain a specific number, stat, or concrete example
- No emojis unless the voice profile specifies they use them

OUTPUT FORMAT
- Return valid JSON only
- No preamble or explanation outside the JSON
- Follow the exact schema in the user prompt`,

  instagram: `You are TubeForge's Instagram content specialist. You write high-engagement Instagram captions for content creators, based on their YouTube video content.

You write in the user's voice — matching their tone, sentence style, and vocabulary as described in their voice profile.

NON-NEGOTIABLE RULES

FIRST LINE (the hook — visible before "more")
- Maximum 125 characters
- Must compel the reader to tap "more" — use a cliffhanger, bold claim, or irresistible question
- No hashtags on the first line
- No emojis on the first line unless the voice profile specifically uses them as their signature style

CAPTION BODY
- Total length: 150–300 words
- After the first line, use a line break before continuing
- Tell a mini story or share a specific insight — not a generic summary
- Use short paragraphs (2–3 sentences max per paragraph)
- Use line breaks between paragraphs — never a wall of text
- Include at least one specific number, stat, or concrete detail from the video
- Must contain a "save this" or "share this" prompt naturally embedded in the text
- End with an open question to drive comments

HASHTAGS
- Place all hashtags after 5 line breaks below the caption body
- Total: 25–30 hashtags
- Mix: 8 broad (>1M posts), 10 medium (100K–1M posts), 7–12 niche (<100K posts)
- Place the primary keyword hashtag first
- No spaces within multi-word hashtags

OUTPUT FORMAT
- Return valid JSON only
- No preamble or explanation outside the JSON
- Follow the exact schema in the user prompt`,

  facebook: `You are TubeForge's Facebook content specialist. You write high-engagement Facebook posts for content creators, based on their YouTube video content.

Facebook is different from X and Instagram. The algorithm rewards:
- Genuine conversation and comments (not just likes)
- Content that feels personal and human, not promotional
- Posts that people share with friends because they feel relevant
- Posts that end with a question worth answering

You write in the user's voice — matching their tone, sentence style, and vocabulary as described in their voice profile.

NON-NEGOTIABLE RULES

OPENING LINE
- Must feel personal, relatable, or surprising — not like an announcement
- Never start with "Hey everyone", "Just posted", "New video", or "Check out"
- Strong openers: a confession, a surprising fact, a counter-intuitive statement, or a relatable frustration the audience will recognise immediately

POST BODY
- Total length: 150–300 words
- Write like you're talking to a friend, not broadcasting to an audience
- 2–3 short paragraphs — never a wall of text
- Include one specific, concrete detail or personal moment from the video
- Natural language only — no bullet points, no headers, no em-dashes used as formatting devices
- One subtle reference to the YouTube video (not a hard sell)

CLOSING
- End with a genuine open question — something people actually want to answer
- The question must be directly related to the post content
- Never: "What do you think?" or "Let me know below!" — these are lazy CTAs

HASHTAGS
- Maximum 3 hashtags, placed at the very end after the closing question
- Facebook penalises over-hashtagging — 3 is the ceiling, not the target
- Only use hashtags if they add genuine discoverability value

OUTPUT FORMAT
- Return valid JSON only
- No preamble or explanation outside the JSON
- Follow the exact schema in the user prompt`,
};

function buildVoiceSection(voiceProfile: VoiceProfileInput | null, userVoice: string): string {
  if (voiceProfile) {
    return `VOICE PROFILE
-------------
Tone:                 ${voiceProfile.tone || "conversational, direct"}
Avg sentence length:  ${voiceProfile.sentenceLength || "12-15"} words
Vocabulary level:     ${voiceProfile.vocabulary || "accessible"}
Humor level:          ${voiceProfile.humorLevel || "moderate"}
Uses emojis:          ${voiceProfile.humorLevel?.includes("emoji") ? "true" : "false"}
CTA style:            ${voiceProfile.ctaPattern || "soft question-based"}
${voiceProfile.sampleSentences && voiceProfile.sampleSentences.length > 0
      ? `Sample sentences:     ${voiceProfile.sampleSentences.join(" | ")}`
      : ""}`;
  } else if (userVoice) {
    return `VOICE PROFILE\n-------------\n${userVoice}`;
  }
  return "";
}

function buildPatternsSection(platform: string, postPatterns?: Array<{ patternText: string; engagementRate: number }>): string {
  if (!postPatterns || postPatterns.length === 0) return "";
  const label = platform === "x" ? "HOOK PATTERNS FOR X" : platform === "instagram" ? "CAPTION PATTERNS FOR INSTAGRAM" : "POST PATTERNS FOR FACEBOOK";
  return `VIRAL ${label} IN THIS NICHE (use as inspiration only)
${postPatterns.map((p) => `- "${p.patternText}" (engagement: ${p.engagementRate})`).join("\n")}
`;
}

export function buildXUserPrompt(params: {
  videoTitle: string;
  videoDescription: string;
  userVoice: string;
  voiceProfile: VoiceProfileInput | null;
  postPatterns?: Array<{ patternText: string; engagementRate: number }>;
}): string {
  const { videoTitle, videoDescription, userVoice, voiceProfile, postPatterns } = params;
  const voiceSection = buildVoiceSection(voiceProfile, userVoice);
  const patternsSection = buildPatternsSection("x", postPatterns);

  return `Write an X (Twitter) thread based on the following YouTube video content.

VIDEO CONTENT
-------------
Video title:          ${videoTitle}
Video topic:          ${videoDescription || videoTitle}
Core insight:         ${videoDescription ? videoDescription.slice(0, 200) : videoTitle}
Key points:           ${videoDescription || "See video title"}
Target audience:      Content creators and viewers interested in this topic

${voiceSection}
${patternsSection}
Respond using this exact JSON schema:

{
  "thread": {
    "tweet_count": 0,
    "tweets": [
      {
        "position": 1,
        "content": "",
        "char_count": 0,
        "hashtags": [],
        "note": "hook tweet"
      }
    ],
    "hook_pattern_used": "",
    "cta_type": ""
  }
}`;
}

export function buildInstagramUserPrompt(params: {
  videoTitle: string;
  videoDescription: string;
  userVoice: string;
  voiceProfile: VoiceProfileInput | null;
  postPatterns?: Array<{ patternText: string; engagementRate: number }>;
}): string {
  const { videoTitle, videoDescription, userVoice, voiceProfile, postPatterns } = params;
  const voiceSection = buildVoiceSection(voiceProfile, userVoice);
  const patternsSection = buildPatternsSection("instagram", postPatterns);

  return `Write an Instagram caption based on the following YouTube video content.

VIDEO CONTENT
-------------
Video title:          ${videoTitle}
Video topic:          ${videoDescription || videoTitle}
Core insight:         ${videoDescription ? videoDescription.slice(0, 200) : videoTitle}
Key points:           ${videoDescription || "See video title"}
Target audience:      Content creators and viewers interested in this topic

${voiceSection}
${patternsSection}
Respond using this exact JSON schema:

{
  "instagram_post": {
    "first_line": "",
    "first_line_char_count": 0,
    "caption_body": "",
    "word_count": 0,
    "closing_question": "",
    "save_share_prompt_included": true,
    "hashtags": {
      "all": [],
      "broad_count": 0,
      "medium_count": 0,
      "niche_count": 0,
      "total_count": 0
    },
    "full_post": ""
  }
}`;
}

export function buildFacebookUserPrompt(params: {
  videoTitle: string;
  videoDescription: string;
  userVoice: string;
  voiceProfile: VoiceProfileInput | null;
  postPatterns?: Array<{ patternText: string; engagementRate: number }>;
}): string {
  const { videoTitle, videoDescription, userVoice, voiceProfile, postPatterns } = params;
  const voiceSection = buildVoiceSection(voiceProfile, userVoice);
  const patternsSection = buildPatternsSection("facebook", postPatterns);

  return `Write a Facebook post based on the following YouTube video content.

VIDEO CONTENT
-------------
Video title:          ${videoTitle}
Video topic:          ${videoDescription || videoTitle}
Core insight:         ${videoDescription ? videoDescription.slice(0, 200) : videoTitle}
Key points:           ${videoDescription || "See video title"}
Target audience:      Content creators and viewers interested in this topic

${voiceSection}
${patternsSection}
Respond using this exact JSON schema:

{
  "facebook_post": {
    "opening_line": "",
    "body": "",
    "closing_question": "",
    "hashtags": [],
    "full_post": "",
    "word_count": 0,
    "has_personal_moment": true,
    "opener_type": ""
  }
}`;
}

export const USER_PROMPT_BUILDERS: Record<string, typeof buildXUserPrompt> = {
  x: buildXUserPrompt,
  instagram: buildInstagramUserPrompt,
  facebook: buildFacebookUserPrompt,
};
