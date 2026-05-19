const ROOT_URL = 'https://api.helldivers2.dev';
const CACHE_TTL_MS = 2 * 60 * 1000;

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const responseCache = new Map<string, CacheEntry>();

const rateLimitState = {
  limit: 5,
  remaining: 5,
  windowMs: 10_000,
  retryAfterMs: 0,
  lastRequestTime: 0,
};

const requestTimestamps: number[] = [];

interface QueueEntry {
  endpoint: string;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

const requestQueue: QueueEntry[] = [];
let isProcessingQueue = false;

class RateLimitError extends Error {
  retryAfterMs: number;
  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

function updateRateLimitFromHeaders(headers: Headers): void {
  const limit = headers.get('X-Ratelimit-Limit');
  const remaining = headers.get('X-RateLimit-Remaining');
  if (limit !== null) {
    const parsed = parseInt(limit, 10);
    if (!isNaN(parsed) && parsed > 0) rateLimitState.limit = parsed;
  }
  if (remaining !== null) {
    const parsed = parseInt(remaining, 10);
    if (!isNaN(parsed)) rateLimitState.remaining = parsed;
  }
  rateLimitState.lastRequestTime = Date.now();
}

function handleRetryAfter(headers: Headers): number {
  const retryAfter = headers.get('Retry-After');
  if (retryAfter !== null) {
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds) && seconds > 0) {
      rateLimitState.retryAfterMs = seconds * 1000;
      rateLimitState.remaining = 0;
      console.warn(`[hd2] Rate limited by server, retry after ${seconds}s`);
      return seconds * 1000;
    }
  }
  return 0;
}

function cleanupOldTimestamps(): void {
  const cutoff = Date.now() - rateLimitState.windowMs;
  while (requestTimestamps.length > 0 && requestTimestamps[0] < cutoff) {
    requestTimestamps.shift();
  }
}

function getWaitTime(): number {
  if (rateLimitState.retryAfterMs > 0) {
    const elapsed = Date.now() - rateLimitState.lastRequestTime;
    const waitTime = rateLimitState.retryAfterMs - elapsed;
    if (waitTime > 0) return waitTime + 50;
    rateLimitState.retryAfterMs = 0;
  }

  const timeSinceLast = Date.now() - rateLimitState.lastRequestTime;
  if (rateLimitState.lastRequestTime > 0 && timeSinceLast < rateLimitState.windowMs) {
    if (rateLimitState.remaining <= 0) {
      return rateLimitState.windowMs - timeSinceLast + 50;
    }
    return 0;
  }

  cleanupOldTimestamps();
  if (requestTimestamps.length < rateLimitState.limit) return 0;
  const oldest = requestTimestamps[0];
  return oldest + rateLimitState.windowMs - Date.now() + 50;
}

async function executeRequest<T>(endpoint: string): Promise<T> {
  requestTimestamps.push(Date.now());
  const res = await fetch(`${ROOT_URL}${endpoint}`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'X-Super-Client': 'helldivers2-mcp',
      'X-Super-Contact': process.env.X_SUPER_CONTACT ?? '',
    },
  });

  updateRateLimitFromHeaders(res.headers);

  if (res.status === 429) {
    const retryMs = handleRetryAfter(res.headers);
    throw new RateLimitError('Rate limited', retryMs);
  }
  if (!res.ok) {
    throw new Error(`HTTP error from ${endpoint}: status ${res.status}`);
  }
  const data = (await res.json()) as T;
  responseCache.set(endpoint, { value: data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

async function processQueue(): Promise<void> {
  if (isProcessingQueue) return;
  isProcessingQueue = true;
  try {
    while (requestQueue.length > 0) {
      const wait = getWaitTime();
      if (wait > 0) {
        console.info(`[hd2] Rate limit reached, waiting ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
      }
      const entry = requestQueue.shift()!;
      try {
        const result = await executeRequest(entry.endpoint);
        entry.resolve(result);
      } catch (err) {
        if (err instanceof RateLimitError) {
          requestQueue.unshift(entry);
          const retryWait = err.retryAfterMs || rateLimitState.windowMs;
          console.info(`[hd2] Re-queuing request, waiting ${retryWait}ms`);
          await new Promise((r) => setTimeout(r, retryWait));
        } else {
          entry.reject(err);
        }
      }
    }
  } finally {
    isProcessingQueue = false;
  }
}

export function hd2Fetch<T>(endpoint: string): Promise<T> {
  const cached = responseCache.get(endpoint);
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.value as T);
  }
  if (cached) responseCache.delete(endpoint);

  return new Promise<T>((resolve, reject) => {
    requestQueue.push({
      endpoint,
      resolve: resolve as (v: unknown) => void,
      reject,
    });
    processQueue().catch((err) => {
      console.error('[hd2] Queue processing failed:', err);
      reject(err);
    });
  });
}
