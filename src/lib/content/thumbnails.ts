/**
 * Get a high-quality thumbnail or favicon for a given URL.
 * Uses multiple strategies for best results.
 */

export function getFaviconUrl(url: string, size = 256): string {
  try {
    const domain = new URL(url).hostname;
    // Use Google's favicon service with larger size for better quality
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
  } catch {
    return "";
  }
}

/**
 * Get a branded icon URL for known sources.
 * These are high-quality CDN-hosted icons.
 */
export function getSourceIconUrl(source: string): string {
  const icons: Record<string, string> = {
    hackernews: "https://cdn.simpleicons.org/ycombinator/FF6600",
    devto: "https://cdn.simpleicons.org/devdotto/0A0A0A",
    substack: "https://cdn.simpleicons.org/substack/FF6719",
  };
  return icons[source] || "";
}

/**
 * Get the best available thumbnail for a content item.
 * Priority:
 * 1. Actual thumbnail from the API (DEV.to cover images, etc.)
 * 2. High-quality favicon via Google favicon service
 * 3. Source-specific branded icon
 */
export function getBestThumbnail(url: string, source: string, existingThumbnail?: string): string {
  // If we already have a real thumbnail (DEV.to cover, etc.), use it
  if (existingThumbnail && existingThumbnail.startsWith("http")) {
    return existingThumbnail;
  }

  // Try favicon
  const favicon = getFaviconUrl(url);
  if (favicon) {
    return favicon;
  }

  // Fall back to source icon
  return getSourceIconUrl(source);
}

/**
 * Get a placeholder gradient style for when no image is available.
 */
export function getPlaceholderGradient(source: string): string {
  const gradients: Record<string, string> = {
    hackernews: "from-orange-50 to-orange-100",
    devto: "from-gray-50 to-gray-100",
    substack: "from-orange-50 to-orange-100",
  };
  return gradients[source] || "from-gray-50 to-gray-100";
}
