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
