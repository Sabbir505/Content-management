export function extractTitle(html: string): string {
  // Try to find title in various places
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch) return decodeHTMLEntities(titleMatch[1].trim());

  const h1Match = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
  if (h1Match) return decodeHTMLEntities(h1Match[1].trim());

  return "Article";
}

export function extractContent(html: string): string {
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

export function extractImages(html: string, baseUrl: string): string[] {
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

export function extractAuthor(html: string): string | undefined {
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

export function extractPublishedDate(html: string): string | undefined {
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

export function decodeHTMLEntities(text: string): string {
  // Decode all numeric and hexadecimal entities using code points for full Unicode support
  let decoded = text.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)));

  // Decode named entities using a comprehensive HTML5 map
  const namedEntities: Record<string, string> = {
    // Core HTML
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
    // Currency
    "&cent;": "¢",
    "&pound;": "£",
    "&euro;": "€",
    "&yen;": "¥",
    "&curren;": "¤",
    // Symbols
    "&copy;": "©",
    "&reg;": "®",
    "&trade;": "™",
    "&deg;": "°",
    "&plusmn;": "±",
    "&times;": "×",
    "&divide;": "÷",
    "&micro;": "µ",
    "&para;": "¶",
    "&sect;": "§",
    "&middot;": "·",
    "&bull;": "•",
    "&hellip;": "…",
    "&prime;": "′",
    "&Prime;": "″",
    "&oline;": "‾",
    "&frasl;": "⁄",
    "&brvbar;": "¦",
    "&cedil;": "¸",
    "&ordf;": "ª",
    "&ordm;": "º",
    "&iquest;": "¿",
    "&iexcl;": "¡",
    "&uml;": "¨",
    "&acute;": "´",
    "&circ;": "ˆ",
    "&tilde;": "˜",
    "&macr;": "¯",
    "&shy;": "­",
    // Fractions
    "&frac12;": "½",
    "&frac14;": "¼",
    "&frac34;": "¾",
    "&frac13;": "⅓",
    "&frac23;": "⅔",
    "&frac15;": "⅕",
    "&frac25;": "⅖",
    "&frac35;": "⅗",
    "&frac45;": "⅘",
    "&frac16;": "⅙",
    "&frac56;": "⅚",
    "&frac18;": "⅛",
    "&frac38;": "⅜",
    "&frac58;": "⅝",
    "&frac78;": "⅞",
    // Superscript / Subscript
    "&sup1;": "¹",
    "&sup2;": "²",
    "&sup3;": "³",
    // Quotes
    "&laquo;": "«",
    "&raquo;": "»",
    "&lsaquo;": "‹",
    "&rsaquo;": "›",
    "&bdquo;": "„",
    "&sbquo;": "‚",
    // Arrows
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
    "&nwarr;": "↖",
    "&nearr;": "↗",
    "&searr;": "↘",
    "&swarr;": "↙",
    "&nwArr;": "⇖",
    "&neArr;": "⇗",
    "&seArr;": "⇘",
    "&swArr;": "⇙",
    // Math symbols
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
    // Greek letters
    "&Alpha;": "Α", "&Beta;": "Β", "&Gamma;": "Γ", "&Delta;": "Δ", "&Epsilon;": "Ε",
    "&Zeta;": "Ζ", "&Eta;": "Η", "&Theta;": "Θ", "&Iota;": "Ι", "&Kappa;": "Κ",
    "&Lambda;": "Λ", "&Mu;": "Μ", "&Nu;": "Ν", "&Xi;": "Ξ", "&Omicron;": "Ο",
    "&Pi;": "Π", "&Rho;": "Ρ", "&Sigma;": "Σ", "&Tau;": "Τ", "&Upsilon;": "Υ",
    "&Phi;": "Φ", "&Chi;": "Χ", "&Psi;": "Ψ", "&Omega;": "Ω",
    "&alpha;": "α", "&beta;": "β", "&gamma;": "γ", "&delta;": "δ", "&epsilon;": "ε",
    "&zeta;": "ζ", "&eta;": "η", "&theta;": "θ", "&iota;": "ι", "&kappa;": "κ",
    "&lambda;": "λ", "&mu;": "μ", "&nu;": "ν", "&xi;": "ξ", "&omicron;": "ο",
    "&pi;": "π", "&rho;": "ρ", "&sigmaf;": "ς", "&sigma;": "σ", "&tau;": "τ",
    "&upsilon;": "υ", "&phi;": "φ", "&chi;": "χ", "&psi;": "ψ", "&omega;": "ω",
    // Ligatures and special
    "&OElig;": "Œ",
    "&oelig;": "œ",
    "&Scaron;": "Š",
    "&scaron;": "š",
    "&Yuml;": "Ÿ",
    "&fnof;": "ƒ",
    // Accented uppercase
    "&Agrave;": "À", "&Aacute;": "Á", "&Acirc;": "Â", "&Atilde;": "Ã", "&Auml;": "Ä", "&Aring;": "Å",
    "&AElig;": "Æ", "&Ccedil;": "Ç", "&Egrave;": "È", "&Eacute;": "É", "&Ecirc;": "Ê", "&Euml;": "Ë",
    "&Igrave;": "Ì", "&Iacute;": "Í", "&Icirc;": "Î", "&Iuml;": "Ï", "&Ntilde;": "Ñ",
    "&Ograve;": "Ò", "&Oacute;": "Ó", "&Ocirc;": "Ô", "&Otilde;": "Õ", "&Ouml;": "Ö",
    "&Oslash;": "Ø", "&Ugrave;": "Ù", "&Uacute;": "Ú", "&Ucirc;": "Û", "&Uuml;": "Ü",
    "&Yacute;": "Ý", "&Thorn;": "Þ",
    // Accented lowercase
    "&agrave;": "à", "&aacute;": "á", "&acirc;": "â", "&atilde;": "ã", "&auml;": "ä", "&aring;": "å",
    "&aelig;": "æ", "&ccedil;": "ç", "&egrave;": "è", "&eacute;": "é", "&ecirc;": "ê", "&euml;": "ë",
    "&igrave;": "ì", "&iacute;": "í", "&icirc;": "î", "&iuml;": "ï", "&ntilde;": "ñ",
    "&ograve;": "ò", "&oacute;": "ó", "&ocirc;": "ô", "&otilde;": "õ", "&ouml;": "ö",
    "&oslash;": "ø", "&ugrave;": "ù", "&uacute;": "ú", "&ucirc;": "û", "&uuml;": "ü",
    "&yacute;": "ý", "&thorn;": "þ", "&yuml;": "ÿ",
    "&szlig;": "ß",
    // Dashes and spaces
    "&ensp;": " ",
    "&emsp;": " ",
    "&thinsp;": " ",
    "&zwnj;": "",
    "&zwj;": "",
    "&lrm;": "",
    "&rlm;": "",
  };

  return decoded.replace(/&[^;]+;/g, (entity) => namedEntities[entity] || entity);
}
