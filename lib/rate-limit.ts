import { AppError } from "@/lib/errors";

type Bucket = { count: number; resetAt: number };

type GlobalRateStore = typeof globalThis & {
  __whiskFlowRateLimit?: Map<string, Bucket>;
};

function store(): Map<string, Bucket> {
  const globalStore = globalThis as GlobalRateStore;
  if (!globalStore.__whiskFlowRateLimit) {
    globalStore.__whiskFlowRateLimit = new Map();
  }
  return globalStore.__whiskFlowRateLimit;
}

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

/**
 * Small in-process limiter for a single Node server. For multi-instance
 * deployments, put a shared limiter (Upstash/Redis) in front of these routes.
 */
export function checkRateLimit({ key, limit, windowMs }: RateLimitOptions): void {
  const now = Date.now();
  const buckets = store();
  if (buckets.size > 5_000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt < now) buckets.delete(bucketKey);
    }
  }
  const current = buckets.get(key);
  if (!current || current.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  current.count += 1;
  if (current.count > limit) {
    const seconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    throw new AppError(
      429,
      "rate_limited",
      `Too many requests. Try again in ${seconds} second${seconds === 1 ? "" : "s"}.`,
    );
  }
}

export function clientKey(request: Request, suffix: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "local";
  return `${suffix}:${ip}`;
}
