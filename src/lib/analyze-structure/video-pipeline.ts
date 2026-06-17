import { getVideoDetails } from "../youtube";
import { YoutubeTranscript } from "youtube-transcript";
import type {
  TimedSegment,
  TranscriptQuality,
  VideoPipelineInput,
} from "./types";

// Parse ISO 8601 duration like PT14M32S to seconds
export function parseISODuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");
  return hours * 3600 + minutes * 60 + seconds;
}

// Fetch transcript directly using youtube-transcript library
export async function fetchTranscript(videoId: string): Promise<TimedSegment[]> {
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: "en",
    });

    if (!transcript || transcript.length === 0) {
      throw new Error("No transcript available for this video");
    }

    // Convert segments to TimedSegment format
    return transcript.map((segment) => ({
      text: segment.text,
      start_time_seconds: Math.floor(segment.offset / 1000),
      end_time_seconds: Math.floor((segment.offset + segment.duration) / 1000),
      word_count: segment.text.split(/\s+/).length,
    }));
  } catch (error) {
    // youtube-transcript often throws generic errors — wrap with clearer message
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("fetch") || message.includes("network")) {
      throw new Error("Transcript service temporarily unavailable. This video may not have captions.");
    }
    throw error;
  }
}

// Clean transcript: strip non-speech markers, merge short fragments
export function cleanTranscript(segments: TimedSegment[]): TimedSegment[] {
  const nonSpeechPattern = /\[(Music|Applause|Laughter|inaudible|unintelligible)\]/gi;

  return segments
    .map((segment) => ({
      ...segment,
      text: segment.text.replace(nonSpeechPattern, "").trim(),
    }))
    .filter((segment) => segment.text.length > 0)
    .reduce((acc: TimedSegment[], segment) => {
      if (acc.length === 0) return [segment];

      const last = acc[acc.length - 1];
      // Merge if gap is small (< 2 seconds) and last segment is short (< 15 words)
      if (
        segment.start_time_seconds - last.end_time_seconds < 2 &&
        last.word_count < 15
      ) {
        acc[acc.length - 1] = {
          ...last,
          text: `${last.text} ${segment.text}`,
          end_time_seconds: segment.end_time_seconds,
          word_count: last.word_count + segment.word_count,
        };
        return acc;
      }
      return [...acc, segment];
    }, []);
}

// Score transcript quality
export function scoreTranscriptQuality(segments: TimedSegment[]): TranscriptQuality {
  const totalWords = segments.reduce((sum, s) => sum + s.word_count, 0);
  const inaudibleCount = segments.filter((s) =>
    /\[(inaudible|unintelligible)\]/i.test(s.text)
  ).length;

  // Calculate gaps
  let gapCount = 0;
  for (let i = 1; i < segments.length; i++) {
    const gap = segments[i].start_time_seconds - segments[i - 1].end_time_seconds;
    if (gap > 3) gapCount++;
  }
  const gapPercentage = segments.length > 0 ? gapCount / segments.length : 0;
  const inaudiblePerThousand = totalWords > 0 ? (inaudibleCount / totalWords) * 1000 : 0;

  if (inaudiblePerThousand > 3 || gapPercentage > 0.15) {
    return "low";
  }
  if (inaudibleCount > 0) {
    return "medium";
  }
  return "high";
}

// Simple time-based beat segmentation (V1: no embeddings)
export function segmentIntoBeats(segments: TimedSegment[], durationSeconds: number): TimedSegment[] {
  if (segments.length === 0) return [];

  const beats: TimedSegment[] = [];
  const beatInterval = 30; // seconds per beat (simplified for V1)
  let currentBeat: TimedSegment = {
    ...segments[0],
    text: segments[0].text,
  };

  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i];
    if (segment.start_time_seconds - currentBeat.start_time_seconds >= beatInterval) {
      beats.push(currentBeat);
      currentBeat = { ...segment };
    } else {
      currentBeat = {
        ...currentBeat,
        text: `${currentBeat.text} ${segment.text}`,
        end_time_seconds: segment.end_time_seconds,
        word_count: currentBeat.word_count + segment.word_count,
      };
    }
  }

  // Add final beat
  if (beats.length === 0 || beats[beats.length - 1].start_time_seconds !== currentBeat.start_time_seconds) {
    beats.push(currentBeat);
  }

  return beats;
}

// Main video pipeline
export async function analyzeVideo(videoId: string): Promise<{
  segments: TimedSegment[];
  beats: TimedSegment[];
  transcriptQuality: TranscriptQuality;
  durationSeconds: number;
}> {
  // Fetch metadata
  const items = await getVideoDetails([videoId]);
  if (!items || items.length === 0) {
    throw new Error("Video not found");
  }

  const item = items[0];
  const durationSeconds = parseISODuration(item.contentDetails.duration);

  // Fetch and process transcript
  const rawSegments = await fetchTranscript(videoId);
  const cleaned = cleanTranscript(rawSegments);
  const transcriptQuality = scoreTranscriptQuality(cleaned);
  const beats = segmentIntoBeats(cleaned, durationSeconds);

  return {
    segments: cleaned,
    beats,
    transcriptQuality,
    durationSeconds,
  };
}
