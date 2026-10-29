"use client";
import { useState } from "react";
import { ArrowRight, Check, Copy, LockOpen, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";

export type CouponItem = {
  id: number; code: string; highlight: string | null; title: string; rest: string | null; details: string | null; isToday: boolean;
};

/**
 * Cupons borrados até a pessoa clicar em "Desbloquear": um clique abre a loja
 * (link de afiliado, em nova aba) UMA vez e libera todos os códigos.
 * O desbloqueio vale só para esta visita (sai e volta = borrado de novo).
 */
export function CouponUnlock({ storeName, storeLink, items }: { storeName: string; storeLink: string | null; items: CouponItem[] }) {
  const [unlocked, setUnlocked] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  const unlock = () => {
    if (!unlocked && storeLink) window.open(storeLink, "_blank", "noopener");
    setUnlocked(true);
  };
  const copy = async (it: CouponItem) => {
    try { await navigator.clipboard.writeText(it.code); } catch { /* o código continua visível */ }
    setCopied(it.id);
    setTimeout(() => setCopied((c) => (c === it.id ? null : c)), 1800);
  };

  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 mb-4 bg-surface/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0">
        {!unlocked ? (
          <button type="button" onClick={unlock}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-price px-6 py-4 text-base font-extrabold text-white shadow-card transition hover:brightness-95 sm:w-auto">
            <LockOpen className="h-5 w-5" /> Desbloquear todos os cupons
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex items-center gap-2 text-sm font-bold text-price"><Check className="h-5 w-5" /> Cupons desbloqueados. Toque no código para copiar.</p>
            {storeLink && (
              <a href={storeLink} target="_blank" rel="nofollow sponsored noopener" className="btn-ghost py-2 text-sm">
                Ir para a {storeName} <ArrowRight className="h-4 w-4" />
              </a>
            )}
          </div>
        )}
      </div>

      <ul className="grid gap-3">
        {items.map((it) => {
          const [big, small] = it.highlight ? splitBig(it.highlight) : [null, null];
          return (
            <li key={it.id} className="card grid gap-4 p-4 sm:grid-cols-[120px_1fr_220px] sm:items-center sm:p-5">
              <div className="flex items-center gap-3 sm:block sm:border-r sm:border-line sm:pr-4 sm:text-center">
                {big ? (
                  <p className="text-price">
                    <span className="block text-3xl font-black leading-none">{big}</span>
                    {small && <span className="block text-lg font-black leading-tight">{small}</span>}
                  </p>
                ) : (
                  <Ticket className="h-9 w-9 text-price sm:mx-auto" strokeWidth={2.2} />
                )}
                <span className="text-xs font-semibold text-ink-faint sm:mt-1 sm:block">Código</span>
              </div>

              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-lg font-extrabold leading-snug">
                  {it.title}
                  {it.isToday && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-extrabold text-primary-fg">NOVO HOJE</span>}
                </p>
                {it.rest && <p className="mt-1 text-sm text-ink-muted">{it.rest}</p>}
                {it.details && <p className="mt-1 text-xs text-ink-faint">{it.details}</p>}
              </div>

              {!unlocked ? (
                <button type="button" onClick={unlock} aria-label="Ver cupom"
                  className="group relative flex h-14 items-center justify-end overflow-hidden rounded-xl border-2 border-dashed border-price/50 bg-price/5 pr-3">
                  {/* final do código borrado aparecendo à direita, como uma etiqueta */}
                  <span aria-hidden className="select-none font-mono text-lg font-bold tracking-widest text-ink blur-[3px]">{it.code}</span>
                  <span className="absolute inset-y-0 left-0 flex w-[66%] items-center justify-center rounded-r-2xl bg-price text-base font-extrabold text-white shadow-[6px_0_10px_-4px_rgba(0,0,0,0.25)] transition group-hover:w-[62%]">
                    Ver cupom
                  </span>
                </button>
              ) : (
                <button type="button" onClick={() => copy(it)} aria-label={`Copiar cupom ${it.code}`}
                  className="flex h-14 items-center justify-between gap-2 rounded-xl border-2 border-dashed border-price bg-white px-4 transition hover:bg-price/5">
                  <span className="truncate font-mono text-lg font-bold tracking-wider">{it.code}</span>
                  <span className={cn("flex shrink-0 items-center gap-1 text-sm font-bold", copied === it.id ? "text-price" : "text-ink-muted")} aria-live="polite">
                    {copied === it.id ? <><Check className="h-4 w-4" /> Copiado</> : <><Copy className="h-4 w-4" /> Copiar</>}
                  </span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** "15% OFF" → ["15%", "OFF"]; "R$ 80 OFF" → ["R$ 80", "OFF"]; "FRETE GRÁTIS" → ["FRETE", "GRÁTIS"] */
function splitBig(h: string): [string, string | null] {
  const m = h.match(/^(.*?)\s+(OFF|GRÁTIS)$/i);
  return m ? [m[1], m[2].toUpperCase()] : [h, null];
}
