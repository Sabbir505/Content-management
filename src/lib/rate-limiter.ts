interface RateLimitConfig {
  minDelayMs: number;
  maxConcurrent: number;
  retryAttempts: number;
  retryDelayBaseMs: number;
  name: string;
}

const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  youtube: {
    name: "YouTube",
    minDelayMs: 3500,
    maxConcurrent: 1,
    retryAttempts: 3,
    retryDelayBaseMs: 5000,
  },
  reddit: {
    name: "Reddit",
    minDelayMs: 1000,
    maxConcurrent: 2,
    retryAttempts: 3,
    retryDelayBaseMs: 2000,
  },
  devto: {
    name: "DEV.to",
    minDelayMs: 200,
    maxConcurrent: 3,
    retryAttempts: 2,
    retryDelayBaseMs: 1000,
  },
  hackernews: {
    name: "Hacker News",
    minDelayMs: 0,
    maxConcurrent: 5,
    retryAttempts: 2,
    retryDelayBaseMs: 1000,
  },
  substack: {
    name: "Substack",
    minDelayMs: 500,
    maxConcurrent: 3,
    retryAttempts: 2,
    retryDelayBaseMs: 2000,
  },
  x: {
    name: "X/Twitter",
    minDelayMs: 2000,
    maxConcurrent: 1,
    retryAttempts: 3,
    retryDelayBaseMs: 5000,
  },
  instagram: {
    name: "Instagram",
    minDelayMs: 2000,
    maxConcurrent: 1,
    retryAttempts: 2,
    retryDelayBaseMs: 5000,
  },
  tiktok: {
    name: "TikTok",
    minDelayMs: 1500,
    maxConcurrent: 2,
    retryAttempts: 2,
    retryDelayBaseMs: 3000,
  },
  linkedin: {
    name: "LinkedIn",
    minDelayMs: 2000,
    maxConcurrent: 1,
    retryAttempts: 2,
    retryDelayBaseMs: 5000,
  },
  default: {
    name: "Default",
    minDelayMs: 500,
    maxConcurrent: 3,
    retryAttempts: 2,
    retryDelayBaseMs: 2000,
  },
};

interface QueuedTask<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

class RateLimiter {
  private lastRequestTime: Map<string, number> = new Map();
  private activeRequests: Map<string, number> = new Map();
  private queues: Map<string, QueuedTask<unknown>[]> = new Map();
  private processing: Map<string, boolean> = new Map();

  private getConfig(source: string): RateLimitConfig {
    return DEFAULT_CONFIGS[source] || DEFAULT_CONFIGS.default;
  }

  private async processQueue(source: string): Promise<void> {
    // Prevent concurrent processing of the same queue
    if (this.processing.get(source)) return;
    this.processing.set(source, true);

    try {
      while (true) {
        const queue = this.queues.get(source);
        if (!queue || queue.length === 0) break;

        const config = this.getConfig(source);
        const currentActive = this.activeRequests.get(source) || 0;

        if (currentActive >= config.maxConcurrent) break;

        const task = queue.shift();
        if (!task) break;

        this.activeRequests.set(source, currentActive + 1);

        const now = Date.now();
        const lastRequest = this.lastRequestTime.get(source) || 0;
        const delayNeeded = Math.max(0, lastRequest + config.minDelayMs - now);

        if (delayNeeded > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayNeeded));
        }

        this.lastRequestTime.set(source, Date.now());

        try {
          const result = await task.execute();
          task.resolve(result);
        } catch (error) {
          task.reject(error);
        } finally {
          const newActive = (this.activeRequests.get(source) || 0) - 1;
          this.activeRequests.set(source, Math.max(0, newActive));
        }
      }
    } finally {
      this.processing.set(source, false);
      // Schedule next queue processing in case more tasks were added
      const queue = this.queues.get(source);
      if (queue && queue.length > 0) {
        setTimeout(() => this.processQueue(source), 0);
      }
    }
  }

  async execute<T>(source: string, task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const queue = this.queues.get(source) || [];
      queue.push({ execute: task, resolve: resolve as (value: unknown) => void, reject } as QueuedTask<unknown>);
      this.queues.set(source, queue);
      this.processQueue(source);
    });
  }

  async executeWithRetry<T>(
    source: string,
    task: () => Promise<T>,
    options?: { isRetryable?: (error: unknown) => boolean }
  ): Promise<T> {
    const config = this.getConfig(source);
    let lastError: unknown;

    for (let attempt = 0; attempt <= config.retryAttempts; attempt++) {
      try {
        return await this.execute(source, task);
      } catch (error) {
        lastError = error;

        if (attempt === config.retryAttempts) break;

        const isRetryable = options?.isRetryable || defaultIsRetryable;
        if (!isRetryable(error)) throw error;

        const delay = config.retryDelayBaseMs * Math.pow(2, attempt);
        const jitter = Math.random() * 1000;
        const totalDelay = delay + jitter;

        console.warn(
          `[RateLimiter] ${config.name} attempt ${attempt + 1} failed, retrying in ${Math.round(totalDelay)}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, totalDelay));
      }
    }

    throw lastError;
  }
}

function defaultIsRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("rate limit") || message.includes("429") || message.includes("too many requests")) {
      return true;
    }
    if (message.includes("timeout") || message.includes("etimedout")) {
      return true;
    }
    if (message.includes("econnrefused") || message.includes("econnreset")) {
      return true;
    }
    if (message.includes("403") || message.includes("forbidden")) {
      return true;
    }
    if (message.includes("500") || message.includes("502") || message.includes("503")) {
      return true;
    }
  }
  return false;
}

export const rateLimiter = new RateLimiter();
export { DEFAULT_CONFIGS };
export type { RateLimitConfig };
