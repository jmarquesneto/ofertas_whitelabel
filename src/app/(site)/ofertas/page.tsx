import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, LayoutGrid } from "lucide-react";
import { categoryTree, listPublicOffers, listPublicPlatforms, resolveCategory, SORTS, type SortKey } from "@/server/queries";
import { OfferCard } from "@/components/public/OfferCard";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SP = { q?: string; cat?: string; p?: string; ordem?: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const { q, cat } = await searchParams;
  const tree = await categoryTree();
  const c = resolveCategory(tree, cat);
  return { title: q ? `Busca: ${q}` : c ? c.node.name : "Todas as ofertas" };
}

export default async function OffersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const sort = (SORTS.find((s) => s.key === sp.ordem)?.key ?? "recentes") as SortKey;
  const tree = await categoryTree();
  const cat = resolveCategory(tree, sp.cat);
  const [offers, platforms] = await Promise.all([
    listPublicOffers({ q: sp.q, platform: sp.p, categoryIds: cat?.ids, sort, limit: 96 }),
    listPublicPlatforms(),
  ]);

  const url = (patch: Partial<SP>) => {
    const next = { ...sp, ...patch };
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
    return qs ? `/ofertas?${qs}` : "/ofertas";
  };
  const title = sp.q ? `Resultados para “${sp.q}”` : cat ? cat.node.name : "Todas as ofertas";
  const activeRoot = cat ? (cat.parent ?? cat.node) : null;

  return (
    <div className="container-site py-6 sm:py-8">
      <nav aria-label="Você está em" className="mb-4 flex flex-wrap items-center gap-1 text-xs text-ink-faint">
        <Link href="/" className="hover:text-ink">Início</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/ofertas" className="hover:text-ink">Ofertas</Link>
        {cat?.parent && (<><ChevronRight className="h-3.5 w-3.5" /><Link href={url({ cat: cat.parent.slug })} className="hover:text-ink">{cat.parent.name}</Link></>)}
        {cat && (<><ChevronRight className="h-3.5 w-3.5" /><span className="font-semibold text-ink">{cat.node.name}</span></>)}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr] lg:gap-8">
        {/* Lateral de categorias (desktop) */}
        <aside className="hidden lg:block">
          <nav aria-label="Categorias" className="card sticky top-4 p-2">
            <Link href={url({ cat: undefined })} className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold", !cat ? "bg-primary/20 text-ink" : "text-ink-muted hover:bg-surface-sunken")}>
              <LayoutGrid className="h-[18px] w-[18px]" /> Todas
            </Link>
            {tree.map((c) => {
              const open = activeRoot?.id === c.id;
              return (
                <div key={c.id}>
                  <Link href={url({ cat: c.slug })} className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm", cat?.node.id === c.id ? "bg-primary/20 font-semibold text-ink" : "text-ink-muted hover:bg-surface-sunken hover:text-ink")}>
                    <Icon name={c.icon} className="h-[18px] w-[18px]" />
                    <span className="flex-1">{c.name}</span>
                    {c.n > 0 && <span className="text-xs text-ink-faint">{c.n}</span>}
                  </Link>
                  {open && c.children.length > 0 && (
                    <div className="mb-1 ml-[22px] border-l border-line pl-3">
                      {c.children.map((s) => (
                        <Link key={s.id} href={url({ cat: s.slug })} className={cn("block rounded-md px-2 py-1.5 text-[13px]", cat?.node.id === s.id ? "font-semibold text-ink" : "text-ink-faint hover:text-ink")}>
                          {s.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {offers.length} {offers.length === 1 ? "oferta encontrada" : "ofertas encontradas"}
          </p>

          {/* Categorias em chips (celular) */}
          <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto scrollbar-none px-4 lg:hidden">
            {(cat && activeRoot && activeRoot.children.length ? [activeRoot, ...activeRoot.children] : tree).map((c) => (
              <Link key={c.id} href={url({ cat: c.slug })} className={cn("flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold", cat?.node.id === c.id ? "border-secondary bg-secondary text-secondary-fg" : "border-line bg-surface-raised text-ink")}>
                <Icon name={c.icon} className="h-3.5 w-3.5" /> {c.name}
              </Link>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="-mx-4 flex gap-1.5 overflow-x-auto scrollbar-none px-4 sm:mx-0 sm:px-0">
              {SORTS.map((s) => (
                <Link key={s.key} href={url({ ordem: s.key === "recentes" ? undefined : s.key })}
                  className={cn("shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition", sort === s.key ? "bg-secondary text-secondary-fg" : "bg-surface-raised text-ink-muted ring-1 ring-line hover:text-ink")}>
                  {s.label}
                </Link>
              ))}
            </div>
            {platforms.length > 1 && (
              <div className="flex flex-wrap gap-1.5 sm:ml-auto">
                {platforms.map((p) => (
                  <Link key={p.id} href={url({ p: sp.p === p.slug ? undefined : p.slug })}
                    className={cn("rounded-full px-3 py-1.5 text-xs font-semibold transition", sp.p === p.slug ? "bg-primary text-primary-fg" : "text-ink-muted hover:text-ink")}>
                    {p.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {offers.length === 0 ? (
            <div className="card mt-6 grid place-items-center gap-2 px-6 py-16 text-center">
              <p className="font-bold">Nenhuma oferta encontrada</p>
              <p className="text-sm text-ink-muted">Tente outro termo ou outra categoria.</p>
              <Link href="/ofertas" className="btn-primary mt-2">Ver todas as ofertas</Link>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3">
              {offers.map((o) => <OfferCard key={o.id} offer={o} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
