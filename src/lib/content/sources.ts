export function getSourceIcon(source: string): string {
  switch (source) {
    case "hackernews":
      return "🟠";
    case "devto":
      return "🟣";
    case "substack":
      return "📰";
    default:
      return "📄";
  }
}

export function getSourceLabel(source: string): string {
  switch (source) {
    case "hackernews":
      return "Hacker News";
    case "devto":
      return "DEV.to";
    case "substack":
      return "Substack";
    default:
      return source.charAt(0).toUpperCase() + source.slice(1);
  }
}
