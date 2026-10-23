"use client";
import { useState } from "react";

export function CouponButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* navegadores antigos: o código continua visível para copiar manualmente */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="group flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-secondary/50 bg-secondary/5 px-3 py-2 text-left transition hover:bg-secondary/10"
      aria-label={`Copiar cupom ${code}`}
    >
      <span className="min-w-0">
        <span className="block text-[11px] font-medium uppercase tracking-wider text-ink-muted">Cupom</span>
        <span className="block truncate font-mono text-sm font-bold tracking-wide text-secondary">{code}</span>
      </span>
      <span className="shrink-0 text-xs font-semibold text-secondary" aria-live="polite">
        {copied ? "Copiado ✓" : "Copiar"}
      </span>
    </button>
  );
}
