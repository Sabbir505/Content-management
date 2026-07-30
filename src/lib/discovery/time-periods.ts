export const TIME_PERIOD_MS: Record<string, number> = {
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  "3months": 90 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
  all: Infinity,
};

export const DEFAULT_TIME_PERIOD = "3months";

export function getTimePeriodCutoff(period: string): number {
  return Date.now() - (TIME_PERIOD_MS[period] || TIME_PERIOD_MS[DEFAULT_TIME_PERIOD]);
}

const OUTLIER_MULTIPLIERS: Record<string, number> = {
  "3x": 3,
  "5x": 5,
  "10x": 10,
  "20x": 20,
  "50x": 50,
};

export function getOutlierMin(selected: string): number {
  return OUTLIER_MULTIPLIERS[selected] || 1;
}

const PLATFORM_TO_SOURCE: Record<string, string> = {
  hackernews: "hackernews",
  devto: "devto",
  substack: "substack",
};

export function platformsToSources(platforms: string[]): string[] {
  return platforms.map((p) => PLATFORM_TO_SOURCE[p]).filter(Boolean);
}

export function parseDurationToSeconds(duration: string): number {
  const parts = duration.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

export function getAgeHours(publishedAt: string): number {
  const published = new Date(publishedAt).getTime();
  const now = Date.now();
  return Math.max((now - published) / (1000 * 60 * 60), 0.01);
}

export function getTimeRangeCutoffDate(range: string): Date {
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  switch (range) {
    case "day":
      return new Date(now.getTime() - 1 * msPerDay);
    case "week":
      return new Date(now.getTime() - 7 * msPerDay);
    case "month":
      return new Date(now.getTime() - 30 * msPerDay);
    case "3months":
      return new Date(now.getTime() - 90 * msPerDay);
    case "year":
      return new Date(now.getTime() - 365 * msPerDay);
    default:
      return new Date(now.getTime() - 7 * msPerDay);
  }
}

export function calculateSecondsUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.floor((midnight.getTime() - now.getTime()) / 1000);
}

export function isQuotaError(error: string | undefined): boolean {
  if (!error) return false;
  const lower = error.toLowerCase();
  return (
    lower.includes("quota") ||
    lower.includes("429") ||
    lower.includes("rate limit") ||
    lower.includes("exceeded")
  );
}

export const CONTENT_FETCH_TIMEOUT_MS = 45000;
export const LOADING_SAFETY_TIMEOUT_MS = 65000;
export const CONTENT_FETCH_LIMIT = 60;
export const DISPLAY_COUNT_INCREMENT = 16;
export const DISPLAY_COUNT_INITIAL = 24;
