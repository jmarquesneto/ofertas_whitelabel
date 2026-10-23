export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function timeLeft(expiresAt: Date): string {
  const ms = expiresAt.getTime() - Date.now();
  if (ms <= 0) return "Expirada";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h >= 1) return `${h}h`;
  return `${Math.max(1, Math.floor(ms / 60_000))} min`;
}

export const fmtInt = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

export const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: process.env.TZ || "America/Sao_Paulo",
  }).format(d);

/** Resultado padrão das Server Actions (usado com useActionState) */
export type ActionState = { ok?: boolean; error?: string; message?: string; fieldErrors?: Record<string, string> };

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
/** "1849.90" → "R$ 1.849,90" */
export const fmtBRL = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? null : BRL.format(Number(v)).replace(/\u00a0/g, " ");

/** % de desconto inteiro entre preço original e atual (ou null) */
export function discountPct(price: string | number | null | undefined, original: string | number | null | undefined) {
  const p = Number(price), o = Number(original);
  if (!p || !o || o <= p) return null;
  return Math.round((1 - p / o) * 100);
}
