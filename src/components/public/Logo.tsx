import type { SiteSettings } from "@/db/schema";
import { cn } from "@/lib/utils";

/** Logo enviado no painel; sem logo, monograma na cor primária + nome */
export function Logo({ settings, dark = false, className }: { settings: SiteSettings; dark?: boolean; className?: string }) {
  if (settings.logoPath)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={settings.logoPath} alt={settings.siteName} className={cn("h-10 w-auto max-w-[200px] object-contain sm:h-12", className)} />
    );
  const words = settings.siteName.trim().split(/\s+/);
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-lg font-extrabold text-primary-fg sm:h-11 sm:w-11">
        {settings.siteName.charAt(0).toUpperCase()}
      </span>
      <span className={cn("max-w-[11rem] text-[17px] font-extrabold leading-[1.05] tracking-tight sm:text-xl", dark ? "text-white" : "text-ink")}>
        {words.length > 2 ? (
          <>
            {words.slice(0, Math.ceil(words.length / 2)).join(" ")}
            <br />
            {words.slice(Math.ceil(words.length / 2)).join(" ")}
          </>
        ) : (
          words.map((w, i) => (
            <span key={i} className="block">{w}</span>
          ))
        )}
      </span>
    </span>
  );
}
