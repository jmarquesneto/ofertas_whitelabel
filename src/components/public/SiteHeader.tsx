import Link from "next/link";
import { ChevronDown, Heart, LayoutGrid, Search } from "lucide-react";
import type { SiteSettings } from "@/db/schema";
import type { CategoryNode } from "@/server/queries";
import { Logo } from "./Logo";
import { FavCount } from "./FavButton";

export function SiteHeader({ settings, tree, q }: { settings: SiteSettings; tree: CategoryNode[]; q?: string }) {
  const visible = tree.slice(0, 6);
  const more = tree.slice(6);
  return (
    <header className="bg-secondary text-secondary-fg">
      <div className="container-site flex flex-wrap items-center gap-x-6 gap-y-3 py-4">
        <Link href="/" className="shrink-0" aria-label={`${settings.siteName}, página inicial`}>
          <Logo settings={settings} dark />
        </Link>

        <form action="/ofertas" method="get" role="search" className="order-3 w-full sm:order-2 sm:w-auto sm:flex-1 sm:px-4 lg:px-10">
          <label htmlFor="q" className="sr-only">Buscar produtos</label>
          <div className="relative mx-auto max-w-2xl">
            <input
              id="q" name="q" type="search" defaultValue={q} autoComplete="off"
              placeholder="O que você está procurando?"
              className="h-12 w-full rounded-full border-0 bg-white pl-5 pr-14 text-sm text-ink shadow-sm placeholder:text-ink-faint focus:outline-none focus:ring-4 focus:ring-primary/40"
            />
            <button aria-label="Buscar" className="absolute right-1.5 top-1.5 grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-fg transition hover:brightness-95">
              <Search className="h-[18px] w-[18px]" strokeWidth={2.5} />
            </button>
          </div>
        </form>

        <Link href="/favoritos" className="relative order-2 ml-auto flex items-center gap-2 rounded-full px-2 py-2 text-sm font-semibold transition hover:bg-white/10 sm:order-3 sm:ml-0">
          <Heart className="h-6 w-6" strokeWidth={2} />
          <span className="hidden lg:inline">Favoritos</span>
          <FavCount />
        </Link>
      </div>

      {tree.length > 0 && (
        <nav aria-label="Categorias" className="border-t border-white/10">
          <div className="container-site flex items-center gap-1 overflow-x-auto scrollbar-none py-1.5 text-[13px] font-medium">
            <Link href="/ofertas" className="flex shrink-0 items-center gap-2 rounded-full px-3 py-2 transition hover:bg-white/10">
              <LayoutGrid className="h-4 w-4" /> Todas as categorias
            </Link>
            {visible.map((c) => (
              <Link key={c.id} href={`/ofertas?cat=${c.slug}`} className="shrink-0 rounded-full px-3 py-2 text-white/85 transition hover:bg-white/10 hover:text-white">
                {c.name}
              </Link>
            ))}
            {more.length > 0 && (
              <details className="group relative shrink-0">
                <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full px-3 py-2 text-white/85 transition hover:bg-white/10 hover:text-white [&::-webkit-details-marker]:hidden">
                  Mais <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
                </summary>
                <div className="absolute right-0 z-30 mt-1 w-56 rounded-xl bg-white p-1.5 text-ink shadow-lift">
                  {more.map((c) => (
                    <Link key={c.id} href={`/ofertas?cat=${c.slug}`} className="block rounded-lg px-3 py-2 hover:bg-surface-sunken">{c.name}</Link>
                  ))}
                </div>
              </details>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
