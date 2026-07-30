import { lookup } from "dns";
import { promisify } from "util";

const dnsLookup = promisify(lookup);

function isPrivateIp(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "0.0.0.0" || ip === "::1" || ip === "[::1]") {
    return true;
  }

  const ipv4Match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
    if (a === 0 && b === 0) return true;
    if (a === 169 && b === 254) return true;
  }

  return false;
}

async function resolveAndCheckPrivate(hostname: string): Promise<boolean> {
  try {
    const { address } = await dnsLookup(hostname);
    return isPrivateIp(address);
  } catch {
    return true;
  }
}

export async function validateUrl(
  urlString: string
): Promise<{ valid: false; error: string } | { valid: true; url: URL }> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { valid: false, error: "Invalid URL" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: "Only HTTP and HTTPS URLs are allowed" };
  }

  if (isPrivateIp(parsed.hostname)) {
    return { valid: false, error: "Private IP addresses and localhost are not allowed" };
  }

  const isPrivate = await resolveAndCheckPrivate(parsed.hostname);
  if (isPrivate) {
    return { valid: false, error: "Private IP addresses and localhost are not allowed" };
  }

  return { valid: true, url: parsed };
}
