import type { SiteSettings } from "@/db/schema";

export function SiteHeader({ settings, q, platform }: { settings: SiteSettings; q?: string; platform?: string }) {
  return (
    <header className="border-b border-line bg-surface-raised">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:gap-8">
        <a href="/" className="flex shrink-0 items-center gap-3">
          {settings.logoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logoPath} alt={settings.siteName} className="h-10 w-auto max-w-[180px] object-contain" />
          ) : (
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-lg font-extrabold text-primary-fg">
              {settings.siteName.charAt(0)}
            </span>
          )}
          <span className="leading-tight">
            <span className="block text-lg font-extrabold tracking-tight">{settings.siteName}</span>
            {settings.tagline && <span className="block text-xs text-ink-muted">{settings.tagline}</span>}
          </span>
        </a>

        {/* GET puro: funciona sem JavaScript e gera URLs compartilháveis (?q=...) */}
        <form action="/" method="get" role="search" className="flex flex-1 gap-2">
          {platform && <input type="hidden" name="p" value={platform} />}
          <label htmlFor="q" className="sr-only">Buscar produtos</label>
          <div className="relative flex-1">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
            </svg>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Buscar produto, marca ou cupom…"
              className="input h-11 rounded-full pl-10"
              autoComplete="off"
            />
          </div>
          <button className="btn-secondary h-11 rounded-full px-5">Buscar</button>
        </form>
      </div>
    </header>
  );
}
