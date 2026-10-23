import Link from "next/link";
import type { SiteSettings } from "@/db/schema";
import { Logo } from "./Logo";

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  return (
    <footer className="mt-16 bg-secondary pb-20 text-secondary-fg sm:pb-0">
      <div className="container-site grid gap-8 py-12 md:grid-cols-[1.2fr_2fr_auto]">
        <div>
          <Logo settings={settings} dark />
          {settings.tagline && <p className="mt-3 max-w-xs text-sm text-white/70">{settings.tagline}</p>}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Aviso legal</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-white/75">{settings.footerText}</p>
        </div>
        <nav className="flex gap-6 text-sm font-semibold md:flex-col md:gap-2">
          <Link href="/ofertas" className="text-white/80 hover:text-white">Ofertas</Link>
          <Link href="/categorias" className="text-white/80 hover:text-white">Categorias</Link>
          <Link href="/favoritos" className="text-white/80 hover:text-white">Favoritos</Link>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <p className="container-site py-4 text-xs text-white/50">© {new Date().getFullYear()} {settings.siteName}. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}
