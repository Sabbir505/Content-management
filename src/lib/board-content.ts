// Escapes plain-text card content and turns bare URLs into clickable links
// and newlines into <br>, so a saved video/article description renders
// readably inside the contentEditable card editor. Content that already
// looks like HTML (a previously edited/rich card) is returned unchanged.

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHref(url: string): string {
  const trimmed = url.trim();
  // Allow http(s) and relative links only; block javascript:, data:, vbscript:, etc.
  if (/^(https?:\/\/|\/|#|mailto:)/i.test(trimmed)) return trimmed;
  return "#";
}

function linkify(text: string): string {
  // Match bare URLs (http/https) after escaping. run on the escaped string so
  // the URL characters themselves are safe to drop into an href attribute.
  return text.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
    const href = safeHref(url);
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-emerald-400 underline hover:text-emerald-300 break-all">${url}</a>`;
  });
}

export function plainTextToEditableHtml(content: string): string {
  if (!content) return "";
  // Already-HTML content (a previously edited rich card) — leave untouched.
  if (/<[a-z][\s\S]*>/i.test(content)) return content;

  const escaped = escapeHtml(content);
  const linked = linkify(escaped);
  return linked.replace(/\r?\n/g, "<br>");
}
