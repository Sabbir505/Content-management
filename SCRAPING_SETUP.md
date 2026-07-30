# Social Media Scraping Setup Guide

> **⚠️ Superseded — much of this doc does not match the current code.**
>
> The proxy-pool / session-cookie / CAPTCHA infrastructure described below
> (env vars `PROXY_URL`, `PROXY_1`-`PROXY_10`, `X_COOKIES`,
> `INSTAGRAM_COOKIES`, `TIKTOK_COOKIES`, `LINKEDIN_COOKIES`,
> `TWOCAPTCHA_API_KEY`, `ANTICAPTCHA_API_KEY` and the `npm run test:scrapers`
> / `test-scrapers.ts` / `test-full-integration.ts` scripts) is **not present**
> in the codebase. The Instagram, TikTok, LinkedIn, and X/Twitter scrapers that
> would have consumed those cookies were removed in a prior cleanup — the only
> active content sources are now Hacker News, DEV.to, and Substack, none of
> which require cookies or CAPTCHA solving.
>
> **What the code actually does** (`src/lib/proxy.ts`):
> - Reads the standard `HTTPS_PROXY` / `https_proxy` / `HTTP_PROXY` /
>   `http_proxy` env vars.
> - If none are set, auto-detects a proxy on common local ports
>   (7890, 7897, 1080, 10809, 8080, 8118).
> - `proxyFetch` runs every outbound URL through an SSRF guard
>   (`validateUrl` in `src/lib/url-validation.ts`) that rejects private /
>   loopback / non-http targets.
>
> The rest of this file is retained as a historical reference for the
> residential-proxy / cookie-rotation design that was planned but never landed.
> Treat it as design notes, not a working setup guide.

---

This guide explains how to configure and use the advanced scraping infrastructure with proxy rotation, session cookies, rate limiting, and CAPTCHA solving.

## Table of Contents

1. [Residential Proxies](#residential-proxies)
2. [Session Cookies](#session-cookies)
3. [Rate Limiting](#rate-limiting)
4. [CAPTCHA Solving](#captcha-solving)
5. [Environment Variables](#environment-variables)
6. [Testing](#testing)

---

## Residential Proxies

### What You Need

Residential proxies rotate your IP address to avoid blocks. Popular providers:

- **Bright Data** (formerly Luminati) - `https://brightdata.com`
- **Oxylabs** - `https://oxylabs.io`
- **Smartproxy** - `https://smartproxy.com`
- **Proxy-Cheap** - `https://proxy-cheap.com`
- **IPRoyal** - `https://iproyal.com`

### Setup

1. Sign up for a residential proxy service
2. Get your proxy URL in format: `http://user:pass@host:port`
3. Add to your `.env.local` file:

```env
# Single proxy
PROXY_URL=http://user:pass@proxy.example.com:8080

# Multiple proxies (up to 10)
PROXY_1=http://user1:pass1@proxy1.example.com:8080
PROXY_2=http://user2:pass2@proxy2.example.com:8080
PROXY_3=http://user3:pass3@proxy3.example.com:8080
```

### How It Works

- Proxies are automatically rotated using weighted round-robin
- Failed proxies are temporarily disabled after 3 failures
- Proxy with longest time since use is prioritized

---

## Session Cookies

### What You Need

Session cookies from logged-in accounts allow scraping authenticated content. You need accounts on each platform.

### How to Get Cookies

#### X/Twitter

1. Log in to X/Twitter in Chrome
2. Open DevTools (F12) → Application → Cookies
3. Copy the value of `auth_token` cookie
4. Format: `auth_token=YOUR_TOKEN; ct0=YOUR_CT0`

#### Instagram

1. Log in to Instagram in Chrome
2. Open DevTools → Application → Cookies
3. Copy the value of `sessionid` cookie
4. Format: `sessionid=YOUR_SESSION_ID; csrftoken=YOUR_CSRF`

#### TikTok

1. Log in to TikTok in Chrome
2. Open DevTools → Application → Cookies
3. Copy the value of `sessionid` cookie
4. Format: `sessionid=YOUR_SESSION_ID`

#### LinkedIn

1. Log in to LinkedIn in Chrome
2. Open DevTools → Application → Cookies
3. Copy the value of `li_at` cookie
4. Format: `li_at=YOUR_LI_AT; JSESSIONID=YOUR_JSESSIONID`

### Setup

Add to your `.env.local` file:

```env
# X/Twitter cookies (semicolon-separated)
X_COOKIES=auth_token=abc123;ct0=def456,auth_token=ghi789;ct0=jkl012

# Instagram cookies
INSTAGRAM_COOKIES=sessionid=abc123;csrftoken=def456,sessionid=ghi789;csrftoken=jkl012

# TikTok cookies
TIKTOK_COOKIES=sessionid=abc123,sessionid=def456

# LinkedIn cookies
LINKEDIN_COOKIES=li_at=abc123;JSESSIONID=def456,li_at=ghi789;JSESSIONID=jkl012
```

### How It Works

- Cookies are rotated using round-robin with use-count balancing
- Each request gets a different session to distribute load
- Sessions with lowest use count are prioritized

---

## Rate Limiting

### Default Configuration

Rate limits are pre-configured per platform:

| Platform | Requests/Min | Base Delay | Max Retries |
|----------|-------------|------------|-------------|
| X        | 5           | 5s         | 3           |
| Instagram| 8           | 3s         | 3           |
| LinkedIn | 3           | 10s        | 2           |
| TikTok   | 10          | 2s         | 3           |

### How It Works

- Each request waits for its rate limit slot
- Failed requests are retried with exponential backoff
- Base delay doubles with each retry attempt
- Maximum delay is capped at 60 seconds

---

## CAPTCHA Solving

### What You Need

CAPTCHA solving services use human workers or AI to solve challenges:

- **2Captcha** - `https://2captcha.com` (cheapest, ~$0.5-3 per 1000 solves)
- **Anti-Captcha** - `https://anti-captcha.com` (faster, ~$2-5 per 1000 solves)
- **CapSolver** - `https://capsolver.com` (AI-based, fastest)

### Setup

1. Sign up for a CAPTCHA solving service
2. Get your API key
3. Add to your `.env.local` file:

```env
# 2Captcha
TWOCAPTCHA_API_KEY=your_api_key_here

# OR Anti-Captcha
ANTICAPTCHA_API_KEY=your_api_key_here
```

### How It Works

- When a CAPTCHA is detected, it's automatically sent to the solving service
- The scraper waits for the solution (up to 5 minutes)
- Once solved, the token is injected into the page
- If no solver is configured, the scraper skips CAPTCHA-protected pages

---

## Environment Variables

### Complete `.env.local` Example

```env
# ============================================
# Proxy Configuration
# ============================================
# Single proxy
PROXY_URL=http://user:pass@proxy.example.com:8080

# Multiple proxies (up to 10)
PROXY_1=http://user1:pass1@proxy1.example.com:8080
PROXY_2=http://user2:pass2@proxy2.example.com:8080
PROXY_3=http://user3:pass3@proxy3.example.com:8080

# ============================================
# Session Cookies
# ============================================
# X/Twitter
X_COOKIES=auth_token=abc123;ct0=def456

# Instagram
INSTAGRAM_COOKIES=sessionid=abc123;csrftoken=def456

# TikTok
TIKTOK_COOKIES=sessionid=abc123

# LinkedIn
LINKEDIN_COOKIES=li_at=abc123;JSESSIONID=def456

# ============================================
# CAPTCHA Solving
# ============================================
TWOCAPTCHA_API_KEY=your_2captcha_key
# OR
ANTICAPTCHA_API_KEY=your_anticaptcha_key
```

---

## Testing

### Basic Test

```bash
npm run test:scrapers
```

### With Real Proxies

1. Add your proxy to `.env.local`
2. Run the test:

```bash
# Test with proxy
PROXY_URL=http://your-proxy:port npx tsx src/lib/content/test-scrapers.ts
```

### With Session Cookies

1. Add your cookies to `.env.local`
2. Run the test:

```bash
# Test with cookies
X_COOKIES=auth_token=your_token npx tsx src/lib/content/test-scrapers.ts
```

### Full Integration Test

```bash
# Test with all features enabled
npx tsx src/lib/content/test-full-integration.ts
```

---

## Troubleshooting

### "Request timeout after 10000ms"

- Your proxy may be slow or blocked
- Try a different proxy provider
- Increase timeout in the scraper code

### "Invalid or expired token"

- Your session cookies have expired
- Refresh cookies by logging in again
- Copy fresh cookies from the browser

### "CAPTCHA detected but no solver configured"

- Add a CAPTCHA solving service API key
- Or reduce request frequency to avoid triggering CAPTCHA

### "Rate limited"

- Reduce requests per minute in rate limiter config
- Add more proxies for rotation
- Use session cookies to reduce blocks

---

## Cost Estimates

| Service | Monthly Cost (1000 requests/day) |
|---------|----------------------------------|
| Residential Proxy (Bright Data) | $50-200 |
| Residential Proxy (Smartproxy) | $30-100 |
| 2Captcha | $15-50 |
| Anti-Captcha | $30-100 |
| **Total** | **$95-400/month** |

---

## Security Notes

1. **Never commit `.env.local`** - It contains sensitive credentials
2. **Rotate cookies regularly** - At least once per week
3. **Use dedicated accounts** - Don't use personal accounts for scraping
4. **Monitor for blocks** - Check logs regularly
5. **Respect rate limits** - Don't overwhelm platforms
