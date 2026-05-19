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

export function createRateLimiter(opts: RateLimiterOptions) {
  const { capacity, refillPerSec, maxKeys = 10_000 } = opts;
  const buckets = new Map<string, Bucket>();

  function take(key: string, now: number): boolean {
    let b = buckets.get(key);
    if (!b) {
      // Crude eviction: if we hit the cap, drop the oldest insertion.
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
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }

  return function rateLimit(req: Request, res: Response, next: () => void): void {
    const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    if (take(key, Date.now())) {
      next();
      return;
    }
    const retryAfter = Math.max(1, Math.ceil(1 / refillPerSec));
    res.set('Retry-After', String(retryAfter));
    res.status(429).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Rate limit exceeded' },
      id: null,
    });
  };
}
