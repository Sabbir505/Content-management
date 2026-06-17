export function calculateOutlierScore(videoViews: number, channelAvgViews: number): number {
  if (channelAvgViews === 0) return 0;
  return parseFloat((videoViews / channelAvgViews).toFixed(1));
}

export function estimateHookType(title: string): string {
  const lowerTitle = title.toLowerCase();

  if (lowerTitle.includes("why") || lowerTitle.includes("how") || lowerTitle.includes("what")) {
    return "Question";
  }
  if (lowerTitle.includes("%") || lowerTitle.includes("percent") || lowerTitle.includes("times")) {
    return "Statistic";
  }
  if (lowerTitle.includes("i ") || lowerTitle.includes("my ") || lowerTitle.includes("we ")) {
    return "Story";
  }
  if (lowerTitle.includes("never") || lowerTitle.includes("always") || lowerTitle.includes("every")) {
    return "Bold Claim";
  }
  if (lowerTitle.includes("secret") || lowerTitle.includes("truth") || lowerTitle.includes("hidden")) {
    return "Curiosity Gap";
  }

  return "Statement";
}

export function estimateStructure(title: string): string {
  const lowerTitle = title.toLowerCase();

  if (lowerTitle.includes("top ") || lowerTitle.includes("best ") || lowerTitle.includes("ways ")) {
    return "Listicle";
  }
  if (lowerTitle.includes("how to") || lowerTitle.includes("tutorial") || lowerTitle.includes("guide")) {
    return "Tutorial";
  }
  if (lowerTitle.includes("vs") || lowerTitle.includes("versus") || lowerTitle.includes("compare")) {
    return "Comparison";
  }
  if (lowerTitle.includes("story") || lowerTitle.includes("journey") || lowerTitle.includes("experience")) {
    return "Storytelling";
  }
  if (lowerTitle.includes("review") || lowerTitle.includes("opinion")) {
    return "Review";
  }

  return "Informational";
}
