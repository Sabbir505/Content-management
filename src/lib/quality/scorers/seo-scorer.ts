import type { QualityScore, GoogleTrendsResult } from "../types";
import { stampScore } from "../version";
import { getGrade } from "../constants";
import { POWER_WORDS_REGEX } from "../constants";

interface SeoOutput {
  titles: { rank: number; text: string; char_count?: number }[];
  description: { full_text: string; word_count?: number } | string;
  tags: { tag: string; tier?: string }[] | string[];
  chapters?: { timestamp: string; title: string }[] | string[];
}

function getDescriptionText(desc: SeoOutput["description"]): string {
  return typeof desc === "string" ? desc : desc.full_text || "";
}

function getTagStrings(tags: SeoOutput["tags"]): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.map((t) => (typeof t === "string" ? t : t.tag));
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function getFirstNWords(text: string, n: number): string {
  return text.trim().split(/\s+/).slice(0, n).join(" ");
}

export function scoreSEO(
  output: SeoOutput,
  trendsData: GoogleTrendsResult | null,
  primaryKeyword?: string
): QualityScore {
  const breakdown: QualityScore["breakdown"] = {};
  const suggestions: string[] = [];
  let totalScore = 0;

  // ---- Title (35 points) ----
  const titleText = output.titles?.[0]?.text || "";
  let titleScore = 0;
  const titleIssues: string[] = [];

  // Primary keyword in first 4 words (15 pts)
  if (primaryKeyword && titleText) {
    const first4 = getFirstNWords(titleText, 4).toLowerCase();
    if (first4.includes(primaryKeyword.toLowerCase())) {
      titleScore += 15;
    } else {
      titleIssues.push("Primary keyword not in first 4 words of title");
    }
  } else {
    titleScore += 15; // No keyword to check, give benefit of doubt
  }

  // Title length 40-60 characters (10 pts)
  const titleLen = titleText.length;
  if (titleLen >= 40 && titleLen <= 60) {
    titleScore += 10;
  } else if (titleLen > 0) {
    titleIssues.push(
      titleLen < 40
        ? `Title is ${titleLen} chars — too short (aim for 40–60)`
        : `Title is ${titleLen} chars — too long (aim for 40–60)`
    );
    if (titleLen >= 35 && titleLen <= 65) {
      titleScore += 5; // Partial credit
    }
  }

  // Power word or number (10 pts)
  if (POWER_WORDS_REGEX.test(titleText) || /\d/.test(titleText)) {
    titleScore += 10;
  } else {
    titleIssues.push("Title lacks a power word or number");
  }

  breakdown.title = { score: titleScore, max: 35, issues: titleIssues };
  totalScore += titleScore;

  // ---- Description (25 points) ----
  const descText = getDescriptionText(output.description);
  let descScore = 0;
  const descIssues: string[] = [];

  // Primary keyword in first 25 words (10 pts)
  if (primaryKeyword && descText) {
    const first25 = getFirstNWords(descText, 25).toLowerCase();
    if (first25.includes(primaryKeyword.toLowerCase())) {
      descScore += 10;
    } else {
      descIssues.push("Primary keyword not in first 25 words of description");
    }
  } else {
    descScore += 10;
  }

  // Description length >= 200 words (8 pts)
  const descWords = wordCount(descText);
  if (descWords >= 200) {
    descScore += 8;
  } else if (descWords > 0) {
    descIssues.push(
      `Description is ${descWords} words — aim for 200+ words`
    );
    if (descWords >= 100) descScore += 4;
  }

  // Contains timestamps/chapters (7 pts)
  const hasTimestamps = /\d+:\d{2}/.test(descText);
  if (hasTimestamps) {
    descScore += 7;
  } else {
    descIssues.push("Description lacks timestamps/chapters");
  }

  breakdown.description = { score: descScore, max: 25, issues: descIssues };
  totalScore += descScore;

  // ---- Tags (20 points) ----
  const tags = getTagStrings(output.tags);
  let tagScore = 0;
  const tagIssues: string[] = [];

  // Tag count 15-20 (10 pts)
  if (tags.length >= 15 && tags.length <= 20) {
    tagScore += 10;
  } else if (tags.length > 0) {
    tagIssues.push(
      `Tag count is ${tags.length} — aim for 15–20 tags`
    );
    if (tags.length >= 10 && tags.length <= 25) tagScore += 5;
  }

  // At least 3 tags match Google Trends top keywords (10 pts)
  if (trendsData) {
    const trendsKeywords = [
      trendsData.primaryKeyword,
      ...trendsData.recommendedTags,
      ...trendsData.relatedRising,
      ...trendsData.relatedTop,
    ].map((k) => k.toLowerCase());

    const matchingTags = tags.filter((t) =>
      trendsKeywords.some((tk) => t.toLowerCase().includes(tk) || tk.includes(t.toLowerCase()))
    );

    if (matchingTags.length >= 3) {
      tagScore += 10;
    } else {
      tagIssues.push(
        `Only ${matchingTags.length} tags match trending keywords — aim for 3+`
      );
      if (matchingTags.length >= 1) tagScore += 3;
    }
  } else {
    tagScore += 10; // No trends data, give benefit of doubt
  }

  breakdown.tags = { score: tagScore, max: 20, issues: tagIssues };
  totalScore += tagScore;

  // ---- Keyword Data (20 points) ----
  let kwScore = 0;
  const kwIssues: string[] = [];

  if (trendsData) {
    // Search score >= 40 (10 pts)
    if (trendsData.searchScore >= 40) {
      kwScore += 10;
    } else {
      kwIssues.push(
        `Search score is ${trendsData.searchScore}/100 — below 40 threshold`
      );
      if (trendsData.searchScore >= 20) kwScore += 5;
    }

    // Trend direction stable or rising (10 pts)
    if (trendsData.trendDirection !== "falling") {
      kwScore += 10;
    } else {
      kwIssues.push(
        `Trend direction is falling for '${trendsData.primaryKeyword}'`
      );
    }
  } else {
    kwScore += 10; // No trends data
  }

  breakdown.keyword_data = { score: kwScore, max: 20, issues: kwIssues };
  totalScore += kwScore;

  // ---- Build suggestions ----
  for (const category of Object.values(breakdown)) {
    for (const issue of category.issues) {
      suggestions.push(issue);
    }
  }

  // Add trends-based suggestions
  if (trendsData && trendsData.recommendedTags.length > 0) {
    const unusedTrending = trendsData.recommendedTags.filter(
      (rt) => !tags.some((t) => t.toLowerCase().includes(rt.toLowerCase()))
    );
    if (unusedTrending.length > 0) {
      suggestions.push(
        `Consider adding trending tags: ${unusedTrending.slice(0, 3).join(", ")}`
      );
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
