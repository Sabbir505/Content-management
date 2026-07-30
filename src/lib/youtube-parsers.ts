export function parseViewCount(viewText: string): number {
  if (!viewText) return 0;
  const cleaned = viewText.replace(/[^\d]/g, "");
  return parseInt(cleaned) || 0;
}

export function parsePublishedDate(dateText: string): string {
  const now = new Date();
  const lower = dateText.toLowerCase().trim();

  if (!lower || lower === "") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  if (lower === "today" || lower === "streamed today") {
    return now.toISOString();
  }
  if (lower === "yesterday" || lower === "streamed yesterday") {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  }

  const numberMatch = lower.match(/(\d+)/);
  const number = numberMatch ? parseInt(numberMatch[1], 10) : 1;

  if (lower.includes("year")) {
    return new Date(now.getTime() - number * 365 * 24 * 60 * 60 * 1000).toISOString();
  }
  if (lower.includes("month")) {
    return new Date(now.getTime() - number * 30 * 24 * 60 * 60 * 1000).toISOString();
  }
  if (lower.includes("week")) {
    return new Date(now.getTime() - number * 7 * 24 * 60 * 60 * 1000).toISOString();
  }
  if (lower.includes("day") && !lower.includes("today") && !lower.includes("yesterday")) {
    return new Date(now.getTime() - number * 24 * 60 * 60 * 1000).toISOString();
  }
  if (lower.includes("hour")) {
    return new Date(now.getTime() - number * 60 * 60 * 1000).toISOString();
  }
  if (lower.includes("minute")) {
    return new Date(now.getTime() - number * 60 * 1000).toISOString();
  }
  if (lower.includes("second")) {
    return new Date(now.getTime() - number * 1000).toISOString();
  }

  if (!isNaN(Date.parse(dateText))) {
    return new Date(dateText).toISOString();
  }

  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
}
