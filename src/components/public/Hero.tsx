import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { SiteSettings } from "@/db/schema";
import { Icon } from "@/components/Icon";

/** Hero da home — todo o conteúdo vem de site_settings (white label) */
export function Hero({ settings }: { settings: SiteSettings }) {
  const badges = (settings.heroBadges ?? []).filter((b) => b.label?.trim()).slice(0, 3);
  return (
    <section className="relative overflow-hidden bg-secondary text-secondary-fg">
      {/* brilho suave na cor primária, atrás da imagem */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-y-1/2 rounded-full bg-primary/[0.07] blur-3xl" />
      <div className="container-site relative grid items-center gap-6 py-8 sm:gap-8 sm:py-14 lg:grid-cols-[1.1fr_1fr_auto] lg:gap-10 lg:py-16">
        <div className="relative max-w-xl">
          {/* No celular a imagem fica ao lado do título, como na referência */}
          <div className="absolute -right-2 -top-2 w-[38%] sm:hidden" aria-hidden>
            {settings.heroImagePath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.heroImagePath} alt="" className="ml-auto max-h-[104px] w-auto object-contain drop-shadow-[0_12px_20px_rgba(0,0,0,.4)]" />
            ) : (
              <HeroArt className="ml-auto h-24 w-auto" />
            )}
          </div>
          <h1 className="max-w-[64%] text-[28px] font-extrabold leading-[1.08] tracking-tight sm:max-w-none sm:text-5xl lg:text-[56px]">
            {settings.heroTitle}{" "}
            <span className="text-primary">{settings.heroHighlight}</span>
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/75 sm:mt-4 sm:text-base">{settings.heroSubtitle}</p>
          <Link href="#ofertas" className="mt-5 inline-flex sm:mt-7 items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-primary-fg shadow-lg shadow-black/20 transition hover:brightness-95">
            Ver ofertas <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="relative hidden justify-center sm:flex">
          {settings.heroImagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.heroImagePath} alt="" className="max-h-[340px] w-auto object-contain drop-shadow-[0_24px_40px_rgba(0,0,0,.45)]" />
          ) : (
            <HeroArt />
          )}
        </div>

        {badges.length > 0 && (
          <ul className="grid grid-cols-3 gap-2 border-t border-white/10 pt-5 sm:gap-3 sm:border-0 sm:pt-0 lg:grid-cols-1 lg:gap-5">
            {badges.map((b, i) => (
              <li key={i} className="flex flex-col items-center gap-2 text-center sm:flex-row sm:text-left">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-primary ring-1 ring-white/10 sm:h-12 sm:w-12">
                  <Icon name={b.icon} className="h-5 w-5 sm:h-6 sm:w-6" />
                </span>
                <span className="text-[11px] font-semibold leading-snug sm:max-w-[9rem] sm:text-sm">{b.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Ilustração padrão (etiqueta de preço) quando nenhuma imagem de hero foi enviada */
function HeroArt({ className = "h-[300px] w-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 300" className={className} aria-hidden>
      <g transform="rotate(-12 160 150)">
        <path d="M70 70 h140 l60 80 l-60 80 h-140 a20 20 0 0 1 -20 -20 v-120 a20 20 0 0 1 20 -20z" className="fill-primary" />
        <circle cx="222" cy="150" r="14" className="fill-secondary" />
        <text x="125" y="168" textAnchor="middle" fontSize="64" fontWeight="800" fontFamily="Montserrat, sans-serif" className="fill-primary-fg">%</text>
      </g>
      <g className="fill-primary" opacity=".9">
        <rect x="18" y="40" width="34" height="9" rx="4.5" transform="rotate(35 35 44)" />
        <rect x="270" y="26" width="34" height="9" rx="4.5" transform="rotate(-30 287 30)" />
        <rect x="282" y="250" width="30" height="9" rx="4.5" transform="rotate(25 297 254)" />
      </g>
    </svg>
  );
}
