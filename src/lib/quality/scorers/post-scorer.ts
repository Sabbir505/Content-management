import type { QualityScore } from "../types";
import { stampScore } from "../version";
import { getGrade } from "../constants";
import {
  PATTERN_INTERRUPT_REGEX,
  SHAREABILITY_REGEX,
  GENERIC_OPENERS_REGEX,
  CTA_REGEX,
} from "../constants";

// ---- Shared Helpers ----

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w-]+/g);
  return matches || [];
}

function buildScore(breakdown: QualityScore["breakdown"], totalScore: number): QualityScore {
  const suggestions: string[] = [];
  for (const category of Object.values(breakdown)) {
    for (const issue of category.issues) {
      suggestions.push(issue);
    }
  }
  const grade = getGrade(totalScore);
  return stampScore({
    score: totalScore,
    grade: grade.grade,
    passedThreshold: totalScore >= 60,
    breakdown,
    suggestions,
  });
}

// ---- X / Twitter Scorer ----

interface XThreadOutput {
  thread: {
    tweet_count: number;
    tweets: {
      position: number;
      content: string;
      char_count?: number;
      hashtags?: string[];
    }[];
  };
}

export function scoreXPost(output: XThreadOutput): QualityScore {
  const breakdown: QualityScore["breakdown"] = {};
  let totalScore = 0;

  const tweets = output.thread?.tweets || [];
  const firstTweet = tweets[0];
  const lastTweet = tweets[tweets.length - 1];
  const allText = tweets.map((t) => t.content).join(" ");

  // ---- Hook Tweet (40 points) ----
  let hookScore = 0;
  const hookIssues: string[] = [];

  if (firstTweet) {
    const firstLen = firstTweet.char_count || firstTweet.content.length;

    // First tweet <= 240 chars (15 pts)
    if (firstLen <= 240) {
      hookScore += 15;
    } else {
      hookIssues.push(
        `First tweet is ${firstLen} chars — keep under 240`
      );
      if (firstLen <= 280) hookScore += 7;
    }

    // Pattern-interrupt (15 pts)
    if (
      PATTERN_INTERRUPT_REGEX.test(firstTweet.content) ||
      /\?$/.test(firstTweet.content.trim()) ||
      /\d+%/.test(firstTweet.content)
    ) {
      hookScore += 15;
    } else {
      hookIssues.push(
        "First tweet lacks a pattern-interrupt (question, bold claim, stat, 'most people' opener)"
      );
    }

    // Does NOT start with "I" (10 pts)
    const trimmed = firstTweet.content.trim();
    if (!/^I\b/i.test(trimmed)) {
      hookScore += 10;
    } else {
      hookIssues.push("First tweet starts with 'I' — 'I' openers underperform");
    }
  } else {
    hookIssues.push("No tweets found");
  }

  breakdown.hook_tweet = { score: hookScore, max: 40, issues: hookIssues };
  totalScore += hookScore;

  // ---- Thread Structure (35 points) ----
  let structureScore = 0;
  const structureIssues: string[] = [];

  // Thread length 5-8 tweets (15 pts)
  const tweetCount = tweets.length;
  if (tweetCount >= 5 && tweetCount <= 8) {
    structureScore += 15;
  } else {
    structureIssues.push(
      `Thread has ${tweetCount} tweets — aim for 5–8`
    );
    if (tweetCount >= 3 && tweetCount <= 10) structureScore += 7;
  }

  // Final tweet has CTA (10 pts)
  if (lastTweet) {
    if (CTA_REGEX.test(lastTweet.content) || /\?$/.test(lastTweet.content.trim())) {
      structureScore += 10;
    } else {
      structureIssues.push("Final tweet lacks a CTA or question");
    }
  }

  // At least 1 tweet contains a number/statistic (10 pts)
  if (/\d+%|\d+\s*(million|billion|thousand)|\d+\s*people|\d+\/\d+/.test(allText)) {
    structureScore += 10;
  } else {
    structureIssues.push(
      "No tweet contains a specific number or statistic"
    );
  }

  breakdown.thread_structure = {
    score: structureScore,
    max: 35,
    issues: structureIssues,
  };
  totalScore += structureScore;

  // ---- Engagement Signals (25 points) ----
  let engagementScore = 0;
  const engagementIssues: string[] = [];

  // Thread ends with question (15 pts)
  if (lastTweet && /\?$/.test(lastTweet.content.trim())) {
    engagementScore += 15;
  } else {
    engagementIssues.push(
      "Thread doesn't end with a question — questions drive replies"
    );
  }

  // 2-4 hashtags (10 pts)
  const allHashtags = tweets.flatMap(
    (t) => t.hashtags || extractHashtags(t.content)
  );
  if (allHashtags.length >= 2 && allHashtags.length <= 4) {
    engagementScore += 10;
  } else if (allHashtags.length > 0) {
    engagementIssues.push(
      `${allHashtags.length} hashtags used — aim for 2–4`
    );
    if (allHashtags.length === 1 || allHashtags.length === 5)
      engagementScore += 5;
  }

  breakdown.engagement = {
    score: engagementScore,
    max: 25,
    issues: engagementIssues,
  };
  totalScore += engagementScore;

  return buildScore(breakdown, totalScore);
}

// ---- Instagram Scorer ----

interface InstagramOutput {
  instagram_post: {
    first_line: string;
    first_line_char_count?: number;
    caption_body: string;
    word_count?: number;
    closing_question?: string;
    save_share_prompt_included?: boolean;
    hashtags: {
      all: string[];
      broad_count?: number;
      medium_count?: number;
      niche_count?: number;
      total_count?: number;
    };
    full_post?: string;
  };
}

export function scoreInstagramPost(output: InstagramOutput): QualityScore {
  const breakdown: QualityScore["breakdown"] = {};
  let totalScore = 0;

  const post = output.instagram_post;
  const firstLine = post.first_line || "";
  const body = post.caption_body || "";
  const fullText = firstLine + "\n" + body;
  const hashtags = post.hashtags?.all || [];
  const totalWords = post.word_count || wordCount(fullText);

  // ---- Caption Structure (40 points) ----
  let structureScore = 0;
  const structureIssues: string[] = [];

  // First line <= 125 chars (20 pts)
  const firstLen = post.first_line_char_count || firstLine.length;
  if (firstLen <= 125) {
    structureScore += 20;
  } else {
    structureIssues.push(
      `First line is ${firstLen} chars — keep under 125 (before 'more' cutoff)`
    );
    if (firstLen <= 150) structureScore += 10;
  }

  // Caption length 150-300 words (10 pts)
  if (totalWords >= 150 && totalWords <= 300) {
    structureScore += 10;
  } else if (totalWords > 0) {
    structureIssues.push(
      `Caption is ${totalWords} words — aim for 150–300`
    );
    if (totalWords >= 100 && totalWords <= 350) structureScore += 5;
  }

  // Ends with question or CTA (10 pts)
  const closingQuestion = post.closing_question || "";
  const lastSentence = fullText.split(/[.!?]+/).filter(Boolean).pop() || "";
  if (
    /\?$/.test(lastSentence.trim()) ||
    CTA_REGEX.test(lastSentence) ||
    closingQuestion
  ) {
    structureScore += 10;
  } else {
    structureIssues.push("Caption doesn't end with a question or CTA");
  }

  breakdown.caption_structure = {
    score: structureScore,
    max: 40,
    issues: structureIssues,
  };
  totalScore += structureScore;

  // ---- Hashtags (35 points) ----
  let hashtagScore = 0;
  const hashtagIssues: string[] = [];

  // Hashtag count 20-30 (20 pts)
  const hashtagCount = post.hashtags?.total_count || hashtags.length;
  if (hashtagCount >= 20 && hashtagCount <= 30) {
    hashtagScore += 20;
  } else if (hashtagCount > 0) {
    hashtagIssues.push(
      `${hashtagCount} hashtags — aim for 20–30`
    );
    if (hashtagCount >= 15 && hashtagCount <= 35) hashtagScore += 10;
  }

  // Mix of tiers (15 pts)
  const broadCount = post.hashtags?.broad_count || 0;
  const mediumCount = post.hashtags?.medium_count || 0;
  const nicheCount = post.hashtags?.niche_count || 0;

  if (broadCount > 0 && mediumCount > 0 && nicheCount > 0) {
    hashtagScore += 15;
  } else if (hashtagCount > 0) {
    hashtagIssues.push(
      "Hashtags lack tier diversity — mix broad (>1M), medium (100K–1M), and niche (<100K)"
    );
    if (broadCount > 0 || mediumCount > 0) hashtagScore += 7;
  }

  breakdown.hashtags = {
    score: hashtagScore,
    max: 35,
    issues: hashtagIssues,
  };
  totalScore += hashtagScore;

  // ---- Engagement Signals (25 points) ----
  let engagementScore = 0;
  const engagementIssues: string[] = [];

  // Save/share bait (15 pts)
  if (
    post.save_share_prompt_included ||
    SHAREABILITY_REGEX.test(fullText)
  ) {
    engagementScore += 15;
  } else {
    engagementIssues.push(
      "No save/share bait — add 'save this', 'share with someone', or 'send this to'"
    );
  }

  // Line breaks for readability (10 pts)
  const lineBreakCount = (fullText.match(/\n/g) || []).length;
  if (lineBreakCount >= 5) {
    engagementScore += 10;
  } else {
    engagementIssues.push(
      "Not enough line breaks — use 5+ for readability (no wall of text)"
    );
    if (lineBreakCount >= 3) engagementScore += 5;
  }

  breakdown.engagement = {
    score: engagementScore,
    max: 25,
    issues: engagementIssues,
  };
  totalScore += engagementScore;

  return buildScore(breakdown, totalScore);
}

// ---- Facebook Scorer ----

interface FacebookOutput {
  facebook_post: {
    opening_line: string;
    body: string;
    closing_question?: string;
    hashtags: string[];
    full_post?: string;
    word_count?: number;
    has_personal_moment?: boolean;
    opener_type?: string;
  };
}

export function scoreFacebookPost(output: FacebookOutput): QualityScore {
  const breakdown: QualityScore["breakdown"] = {};
  let totalScore = 0;

  const post = output.facebook_post;
  const openingLine = post.opening_line || "";
  const body = post.body || "";
  const fullText = openingLine + "\n" + body;
  const hashtags = post.hashtags || [];
  const totalWords = post.word_count || wordCount(fullText);

  // ---- Post Structure (50 points) ----
  let structureScore = 0;
  const structureIssues: string[] = [];

  // Opens with hook, not generic (20 pts)
  if (GENERIC_OPENERS_REGEX.test(openingLine.trim())) {
    structureIssues.push(
      "Opens with a generic phrase — avoid 'Hey everyone', 'Just posted', etc."
    );
  } else if (openingLine.trim().length > 0) {
    structureScore += 20;
  } else {
    structureIssues.push("No clear opening line");
  }

  // Length 150-350 words (15 pts)
  if (totalWords >= 150 && totalWords <= 350) {
    structureScore += 15;
  } else if (totalWords > 0) {
    structureIssues.push(
      `Post is ${totalWords} words — aim for 150–350`
    );
    if (totalWords >= 100 && totalWords <= 400) structureScore += 7;
  }

  // Ends with open question (15 pts)
  const closingQuestion = post.closing_question || "";
  const lastSentence = fullText.split(/[.!?]+/).filter(Boolean).pop() || "";
  if (
    /\?$/.test(lastSentence.trim()) ||
    closingQuestion
  ) {
    structureScore += 15;
  } else {
    structureIssues.push(
      "Post doesn't end with a question — questions drive comments on Facebook"
    );
  }

  breakdown.post_structure = {
    score: structureScore,
    max: 50,
    issues: structureIssues,
  };
  totalScore += structureScore;

  // ---- Engagement Signals (50 points) ----
  let engagementScore = 0;
  const engagementIssues: string[] = [];

  // Personal/story element (20 pts)
  if (
    post.has_personal_moment ||
    /\b(i |my |me |we |our )/i.test(fullText)
  ) {
    engagementScore += 20;
  } else {
    engagementIssues.push(
      "Post lacks a personal or story element — Facebook rewards personal content"
    );
  }

  // <= 3 hashtags (15 pts)
  if (hashtags.length <= 3) {
    engagementScore += 15;
  } else {
    engagementIssues.push(
      `${hashtags.length} hashtags — Facebook penalizes over-hashtagging (max 3)`
    );
  }

  // Shareability hook (15 pts)
  if (SHAREABILITY_REGEX.test(fullText)) {
    engagementScore += 15;
  } else {
    engagementIssues.push(
      "No shareability hook — add 'most people don't know', 'share this if', etc."
    );
  }

  breakdown.engagement = {
    score: engagementScore,
    max: 50,
    issues: engagementIssues,
  };
  totalScore += engagementScore;

  return buildScore(breakdown, totalScore);
}

// ---- Dispatcher ----

export function scorePost(
  output: unknown,
  platform: "x" | "instagram" | "facebook"
): QualityScore {
  switch (platform) {
    case "x":
      return scoreXPost(output as XThreadOutput);
    case "instagram":
      return scoreInstagramPost(output as InstagramOutput);
    case "facebook":
      return scoreFacebookPost(output as FacebookOutput);
  }
}
