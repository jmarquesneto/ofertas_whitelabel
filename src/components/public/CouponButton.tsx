"use client";
import { useState } from "react";
import { Check, Copy, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";

export function CouponButton({ code, size = "sm" }: { code: string; size?: "sm" | "lg" }) {
  const [copied, setCopied] = useState(false);
  async function copy(e: React.MouseEvent) {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* sem clipboard: o código continua visível */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  const lg = size === "lg";
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copiar cupom ${code}`}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg border border-dashed border-ink/25 bg-surface-sunken text-left transition hover:border-ink/50",
        lg ? "px-4 py-3" : "px-2.5 py-1.5",
      )}
    >
      <Ticket className={cn("shrink-0 text-ink-faint", lg ? "h-5 w-5" : "h-3.5 w-3.5")} />
      <span className="min-w-0 flex-1">
        {lg && <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Cupom</span>}
        <span className={cn("block truncate font-mono font-bold tracking-wide text-ink", lg ? "text-base" : "text-xs")}>{code}</span>
      </span>
      <span className={cn("flex shrink-0 items-center gap-1 font-semibold text-ink-muted", lg ? "text-sm" : "text-[11px]")} aria-live="polite">
        {copied ? <><Check className="h-3.5 w-3.5 text-price" /> Copiado</> : <><Copy className="h-3.5 w-3.5" /> Copiar</>}
      </span>
    </button>
  );
}
