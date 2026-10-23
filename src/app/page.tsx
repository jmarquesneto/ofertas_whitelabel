import { getSettings } from "@/lib/settings";
import { listPublicOffers, listPublicPlatforms } from "@/server/queries";
import { SiteHeader } from "@/components/public/SiteHeader";
import { PlatformFilter } from "@/components/public/PlatformFilter";
import { OfferCard } from "@/components/public/OfferCard";
import { SiteFooter } from "@/components/public/SiteFooter";

// Sempre dinâmico: a regra de expiração (expires_at > now()) é aplicada a cada visita,
// então ofertas com mais de 72h somem sozinhas, sem cron.
export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; p?: string }> }) {
  const { q, p } = await searchParams;
  const [settings, offers, platforms] = await Promise.all([
    getSettings(),
    listPublicOffers({ q, platform: p }),
    listPublicPlatforms(),
  ]);
  const activePlatform = platforms.find((x) => x.slug === p);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader settings={settings} q={q} platform={p} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <PlatformFilter platforms={platforms} active={p} q={q} />

        <div className="mb-4 mt-6 flex items-baseline justify-between gap-4">
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
            {q ? <>Resultados para “{q}”</> : activePlatform ? <>Ofertas {activePlatform.name}</> : "Ofertas do momento"}
          </h1>
          <span className="shrink-0 text-sm text-ink-muted">{offers.length} {offers.length === 1 ? "oferta" : "ofertas"}</span>
        </div>

        {offers.length === 0 ? (
          <div className="card grid place-items-center gap-2 px-6 py-16 text-center">
            <p className="font-semibold">Nenhuma oferta encontrada</p>
            <p className="text-sm text-ink-muted">Tente outro termo ou veja todas as plataformas.</p>
            <a href="/" className="btn-ghost mt-2">Ver todas as ofertas</a>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {offers.map((o) => (
              <OfferCard key={o.id} offer={o} />
            ))}
          </div>
        )}
      </main>

      <SiteFooter settings={settings} />
    </div>
  );
}
