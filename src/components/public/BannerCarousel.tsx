"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Icon } from "@/components/Icon";
import { onColor } from "@/lib/color";
import { cn } from "@/lib/utils";

export type SlideData = {
  id: number;
  kind: string;
  headline: string | null;
  highlight: string | null;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  openNewTab: boolean;
  imagePath: string | null;
  mobileImagePath: string | null;
  bgColor: string | null;
  showBadges: boolean;
};
type Badge = { icon: string; label: string };

/**
 * Carrossel do topo da home. Todos os slides ocupam a mesma célula do grid
 * (a altura é a do maior) e trocam com fade — sem pulo de layout.
 * Autoplay pausa no hover/foco, respeita "reduzir movimento" e aceita swipe.
 */
export function BannerCarousel({ slides, badges, intervalSec }: { slides: SlideData[]; badges: Badge[]; intervalSec: number }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const n = slides.length;
  const go = useCallback((to: number) => setI(((to % n) + n) % n), [n]);

  useEffect(() => {
    if (n < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), Math.max(3, intervalSec) * 1000);
    return () => clearInterval(t);
  }, [n, paused, intervalSec]);

  if (n === 0) return null;
  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Destaques"
      className="relative overflow-hidden bg-secondary text-secondary-fg"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
    >
      <div className="grid">
        {slides.map((s, k) => (
          <div
            key={s.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${k + 1} de ${n}`}
            aria-hidden={k !== i}
            inert={k !== i ? true : undefined}
            className={cn("col-start-1 row-start-1 transition-opacity duration-700", k === i ? "z-10 opacity-100" : "z-0 opacity-0")}
          >
            {s.kind === "image" ? <ImageSlide s={s} eager={k === 0} /> : <TextSlide s={s} badges={badges} eager={k === 0} />}
          </div>
        ))}
      </div>

      {n > 1 && (
        <>
          <button type="button" aria-label="Banner anterior" onClick={() => go(i - 1)}
            className="absolute left-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/25 text-white backdrop-blur transition hover:bg-black/45 md:grid">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button type="button" aria-label="Próximo banner" onClick={() => go(i + 1)}
            className="absolute right-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/25 text-white backdrop-blur transition hover:bg-black/45 md:grid">
            <ChevronRight className="h-6 w-6" />
          </button>
          <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-2 rounded-full bg-black/35 px-2.5 py-1.5 backdrop-blur">
            {slides.map((s, k) => (
              <button key={s.id} type="button" aria-label={`Ir para o banner ${k + 1}`} aria-current={k === i}
                onClick={() => go(k)}
                className={cn("h-2 rounded-full transition-all", k === i ? "w-7 bg-primary" : "w-2 bg-white/40 hover:bg-white/70")} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function Cta({ s, className }: { s: SlideData; className?: string }) {
  if (!s.ctaLabel) return null;
  return (
    <a href={s.ctaUrl || "#ofertas"} target={s.openNewTab ? "_blank" : undefined} rel={s.openNewTab ? "noopener" : undefined}
      className={cn("inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-primary-fg shadow-lg shadow-black/20 transition hover:brightness-95", className)}>
      {s.ctaLabel} <ArrowRight className="h-4 w-4" />
    </a>
  );
}

function TextSlide({ s, badges, eager }: { s: SlideData; badges: Badge[]; eager: boolean }) {
  const style = s.bgColor ? { background: s.bgColor, color: `rgb(${onColor(s.bgColor)})` } : undefined;
  const list = s.showBadges ? badges.filter((b) => b.label?.trim()).slice(0, 3) : [];
  return (
    <div className="relative h-full" style={style}>
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-y-1/2 rounded-full bg-primary/[0.07] blur-3xl" />
      <div className={cn("container-site relative grid h-full items-center gap-6 pb-12 pt-8 sm:gap-8 sm:py-14 lg:gap-10 lg:py-16", list.length ? "lg:grid-cols-[1.1fr_1fr_auto]" : "lg:grid-cols-[1.2fr_1fr]")}>
        <div className="relative max-w-xl">
          {s.imagePath && (
            <div className="absolute -right-2 -top-2 w-[38%] sm:hidden" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.imagePath} alt="" className="ml-auto max-h-[104px] w-auto object-contain drop-shadow-[0_12px_20px_rgba(0,0,0,.4)]" />
            </div>
          )}
          <h2 className={cn("text-[28px] font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[56px]", s.imagePath && "max-w-[64%] sm:max-w-none")}>
            {s.headline}{" "}{s.highlight && <span className="text-primary">{s.highlight}</span>}
          </h2>
          {s.subtitle && <p className="mt-3 max-w-md text-sm leading-relaxed opacity-75 sm:mt-4 sm:text-base">{s.subtitle}</p>}
          <Cta s={s} className="mt-5 sm:mt-7" />
        </div>

        <div className="relative hidden justify-center sm:flex">
          {s.imagePath && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.imagePath} alt="" loading={eager ? "eager" : "lazy"} className="max-h-[340px] w-auto object-contain drop-shadow-[0_24px_40px_rgba(0,0,0,.45)]" />
          )}
        </div>

        {list.length > 0 && (
          <ul className="grid grid-cols-3 gap-2 border-t border-white/10 pt-5 sm:gap-3 sm:border-0 sm:pt-0 lg:grid-cols-1 lg:gap-5">
            {list.map((b, k) => (
              <li key={k} className="flex flex-col items-center gap-2 text-center sm:flex-row sm:text-left">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-primary ring-1 ring-white/10 sm:h-12 sm:w-12">
                  <Icon name={b.icon} className="h-5 w-5 sm:h-6 sm:w-6" />
                </span>
                <span className="text-[11px] font-semibold leading-snug sm:max-w-[9rem] sm:text-sm">{b.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ImageSlide({ s, eager }: { s: SlideData; eager: boolean }) {
  const pic = (
    <picture>
      {s.mobileImagePath && <source media="(max-width: 639px)" srcSet={s.mobileImagePath} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={s.imagePath ?? ""} alt={s.headline || s.ctaLabel || "Banner"} loading={eager ? "eager" : "lazy"}
        className="h-full w-full object-cover" />
    </picture>
  );
  const box = cn("mx-auto block h-full w-full max-w-[1920px] overflow-hidden", s.mobileImagePath ? "aspect-square sm:aspect-[16/5]" : "aspect-[16/5]");
  return s.ctaUrl ? (
    <a href={s.ctaUrl} target={s.openNewTab ? "_blank" : undefined} rel={s.openNewTab ? "noopener" : undefined} className={box}>{pic}</a>
  ) : (
    <div className={box}>{pic}</div>
  );
}
