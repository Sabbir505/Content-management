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

export function extractHook(transcript: string): string {
  const sentences = transcript.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  return sentences.slice(0, 2).join(". ") + ".";
}

export function extractStructure(transcript: string): { section: string; text: string }[] {
  const sentences = transcript.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const totalSentences = sentences.length;

  if (totalSentences === 0) return [];

  const hookEnd = Math.floor(totalSentences * 0.1);
  const introEnd = Math.floor(totalSentences * 0.2);
  const mainEnd = Math.floor(totalSentences * 0.8);

  return [
    {
      section: "Hook",
      text: sentences.slice(0, hookEnd).join(". ") + ".",
    },
    {
      section: "Intro",
      text: sentences.slice(hookEnd, introEnd).join(". ") + ".",
    },
    {
      section: "Main Content",
      text: sentences.slice(introEnd, mainEnd).join(". ") + ".",
    },
    {
      section: "Outro",
      text: sentences.slice(mainEnd).join(". ") + ".",
    },
  ];
}
