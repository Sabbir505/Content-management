import { fetchTranscript } from "youtube-transcript";

export async function extractTranscript(videoId: string): Promise<string> {
  try {
    const transcript = await fetchTranscript(videoId);
    return transcript.map((item) => item.text).join(" ");
  } catch (error) {
    console.error("Error extracting transcript:", error);
    throw new Error("Failed to extract transcript. The video may not have captions available.");
  }
}

function splitSentences(text: string): string[] {
  if (!text || text.trim().length === 0) return [];
  // Split on sentence-ending punctuation followed by whitespace or end of string.
  // Handles abbreviations like "e.g.", "i.e.", "Mr.", "Dr.", "vs." by avoiding them.
  const trimmed = text
    .replace(/\b(e\.g\.|i\.e\.|Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.|Jr\.|Sr\.|vs\.|Vol\.|Inc\.|Ltd\.)\s+/gi, (m) => m.replace(/\s+/, "\x00"));
  const sentences = trimmed
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/\x00/g, " ").trim())
    .filter((s) => s.length > 0);
  return sentences;
}

export function extractHook(transcript: string): string {
  if (!transcript || transcript.trim().length === 0) return "";
  const sentences = splitSentences(transcript);
  if (sentences.length === 0) return transcript.trim();
  return sentences.slice(0, 2).join(" ") + (sentences.length > 0 && !/[.!?]$/.test(sentences[1] || sentences[0]) ? "." : "");
}

export function extractStructure(transcript: string): { section: string; text: string }[] {
  if (!transcript || transcript.trim().length === 0) return [];

  const sentences = splitSentences(transcript);
  const totalSentences = sentences.length;

  if (totalSentences === 0) return [];

  const hookEnd = Math.max(1, Math.floor(totalSentences * 0.1));
  const introEnd = Math.max(hookEnd + 1, Math.floor(totalSentences * 0.2));
  const mainEnd = Math.max(introEnd + 1, Math.floor(totalSentences * 0.8));

  return [
    {
      section: "Hook",
      text: sentences.slice(0, hookEnd).join(" ") + (hookEnd > 0 ? "." : ""),
    },
    {
      section: "Intro",
      text: sentences.slice(hookEnd, introEnd).join(" ") + (introEnd > hookEnd ? "." : ""),
    },
    {
      section: "Main Content",
      text: sentences.slice(introEnd, mainEnd).join(" ") + (mainEnd > introEnd ? "." : ""),
    },
    {
      section: "Outro",
      text: sentences.slice(mainEnd).join(" ") + (mainEnd < totalSentences ? "." : ""),
    },
  ];
}
