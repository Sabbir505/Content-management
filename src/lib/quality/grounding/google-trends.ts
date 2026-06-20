import { spawn } from "child_process";
import path from "path";
import type { GoogleTrendsResult } from "../types";
import * as cache from "../cache";

const TRENDS_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours
const PYTHON_TIMEOUT = 15000; // 15 seconds

function getPythonScriptPath(): string {
  return path.join(process.cwd(), "src", "scripts", "pytrends_fetcher.py");
}

function callPythonScript(input: {
  keyword: string;
  timeframe?: string;
}): Promise<GoogleTrendsResult> {
  return new Promise((resolve, reject) => {
    const scriptPath = getPythonScriptPath();
    const python = spawn("python", [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    python.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    python.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      python.kill();
      reject(new Error("Python script timed out"));
    }, PYTHON_TIMEOUT);

    python.on("close", (code: number) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Python script exited with code ${code}: ${stderr}`));
        return;
      }
      try {
        const result = JSON.parse(stdout.trim());
        if (result.error) {
          reject(new Error(result.error));
          return;
        }
        resolve({
          primaryKeyword: result.primaryKeyword || input.keyword,
          searchScore: result.searchScore || 0,
          trendDirection: result.trendDirection || "stable",
          relatedRising: result.relatedRising || [],
          relatedTop: result.relatedTop || [],
          seasonal: result.seasonal || false,
          recommendedTags: result.recommendedTags || [],
          fetchedAt: new Date().toISOString(),
        });
      } catch {
        reject(new Error(`Failed to parse Python output: ${stdout}`));
      }
    });

    python.stdin.write(JSON.stringify(input));
    python.stdin.end();
  });
}

function getFallbackResult(keyword: string): GoogleTrendsResult {
  return {
    primaryKeyword: keyword,
    searchScore: 0,
    trendDirection: "stable",
    relatedRising: [],
    relatedTop: [],
    seasonal: false,
    recommendedTags: [],
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchGoogleTrends(
  keyword: string
): Promise<GoogleTrendsResult> {
  const cacheKey = `trends:${keyword.toLowerCase()}`;

  const cached = cache.get<GoogleTrendsResult>(cacheKey);
  if (cached) return cached;

  try {
    const result = await callPythonScript({ keyword });
    cache.set(cacheKey, result, TRENDS_CACHE_TTL);
    return result;
  } catch (error) {
    console.warn(`Google Trends fetch failed for "${keyword}":`, error);
    const fallback = getFallbackResult(keyword);
    cache.set(cacheKey, fallback, TRENDS_CACHE_TTL);
    return fallback;
  }
}

export async function fetchTrendsForKeywords(
  keywords: string[]
): Promise<GoogleTrendsResult[]> {
  return Promise.all(keywords.map((kw) => fetchGoogleTrends(kw)));
}
