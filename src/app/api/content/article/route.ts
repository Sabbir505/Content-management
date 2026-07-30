import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/proxy";
import { validateUrl } from "@/lib/url-validation";
import { extractTitle, extractContent, extractImages, extractAuthor, extractPublishedDate } from "@/lib/content/article-extraction";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  let resolvedUrl = url || "";

  try {
    if (!url) {
      return NextResponse.json(
        { success: false, error: "url parameter is required" },
        { status: 400 }
      );
    }

    // Validate URL
    const validation = await validateUrl(url);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }
    // Resolve Google News redirect URLs to actual article URLs
    resolvedUrl = url;
    if (url.includes("news.google.com/rss/articles") || url.includes("www.google.com/url")) {
      try {
        const redirectValidation = await validateUrl(url);
        if (!redirectValidation.valid) {
          return NextResponse.json(
            { success: false, error: redirectValidation.error },
            { status: 400 }
          );
        }

        const redirectResponse = await proxyFetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          redirect: "follow",
          timeout: 10000,
        });

        // Try to get the final URL from the response
        if (redirectResponse.url && !redirectResponse.url.includes("news.google.com")) {
          const resolvedValidation = await validateUrl(redirectResponse.url);
          if (!resolvedValidation.valid) {
            return NextResponse.json(
              { success: false, error: resolvedValidation.error },
              { status: 400 }
            );
          }
          resolvedUrl = redirectResponse.url;
        } else {
          // If response URL is still Google News, parse the HTML to find the actual URL
          const html = await redirectResponse.text();

          // Google News redirect pages often have the actual URL in various places
          const urlPatterns = [
            /<a[^>]+href=["']([^"']+)["'][^>]*>[^<]*<\/a>/gi,
            /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i,
            /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
            /window\.location\.href\s*=\s*["']([^"']+)["']/i,
            /url=([^&]+)/i,
          ];

          for (const pattern of urlPatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
              const foundUrl = match[1].trim();
              if (foundUrl.startsWith("http") && !foundUrl.includes("news.google.com")) {
                const foundValidation = await validateUrl(foundUrl);
                if (foundValidation.valid) {
                  resolvedUrl = foundUrl;
                  break;
                }
              }
            }
          }
        }
      } catch {
        // If redirect resolution fails, try to continue with original URL
        resolvedUrl = url;
      }
    }

    // Fetch the article through proxy with browser-like headers
    const response = await proxyFetch(resolvedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
      },
      redirect: "follow",
      timeout: 10000,
    });

    if (!response.ok) {
      return NextResponse.json({
        success: true,
        data: {
          title: "Article",
          content: `Unable to fetch article content (HTTP ${response.status}). The site may block automated requests or require a subscription.`,
          url,
          author: undefined,
          publishedAt: undefined,
          images: [],
        },
      });
    }

    const html = await response.text();

    // Extract article content using simple heuristics
    const title = extractTitle(html);
    const content = extractContent(html);
    const images = extractImages(html, resolvedUrl);
    const author = extractAuthor(html);
    const publishedAt = extractPublishedDate(html);

    // If title indicates it's a Google News redirect page or content is empty,
    // return a message with the original URL since Google News URLs can't be decoded
    if (title === "Google News" || (title.includes("Google") && content.length < 100)) {
      return NextResponse.json({
        success: true,
        data: {
          title: title === "Google News" ? "Article" : title,
          content: "This article is hosted on Google News. Click the button below to open the original article.",
          url: url,
          author: author || "Google News",
          publishedAt: publishedAt,
          images: [],
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        title,
        content,
        url,
        author,
        publishedAt,
        images,
      },
    });
  } catch (error) {
    console.error("Article fetch error:", error);
    return NextResponse.json({
      success: true,
      data: {
        title: "Article",
        content: "Unable to fetch article content.",
        url: resolvedUrl,
        author: undefined,
        publishedAt: undefined,
        images: [],
      },
    });
  }
}

