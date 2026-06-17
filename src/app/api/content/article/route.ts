import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/proxy";
import { lookup } from "dns";
import { promisify } from "util";

const dnsLookup = promisify(lookup);

async function resolveAndCheckPrivate(hostname: string): Promise<boolean> {
  try {
    const { address } = await dnsLookup(hostname);
    return isPrivateIp(address);
  } catch {
    // If DNS resolution fails, treat as potentially private to be safe
    return true;
  }
}

function isPrivateIp(ip: string): boolean {
  // Check for localhost variants
  if (
    ip === "127.0.0.1" ||
    ip === "0.0.0.0" ||
    ip === "::1" ||
    ip === "[::1]"
  ) {
    return true;
  }

  // Check for private IPv4 ranges
  const ipv4Match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b, c, d] = ipv4Match.map(Number);
    // 10.x.x.x
    if (a === 10) return true;
    // 172.16.x.x - 172.31.x.x
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.x.x
    if (a === 192 && b === 168) return true;
    // 127.x.x.x
    if (a === 127) return true;
    // 0.0.0.0
    if (a === 0 && b === 0 && c === 0 && d === 0) return true;
    // 169.254.x.x (link-local)
    if (a === 169 && b === 254) return true;
  }

  return false;
}

async function validateUrl(urlString: string): Promise<{ valid: false; error: string } | { valid: true; url: URL }> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { valid: false, error: "Invalid URL" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: "Only HTTP and HTTPS URLs are allowed" };
  }

  // Check hostname first (fast path for literal IPs)
  if (isPrivateIp(parsed.hostname)) {
    return { valid: false, error: "Private IP addresses and localhost are not allowed" };
  }

  // Resolve DNS and check resolved IP (prevents DNS rebinding)
  const isPrivate = await resolveAndCheckPrivate(parsed.hostname);
  if (isPrivate) {
    return { valid: false, error: "Private IP addresses and localhost are not allowed" };
  }

  return { valid: true, url: parsed };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

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
    const targetUrl = validation.url;

    // Resolve Google News redirect URLs to actual article URLs
    let resolvedUrl = url;
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
      return NextResponse.json(
        { success: false, error: `Failed to fetch article: ${response.status}` },
        { status: 500 }
      );
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
    return NextResponse.json(
      { success: false, error: "Failed to fetch article" },
      { status: 500 }
    );
  }
}

function extractTitle(html: string): string {
  // Try to find title in various places
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch) return decodeHTMLEntities(titleMatch[1].trim());

  const h1Match = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
  if (h1Match) return decodeHTMLEntities(h1Match[1].trim());

  return "Article";
}

function extractContent(html: string): string {
  // Remove script and style tags
  let cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // Try to find article content
  const articlePatterns = [
    /<article[^>]*>[\s\S]*?<\/article>/i,
    /<main[^>]*>[\s\S]*?<\/main>/i,
    /<div[^>]*class=["'][^"']*(?:article|content|post)[^"']*["'][^>]*>[\s\S]*?<\/div>/i,
  ];

  for (const pattern of articlePatterns) {
    const match = cleanHtml.match(pattern);
    if (match) {
      cleanHtml = match[0];
      break;
    }
  }

  // Extract text from paragraphs
  const paragraphs: string[] = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let pMatch;
  while ((pMatch = pRegex.exec(cleanHtml)) !== null) {
    const text = pMatch[1]
      .replace(/<[^>]+>/g, "") // Remove remaining tags
      .trim();
    if (text.length > 50) { // Only include substantial paragraphs
      paragraphs.push(decodeHTMLEntities(text));
    }
  }

  return paragraphs.join("\n\n");
}

function extractImages(html: string, baseUrl: string): string[] {
  const images: string[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    let src = match[1];
    if (src.startsWith("//")) {
      src = "https:" + src;
    } else if (src.startsWith("/")) {
      const url = new URL(baseUrl);
      src = `${url.protocol}//${url.host}${src}`;
    } else if (!src.startsWith("http")) {
      const url = new URL(baseUrl);
      src = `${url.protocol}//${url.host}/${src}`;
    }

    if (!src.includes("icon") && !src.includes("logo") && !src.includes("avatar")) {
      images.push(src);
    }
  }

  return images.slice(0, 5); // Limit to 5 images
}

function extractAuthor(html: string): string | undefined {
  const patterns = [
    /<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']author["'][^>]*>/i,
    /<span[^>]*class=["'][^"']*author[^"']*["'][^>]*>([^<]*)<\/span>/i,
    /<a[^>]*rel=["']author["'][^>]*>([^<]*)<\/a>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeHTMLEntities(match[1].trim());
  }

  return undefined;
}

function extractPublishedDate(html: string): string | undefined {
  const patterns = [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+name=["']publishedDate["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<time[^>]+datetime=["']([^"']+)["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }

  return undefined;
}

function decodeHTMLEntities(text: string): string {
  // Decode numeric entities: &#123; and &#x7B;
  let decoded = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));

  // Decode named entities (common set)
  const namedEntities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
    "&ndash;": "–",
    "&mdash;": "—",
    "&lsquo;": "'",
    "&rsquo;": "'",
    "&ldquo;": '"',
    "&rdquo;": '"',
    "&hellip;": "…",
    "&bull;": "•",
    "&copy;": "©",
    "&reg;": "®",
    "&trade;": "™",
    "&euro;": "€",
    "&pound;": "£",
    "&yen;": "¥",
    "&cent;": "¢",
    "&deg;": "°",
    "&plusmn;": "±",
    "&times;": "×",
    "&divide;": "÷",
    "&frac12;": "½",
    "&frac14;": "¼",
    "&frac34;": "¾",
    "&sup2;": "²",
    "&sup3;": "³",
    "&laquo;": "«",
    "&raquo;": "»",
    "&lsaquo;": "‹",
    "&rsaquo;": "›",
    "&middot;": "·",
    "&sect;": "§",
    "&para;": "¶",
    "&dagger;": "†",
    "&Dagger;": "‡",
    "&prime;": "′",
    "&Prime;": "″",
    "&oline;": "‾",
    "&frasl;": "⁄",
    "&weierp;": "℘",
    "&image;": "ℑ",
    "&real;": "ℜ",
    "&alefsym;": "ℵ",
    "&larr;": "←",
    "&uarr;": "↑",
    "&rarr;": "→",
    "&darr;": "↓",
    "&harr;": "↔",
    "&crarr;": "↵",
    "&lArr;": "⇐",
    "&uArr;": "⇑",
    "&rArr;": "⇒",
    "&dArr;": "⇓",
    "&hArr;": "⇔",
    "&forall;": "∀",
    "&part;": "∂",
    "&exist;": "∃",
    "&empty;": "∅",
    "&nabla;": "∇",
    "&isin;": "∈",
    "&notin;": "∉",
    "&ni;": "∋",
    "&prod;": "∏",
    "&sum;": "∑",
    "&minus;": "−",
    "&lowast;": "∗",
    "&radic;": "√",
    "&prop;": "∝",
    "&infin;": "∞",
    "&ang;": "∠",
    "&and;": "∧",
    "&or;": "∨",
    "&cap;": "∩",
    "&cup;": "∪",
    "&int;": "∫",
    "&there4;": "∴",
    "&sim;": "∼",
    "&cong;": "≅",
    "&asymp;": "≈",
    "&ne;": "≠",
    "&equiv;": "≡",
    "&le;": "≤",
    "&ge;": "≥",
    "&sub;": "⊂",
    "&sup;": "⊃",
    "&nsub;": "⊄",
    "&sube;": "⊆",
    "&supe;": "⊇",
    "&oplus;": "⊕",
    "&otimes;": "⊗",
    "&perp;": "⊥",
    "&sdot;": "⋅",
    "&lceil;": "⌈",
    "&rceil;": "⌉",
    "&lfloor;": "⌊",
    "&rfloor;": "⌋",
    "&lang;": "⟨",
    "&rang;": "⟩",
    "&loz;": "◊",
    "&spades;": "♠",
    "&clubs;": "♣",
    "&hearts;": "♥",
    "&diams;": "♦",
    "&OElig;": "Œ",
    "&oelig;": "œ",
    "&Scaron;": "Š",
    "&scaron;": "š",
    "&Yuml;": "Ÿ",
    "&circ;": "ˆ",
    "&tilde;": "˜",
    "&ensp;": " ",
    "&emsp;": " ",
    "&thinsp;": " ",
    "&zwnj;": "",
    "&zwj;": "",
    "&lrm;": "",
    "&rlm;": "",
    "&shy;": "­",
  };

  return decoded.replace(/&[^;]+;/g, (entity) => namedEntities[entity] || entity);
}
