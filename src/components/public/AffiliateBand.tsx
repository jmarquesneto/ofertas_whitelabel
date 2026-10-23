import { BadgeCheck } from "lucide-react";
import type { SiteSettings } from "@/db/schema";

/** Faixa de transparência: "somos uma página de afiliados" */
export function AffiliateBand({ settings }: { settings: SiteSettings }) {
  return (
    <section className="relative overflow-hidden rounded-[20px] bg-secondary px-6 py-8 text-secondary-fg sm:px-10 sm:py-10">
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-primary/[0.07] blur-3xl" />
      <div className="relative grid items-center gap-6 md:grid-cols-[1fr_auto]">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-primary-fg">
            <BadgeCheck className="h-3.5 w-3.5" /> Transparência
          </span>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-[28px]">{settings.affiliateTitle}</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/75 sm:text-[15px]">{settings.affiliateText}</p>
        </div>
        {settings.heroImagePath && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.heroImagePath} alt="" className="hidden max-h-40 w-auto object-contain md:block" />
        )}
      </div>
    </section>
  );
}
