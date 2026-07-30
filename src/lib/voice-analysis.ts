export interface VoiceFingerprint {
  hookStyle: string;
  sentenceLength: string;
  tone: string;
  vocabulary: string;
  humorLevel: string;
  ctaPattern: string;
  sampleSentences?: string[];
}

export interface VoiceProfileVersion {
  id: string;
  fingerprint: VoiceFingerprint;
  sources: string[];
  createdAt: string;
  version: number;
  feedback?: {
    rating: number;
    tags: string[];
  };
}

export interface VoiceProfileData {
  id: string;
  userId: string;
  name: string;
  currentVersion: number;
  versions: VoiceProfileVersion[];
  createdAt: string;
  updatedAt: string;
}

export function analyzeText(text: string): VoiceFingerprint {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const avgSentenceLength = words.length / Math.max(sentences.length, 1);

  const firstSentence = sentences[0]?.toLowerCase() || "";
  let hookStyle = "Pattern interrupt";
  if (firstSentence.includes("?")) hookStyle = "Direct question";
  else if (/\d/.test(firstSentence)) hookStyle = "Statistic or number";
  else if (firstSentence.startsWith("i ") || firstSentence.startsWith("my ")) hookStyle = "Personal story";
  else if (firstSentence.includes("you ") || firstSentence.includes("your ")) hookStyle = "Viewer-addressed statement";

  const textLower = text.toLowerCase();
  let tone = "Conversational";
  if ((textLower.match(/!/g) || []).length > 3) tone = "Energetic";
  else if (textLower.includes("imagine") || textLower.includes("picture this")) tone = "Inspirational";
  else if (textLower.includes("honestly") || textLower.includes("real talk")) tone = "Authentic/Direct";

  const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
  const complexity = uniqueWords.size / Math.max(words.length, 1);
  let vocabulary = "Accessible";
  if (complexity > 0.4) vocabulary = "Rich and varied";
  else if (complexity < 0.2) vocabulary = "Simple and direct";

  const humorIndicators = ["lol", "haha", "funny", "joke", "hilarious", "ridiculous"];
  const humorCount = humorIndicators.filter((h) => textLower.includes(h)).length;
  let humorLevel = "Minimal";
  if (humorCount > 2) humorLevel = "Occasional, dry";
  if (humorCount > 5) humorLevel = "Frequent";

  const ctaPatterns = [
    { pattern: /subscribe.*now|hit.*subscribe/i, label: "Direct command" },
    { pattern: /let me know.*comment|what do you think/i, label: "Question-based" },
    { pattern: /join.*community|become.*member/i, label: "Community-driven" },
    { pattern: /check.*link|link.*description/i, label: "Resource-driven" },
  ];
  const lastParagraph = text.slice(-500).toLowerCase();
  const matchedCta = ctaPatterns.find((c) => c.pattern.test(lastParagraph));
  const ctaPattern = matchedCta?.label || "Soft suggestion";

  let sentenceLength = "Medium (12-15 words)";
  if (avgSentenceLength < 10) sentenceLength = "Short (8-10 words)";
  else if (avgSentenceLength > 18) sentenceLength = "Long (16-20 words)";

  return {
    hookStyle,
    sentenceLength,
    tone,
    vocabulary,
    humorLevel,
    ctaPattern,
    sampleSentences: sentences.slice(0, 3).map((s) => s.trim()),
  };
}

export { extractVideoId } from "@/lib/youtube";
