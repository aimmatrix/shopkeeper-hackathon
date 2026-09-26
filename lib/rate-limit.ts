// Per-instance fixed-window limiter: per client and in total, to bound what a public caller can do.
export function createRateLimiter({ perClient = 12, total = 60, windowMs = 60_000, now = Date.now } = {}) {
  const hits = new Map<string, number[]>();
  return {
    take(client: string) {
      const t = now();
      const recent = (key: string) => (hits.get(key) ?? []).filter(x => t - x < windowMs);
      const mine = recent(`client:${client}`), all = recent('total');
      const full = mine.length >= perClient ? mine : all.length >= total ? all : null;
      if (full) return { ok: false, retryAfter: Math.max(1, Math.ceil((full[0] + windowMs - t) / 1000)) };
      hits.set(`client:${client}`, [...mine, t]);
      hits.set('total', [...all, t]);
      if (hits.size > 5000) for (const [key, times] of hits) if (!times.some(x => t - x < windowMs)) hits.delete(key);
      return { ok: true, retryAfter: 0 };
    },
  };
}
export type RateLimiter = ReturnType<typeof createRateLimiter>;
