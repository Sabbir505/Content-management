export interface ArticleContent {
  title: string;
  content: string;
  url: string;
  author?: string;
  publishedAt?: string;
  images: string[];
  error?: string;
}

export async function fetchArticleContent(url: string): Promise<ArticleContent> {
  try {
    // Use a CORS proxy or direct fetch depending on environment
    const response = await fetch(`/api/content/article?url=${encodeURIComponent(url)}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch article: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Article fetch error:", error);
    return {
      title: "",
      content: "",
      url,
      images: [],
      error: error instanceof Error ? error.message : "Failed to fetch article",
    };
  }
}

// Simple client-side article extraction (fallback)
// NOTE: DOMParser is a browser-only API. This function will throw on the server.
// For server-side HTML parsing, install a package like `linkedom` or `jsdom`
// and use its parser instead.
export function extractArticleFromHTML(html: string, url: string): ArticleContent {
  if (typeof DOMParser === "undefined") {
    throw new Error(
      "extractArticleFromHTML requires a browser environment (DOMParser is not available on the server). " +
      "Use fetchArticleContent() which calls the API route, or install 'linkedom' for server-side HTML parsing."
    );
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Try to extract title
  const title = doc.querySelector("h1")?.textContent ||
    doc.querySelector("title")?.textContent ||
    "Article";

  // Try to extract main content
  const articleElement =
    doc.querySelector("article") ||
    doc.querySelector("[role='main'") ||
    doc.querySelector("main") ||
    doc.querySelector(".article-content") ||
    doc.querySelector(".post-content") ||
    doc.body;

  // Extract text content
  const paragraphs = articleElement?.querySelectorAll("p") || [];
  const content = Array.from(paragraphs)
    .map((p) => p.textContent)
    .filter(Boolean)
    .join("\n\n");

  // Extract images
  const images: string[] = [];
  const imgElements = articleElement?.querySelectorAll("img") || [];
  imgElements.forEach((img) => {
    const src = img.getAttribute("src");
    if (src && !src.includes("icon") && !src.includes("logo")) {
      images.push(src.startsWith("http") ? src : new URL(src, url).href);
    }
  });

  return {
    title: title.trim(),
    content: content.trim(),
    url,
    images,
  };
}
