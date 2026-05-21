import type { Request, Response } from 'express';

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export interface RateLimiterOptions {
  capacity: number;
  refillPerSec: number;
  maxKeys?: number;
}

export interface TakeResult {
  allowed: boolean;
  retryAfter: number;
}

export interface TokenBucket {
  take(key: string): TakeResult;
}

export function createTokenBucket(opts: RateLimiterOptions): TokenBucket {
  const { capacity, refillPerSec, maxKeys = 10_000 } = opts;
  const buckets = new Map<string, Bucket>();
  const retryAfter = Math.max(1, Math.ceil(1 / refillPerSec));

  function take(key: string): TakeResult {
    const now = Date.now();
    let b = buckets.get(key);
    if (!b) {
      if (buckets.size >= maxKeys) {
        const oldest = buckets.keys().next().value;
        if (oldest !== undefined) buckets.delete(oldest);
      }
      b = { tokens: capacity, updatedAt: now };
      buckets.set(key, b);
    } else {
      const elapsed = (now - b.updatedAt) / 1000;
      b.tokens = Math.min(capacity, b.tokens + elapsed * refillPerSec);
      b.updatedAt = now;
    }
    if (b.tokens < 1) return { allowed: false, retryAfter };
    b.tokens -= 1;
    return { allowed: true, retryAfter };
  }

  return { take };
}

export function createRateLimiter(opts: RateLimiterOptions) {
  const bucket = createTokenBucket(opts);

  return function rateLimit(req: Request, res: Response, next: () => void): void {
    const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const result = bucket.take(key);
    if (result.allowed) {
      next();
      return;
    }
    res.set('Retry-After', String(result.retryAfter));
    res.status(429).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Rate limit exceeded' },
      id: null,
    });
  };
}
