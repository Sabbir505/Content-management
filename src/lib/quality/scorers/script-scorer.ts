import type { QualityScore, ViralHookPattern } from "../types";
import { stampScore } from "../version";
import { getGrade } from "../constants";
import { CTA_REGEX, HOOK_PATTERNS, FORMAT_RANGES } from "../constants";
import { computeVocabularyOverlap, averageSentenceLength } from "../tfidf";

interface ScriptOutput {
  script: {
    title_suggestion?: string;
    total_word_count?: number;
    sections: {
      label: string;
      word_count?: number;
      content: string;
    }[];
    hook_type_used?: string;
    cta_used?: string;
  };
}

interface VoiceProfileInput {
  avgSentenceLength: number;
  vocabulary: string;
  tone: string;
  sampleSentences: string[];
}

export function scoreScript(
  output: ScriptOutput,
  voiceProfile: VoiceProfileInput | null,
  hookPatterns: ViralHookPattern[],
  format: "long-form" | "shorts" = "long-form"
): QualityScore {
  const breakdown: QualityScore["breakdown"] = {};
  const suggestions: string[] = [];
  let totalScore = 0;

  const script = output.script;
  const sections = script.sections || [];
  const hookSection = sections.find(
    (s) => s.label.toUpperCase().includes("HOOK")
  );
  const outroSection = sections.find(
    (s) =>
      s.label.toUpperCase().includes("OUTRO") ||
      s.label.toUpperCase().includes("CTA")
  );
  const beatSections = sections.filter(
    (s) =>
      !s.label.toUpperCase().includes("HOOK") &&
      !s.label.toUpperCase().includes("OUTRO") &&
      !s.label.toUpperCase().includes("CTA") &&
      !s.label.toUpperCase().includes("INTRO")
  );
  const allContent = sections.map((s) => s.content).join(" ");
  const totalWords =
    script.total_word_count || allContent.trim().split(/\s+/).length;

  // ---- Hook Quality (30 points) ----
  let hookScore = 0;
  const hookIssues: string[] = [];

  if (hookSection) {
    const hookWords =
      hookSection.word_count ||
      hookSection.content.trim().split(/\s+/).length;

    // Hook <= 35 words (15 pts)
    if (hookWords <= 35) {
      hookScore += 15;
    } else {
      hookIssues.push(
        `Hook is ${hookWords} words — aim for under 35 words`
      );
      if (hookWords <= 50) hookScore += 7;
    }

    // Hook uses proven pattern (15 pts)
    const hookText = hookSection.content;
    let patternMatched = false;
    for (const [, regex] of Object.entries(HOOK_PATTERNS)) {
      if (regex.test(hookText)) {
        patternMatched = true;
        break;
      }
    }
    // Also check against viral hook patterns
    if (!patternMatched && hookPatterns.length > 0) {
      patternMatched = hookPatterns.some((p) => {
        const hookWords = p.hookText.toLowerCase().split(/\s+/).slice(0, 5);
        return hookWords.some((w) =>
          hookText.toLowerCase().includes(w)
        );
      });
    }

    if (patternMatched) {
      hookScore += 15;
    } else {
      hookIssues.push(
        "Hook doesn't match a proven pattern (question, bold claim, statistic, story, counter-intuitive)"
      );
    }
  } else {
    hookIssues.push("No hook section found in script");
  }

  breakdown.hook = { score: hookScore, max: 30, issues: hookIssues };
  totalScore += hookScore;

  // ---- Structure Completeness (30 points) ----
  let structureScore = 0;
  const structureIssues: string[] = [];

  // 3-5 clearly defined beats (15 pts)
  const beatCount = beatSections.length;
  if (beatCount >= 3 && beatCount <= 5) {
    structureScore += 15;
  } else {
    structureIssues.push(
      beatCount < 3
        ? `Only ${beatCount} content beats — aim for 3–5`
        : `${beatCount} content beats — aim for 3–5 (too many can feel unfocused)`
    );
    if (beatCount >= 2 && beatCount <= 6) structureScore += 7;
  }

  // Outro and CTA (15 pts)
  if (outroSection) {
    const outroText = outroSection.content;
    if (CTA_REGEX.test(outroText)) {
      structureScore += 15;
    } else {
      structureIssues.push("No clear CTA found in outro");
      structureScore += 5; // Has outro but no CTA
    }
  } else {
    structureIssues.push("No outro/CTA section found");
  }

  breakdown.structure = {
    score: structureScore,
    max: 30,
    issues: structureIssues,
  };
  totalScore += structureScore;

  // ---- Length & Pacing (20 points) ----
  let pacingScore = 0;
  const pacingIssues: string[] = [];

  const range = FORMAT_RANGES[format] || FORMAT_RANGES["long-form"];

  // Word count in target range (10 pts)
  if (totalWords >= range.min && totalWords <= range.max) {
    pacingScore += 10;
  } else if (totalWords > 0) {
    pacingIssues.push(
      `Total word count is ${totalWords} — target range is ${range.min}–${range.max}`
    );
    // Partial credit if within 30% of range
    const midPoint = (range.min + range.max) / 2;
    const deviation = Math.abs(totalWords - midPoint) / midPoint;
    if (deviation < 0.3) pacingScore += 5;
  }

  // Section balance — no section > 45% of total (10 pts)
  if (totalWords > 0 && sections.length > 0) {
    const maxSectionRatio = Math.max(
      ...sections.map((s) => {
        const sw =
          s.word_count || s.content.trim().split(/\s+/).length;
        return sw / totalWords;
      })
    );

    if (maxSectionRatio <= 0.45) {
      pacingScore += 10;
    } else {
      const worstSection = sections.reduce((worst, s) => {
        const sw =
          s.word_count || s.content.trim().split(/\s+/).length;
        const ratio = sw / totalWords;
        return ratio > (worst?.ratio || 0) ? { label: s.label, ratio } : worst;
      }, null as { label: string; ratio: number } | null);

      pacingIssues.push(
        `Section "${worstSection?.label}" is ${Math.round(
          (worstSection?.ratio || 0) * 100
        )}% of total — keep each section under 45%`
      );
      if (maxSectionRatio <= 0.55) pacingScore += 5;
    }
  }

  breakdown.pacing = { score: pacingScore, max: 20, issues: pacingIssues };
  totalScore += pacingScore;

  // ---- Voice Consistency (20 points) ----
  let voiceScore = 0;
  const voiceIssues: string[] = [];

  if (voiceProfile && allContent.trim()) {
    // Sentence length within +/-30% of profile baseline (10 pts)
    const generatedAvgLen = averageSentenceLength(allContent);
    const profileAvgLen = voiceProfile.avgSentenceLength || 15;
    const sentenceDeviation =
      Math.abs(generatedAvgLen - profileAvgLen) / profileAvgLen;

    if (sentenceDeviation <= 0.3) {
      voiceScore += 10;
    } else {
      voiceIssues.push(
        `Avg sentence length is ${generatedAvgLen} words — user's baseline is ${profileAvgLen} (${Math.round(sentenceDeviation * 100)}% deviation)`
      );
      if (sentenceDeviation <= 0.5) voiceScore += 5;
    }

    // Vocabulary overlap >= 40% (10 pts)
    if (voiceProfile.sampleSentences.length > 0) {
      const overlap = computeVocabularyOverlap(
        allContent,
        voiceProfile.sampleSentences
      );
      if (overlap >= 0.4) {
        voiceScore += 10;
      } else {
        voiceIssues.push(
          `Vocabulary overlap is ${Math.round(overlap * 100)}% — target is 40%+. Voice doesn't sound like you.`
        );
        if (overlap >= 0.2) voiceScore += 4;
      }
    } else {
      voiceScore += 10; // No voice samples to compare
    }
  } else {
    voiceScore += 20; // No voice profile, give full points
  }

  breakdown.voice = { score: voiceScore, max: 20, issues: voiceIssues };
  totalScore += voiceScore;

  // ---- Build suggestions ----
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
