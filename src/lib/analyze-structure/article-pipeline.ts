import type { ArticleSegment, ArticlePipelineInput } from "./types";

// Simple content extraction (V1: no heavy library, basic regex-based cleanup)
export function extractArticleContent(html: string): { content: string; headers: { text: string; level: number }[] } {
  // Remove script and style tags
  let cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // Extract headers before stripping tags
  const headers: { text: string; level: number }[] = [];
  const headerRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let headerMatch;
  while ((headerMatch = headerRegex.exec(html)) !== null) {
    const level = parseInt(headerMatch[1]);
    const text = headerMatch[2].replace(/<[^>]+>/g, "").trim();
    if (text) headers.push({ level, text });
  }

  // Extract article content: try to find main article body
  // Try common article containers
  const articlePatterns = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<div[^>]*class=["'][^"']*(?:article|content|post|entry)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  ];

  let articleContent = "";
  for (const pattern of articlePatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      articleContent = match[1];
      break;
    }
  }

  // Fallback: use body content
  if (!articleContent) {
    const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    articleContent = bodyMatch ? bodyMatch[1] : cleaned;
  }

  // Strip remaining HTML tags
  const textContent = articleContent
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { content: textContent, headers };
}

// Extract metadata from HTML
export function extractArticleMetadata(html: string, url: string): {
  title: string;
  author?: string;
  publishedAt?: string;
} {
  const titleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<title>([^<]+)<\/title>/i);

  const authorMatch = html.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*property=["']article:author["'][^>]*content=["']([^"']+)["']/i);

  const dateMatch = html.match(/<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*name=["']datePublished["'][^>]*content=["']([^"']+)["']/i);

  return {
    title: titleMatch ? titleMatch[1].trim() : url,
    author: authorMatch ? authorMatch[1].trim() : undefined,
    publishedAt: dateMatch ? dateMatch[1].trim() : undefined,
  };
}

// Score article extraction quality
export function scoreArticleQuality(content: string, hadHeaders: boolean): "high" | "medium" | "low" {
  const wordCount = content.split(/\s+/).length;

  if (wordCount < 150) return "low";
  if (!hadHeaders && wordCount < 400) return "medium";
  return "high";
}

// Segment article into beats using headers (Method A) or paragraphs (Method B)
export function segmentArticleIntoBeats(
  content: string,
  headers: { text: string; level: number }[]
): ArticleSegment[] {
  const words = content.split(/\s+/);
  const totalWords = words.length;

  if (headers.length >= 2) {
    // Method A: Header-based segmentation
    const beats: ArticleSegment[] = [];
    let currentStart = 0;
    let currentHeader = "";

    // First beat: intro (before first header)
    const firstHeaderIndex = content.indexOf(headers[0].text);
    if (firstHeaderIndex > 0) {
      const introText = content.slice(0, firstHeaderIndex).trim();
      const introWords = introText.split(/\s+/).length;
      beats.push({
        beat_number: 1,
        start_word_index: 0,
        end_word_index: introWords,
        text: introText,
        word_count: introWords,
        had_header: false,
        header_text: "",
      });
      currentStart = introWords;
    }

    // Subsequent beats: each header section
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      const nextHeaderIndex = i < headers.length - 1
        ? content.indexOf(headers[i + 1].text, content.indexOf(header.text))
        : content.length;
      const currentHeaderPos = content.indexOf(header.text);
      const sectionText = content.slice(currentHeaderPos, nextHeaderIndex).trim();
      const sectionWords = sectionText.split(/\s+/).length;

      beats.push({
        beat_number: beats.length + 1,
        start_word_index: currentStart,
        end_word_index: currentStart + sectionWords,
        text: sectionText,
        word_count: sectionWords,
        had_header: true,
        header_text: header.text,
      });
      currentStart += sectionWords;
    }

    return beats;
  }

  // Method B: Simple paragraph-based segmentation (fallback)
  const paragraphs = content.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const wordsPerBeat = Math.max(100, Math.floor(totalWords / Math.min(paragraphs.length, 8)));

  const beats: ArticleSegment[] = [];
  let currentBeat: ArticleSegment = {
    beat_number: 1,
    start_word_index: 0,
    end_word_index: 0,
    text: "",
    word_count: 0,
    had_header: false,
    header_text: "",
  };

  for (const paragraph of paragraphs) {
    const paraWords = paragraph.split(/\s+/).length;

    if (currentBeat.word_count + paraWords > wordsPerBeat && currentBeat.word_count > 0) {
      beats.push(currentBeat);
      currentBeat = {
        beat_number: beats.length + 1,
        start_word_index: currentBeat.end_word_index,
        end_word_index: currentBeat.end_word_index + paraWords,
        text: paragraph,
        word_count: paraWords,
        had_header: false,
        header_text: "",
      };
    } else {
      currentBeat = {
        ...currentBeat,
        text: currentBeat.text ? `${currentBeat.text}\n\n${paragraph}` : paragraph,
        end_word_index: currentBeat.start_word_index + currentBeat.word_count + paraWords,
        word_count: currentBeat.word_count + paraWords,
      };
    }
  }

  if (currentBeat.word_count > 0) {
    beats.push(currentBeat);
  }

  return beats;
}

// Main article pipeline
export async function analyzeArticle(url: string): Promise<{
  content: string;
  beats: ArticleSegment[];
  quality: "high" | "medium" | "low";
  wordCount: number;
  hadHeaders: boolean;
  metadata: {
    title: string;
    author?: string;
    publishedAt?: string;
  };
}> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch article: ${response.status}`);
  }

  const html = await response.text();

  // Check for JS-rendered content (near-empty body)
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyText = bodyMatch ? bodyMatch[1].replace(/<[^>]+>/g, "").trim() : "";
  if (bodyText.length < 100) {
    throw new Error("Article requires JavaScript rendering — content not accessible");
  }

  const { content, headers } = extractArticleContent(html);
  const metadata = extractArticleMetadata(html, url);
  const wordCount = content.split(/\s+/).length;
  const hadHeaders = headers.length >= 2;
  const quality = scoreArticleQuality(content, hadHeaders);
  const beats = segmentArticleIntoBeats(content, headers);

  return {
    content,
    beats,
    quality,
    wordCount,
    hadHeaders,
    metadata,
  };
}
