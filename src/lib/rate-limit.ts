type Entry = { count: number; resetAt: number };
const buckets = new Map<string, Entry>();

/** Best-effort per-process guard for expensive operations; use a shared edge limiter for multi-instance quotas. */
export function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  let entry = buckets.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    buckets.set(key, entry);
  }
  if (entry.count >= limit) return { allowed: false, retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  entry.count++;
  if (buckets.size > 5000) {
    for (const [bucketKey, value] of buckets) if (now >= value.resetAt) buckets.delete(bucketKey);
  }
  return { allowed: true, retryAfter: 0 };
}
