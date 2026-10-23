import "server-only";

/**
 * Limitador simples em memória (janela deslizante) para login e 2FA.
 * Suficiente para 1 réplica. Com várias réplicas, troque por Redis.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, max = 8, windowMs = 10 * 60_000): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) {
    hits.set(key, list);
    return false;
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 10_000) hits.clear(); // proteção de memória
  return true;
}
