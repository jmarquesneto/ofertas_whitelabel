import { getSettings } from "@/lib/settings";
import { categoryTree, listLiveBanners, listPublicOffers } from "@/server/queries";
import { BannerCarousel } from "@/components/public/BannerCarousel";
import { OfferCard } from "@/components/public/OfferCard";
import { SectionHeader } from "@/components/public/SectionHeader";
import { CategoryCircles } from "@/components/public/CategoryCircles";
import { AffiliateBand } from "@/components/public/AffiliateBand";

// Sempre dinâmico: a regra de expiração (expires_at > now()) é aplicada a cada visita
export const dynamic = "force-dynamic";

export default async function Home() {
  const [settings, tree, featured, latest, slides] = await Promise.all([
    getSettings(),
    categoryTree(),
    listPublicOffers({ featured: true, sort: "populares", limit: 8 }),
    listPublicOffers({ sort: "recentes", limit: 12 }),
    listLiveBanners(),
  ]);
  const featuredIds = new Set(featured.slice(0, 4).map((o) => o.id));
  const recent = latest.filter((o) => !featuredIds.has(o.id)).slice(0, 8);
  const cats = tree.filter((c) => c.n > 0).length >= 4 ? tree.filter((c) => c.n > 0) : tree;

  return (
    <>
      <BannerCarousel slides={slides} badges={settings.heroBadges ?? []} intervalSec={settings.bannerIntervalSec} />

      <div className="container-site space-y-12 py-10 sm:space-y-14 sm:py-12">
        {featured.length === 0 ? (
          <div className="card grid place-items-center gap-2 px-6 py-16 text-center">
            <p className="text-lg font-bold">Nenhuma oferta no ar agora</p>
            <p className="text-sm text-ink-muted">Volte em breve: novas promoções entram todos os dias.</p>
          </div>
        ) : (
          <section>
            <SectionHeader id="ofertas" title="Ofertas em destaque" href="/ofertas?ordem=populares" />
            <Grid>{featured.slice(0, 4).map((o) => <OfferCard key={o.id} offer={o} />)}</Grid>
          </section>
        )}

        {cats.length > 0 && (
          <section>
            <SectionHeader title="Explore por categoria" href="/categorias" />
            <CategoryCircles tree={cats} />
          </section>
        )}

        {recent.length > 0 && (
          <section>
            <SectionHeader title="Acabaram de chegar" href="/ofertas" />
            <Grid>{recent.map((o) => <OfferCard key={o.id} offer={o} />)}</Grid>
          </section>
        )}

        <AffiliateBand settings={settings} />
      </div>
    </>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">{children}</div>;
}
