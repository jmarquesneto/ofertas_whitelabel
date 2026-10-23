import type { SiteSettings } from "@/db/schema";

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  return (
    <footer className="mt-16 bg-secondary text-secondary-fg">
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10 sm:grid-cols-[1fr_2fr]">
        <div>
          <p className="text-lg font-extrabold">{settings.siteName}</p>
          <p className="mt-1 text-sm opacity-75">© {new Date().getFullYear()} · Todos os direitos reservados</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider opacity-75">Aviso legal</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed opacity-90">{settings.footerText}</p>
        </div>
      </div>
    </footer>
  );
}
