import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, BadgeCheck, ChevronRight, Clock, Store } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { categoryTree, findCategoryById, getPublicOffer, listPublicOffers } from "@/server/queries";
import { CouponButton } from "@/components/public/CouponButton";
import { FavButton } from "@/components/public/FavButton";
import { OfferCard } from "@/components/public/OfferCard";
import { PlatformBadge } from "@/components/public/PlatformBadge";
import { SectionHeader } from "@/components/public/SectionHeader";
import { ShareButtons } from "@/components/public/ShareButtons";
import { discountPct, fmtBRL, timeLeft } from "@/lib/utils";

export const dynamic = "force-dynamic";

type P = { params: Promise<{ slug: string }> };

/** Prévia rica no WhatsApp/Telegram/Facebook (Open Graph) */
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const offer = await getPublicOffer((await params).slug);
  if (!offer) return { title: "Oferta não encontrada" };
  const base = process.env.PUBLIC_URL;
  const img = offer.imagePath ? (offer.imagePath.startsWith("http") ? offer.imagePath : base ? `${base}${offer.imagePath}` : offer.imagePath) : undefined;
  const price = fmtBRL(offer.price);
  const desc = [price && `Por ${price}`, offer.coupon && `Cupom ${offer.coupon}`, offer.platformName].filter(Boolean).join(" · ");
  return {
    title: offer.title,
    description: desc || offer.description || undefined,
    openGraph: { title: offer.title, description: desc, images: img ? [img] : undefined, type: "website" },
    twitter: { card: "summary_large_image" },
  };
}

export default async function OfferPage({ params }: P) {
  const { slug } = await params;
  const [offer, tree, settings] = await Promise.all([getPublicOffer(slug), categoryTree(), getSettings()]);
  if (!offer) notFound();

  const cat = findCategoryById(tree, offer.categoryId);
  const related = (
    await listPublicOffers({ categoryIds: cat ? [cat.node.id, ...(tree.find((t) => t.id === cat.node.id)?.children.map((c) => c.id) ?? [])] : undefined, sort: "populares", limit: 9 })
  ).filter((o) => o.id !== offer.id).slice(0, 4);

  const pct = discountPct(offer.price, offer.originalPrice);
  const price = fmtBRL(offer.price);
  const original = pct ? fmtBRL(offer.originalPrice) : null;
  const expired = new Date(offer.expiresAt) <= new Date();
  const shareUrl = `${process.env.PUBLIC_URL ?? ""}/oferta/${offer.slug}`;

  return (
    <div className="container-site py-6 sm:py-8">
      <nav aria-label="Você está em" className="mb-4 flex flex-wrap items-center gap-1 text-xs text-ink-faint">
        <Link href="/" className="hover:text-ink">Início</Link>
        {cat?.parent && (<><ChevronRight className="h-3.5 w-3.5" /><Link href={`/ofertas?cat=${cat.parent.slug}`} className="hover:text-ink">{cat.parent.name}</Link></>)}
        {cat && (<><ChevronRight className="h-3.5 w-3.5" /><Link href={`/ofertas?cat=${cat.node.slug}`} className="hover:text-ink">{cat.node.name}</Link></>)}
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="line-clamp-1 font-semibold text-ink">{offer.title}</span>
      </nav>

      <div className="card grid gap-6 p-4 sm:p-6 lg:grid-cols-[1.1fr_1fr] lg:gap-10 lg:p-8">
        <div className="relative">
          <div className="grid aspect-square place-items-center overflow-hidden rounded-2xl bg-white ring-1 ring-line/70">
            {offer.imagePath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={offer.imagePath} alt={offer.title} className="h-full w-full object-contain p-6 sm:p-10" />
            ) : (
              <span className="text-sm text-ink-faint">sem imagem</span>
            )}
          </div>
          {pct && <span className="absolute left-4 top-4 rounded-lg bg-primary px-2.5 py-1 text-sm font-extrabold text-primary-fg">-{pct}%</span>}
          <FavButton id={offer.id} size="lg" className="absolute right-4 top-4" />
        </div>

        <div className="flex flex-col">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink-muted">
            <PlatformBadge name={offer.platformName} logo={offer.platformLogo} size="sm" /> {offer.platformName}
          </p>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight sm:text-[28px]">{offer.title}</h1>

          <div className="mt-5 rounded-2xl bg-surface-sunken p-4 sm:p-5">
            {original && (
              <p className="flex items-center gap-2 text-sm text-ink-faint">
                <span className="line-through">{original}</span>
                {pct && <span className="rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-extrabold text-primary-fg">-{pct}%</span>}
              </p>
            )}
            <p className="mt-0.5 text-3xl font-extrabold tracking-tight text-price sm:text-4xl">{price ?? "Ver preço na loja"}</p>
            {expired && <p className="mt-2 text-sm font-semibold text-red-700">Esta oferta pode ter acabado. Confira na loja.</p>}
          </div>

          {offer.coupon && <div className="mt-4"><CouponButton code={offer.coupon} size="lg" /></div>}

          <div className="mt-4 grid gap-2.5">
            <a href={`/${offer.slug}`} target="_blank" rel="sponsored noopener"
              className="flex items-center justify-center gap-2 rounded-xl bg-primary py-4 text-base font-extrabold text-primary-fg shadow-sm transition hover:brightness-95">
              Ir para a loja <ArrowUpRight className="h-5 w-5" />
            </a>
            <ShareButtons url={shareUrl} title={offer.title} price={price} coupon={offer.coupon} />
          </div>

          <ul className="mt-5 grid grid-cols-3 gap-2 text-[11px] font-semibold text-ink-muted sm:text-xs">
            <li className="flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 shrink-0 text-price" /> Link verificado</li>
            <li className="flex items-center gap-1.5"><Store className="h-4 w-4 shrink-0" /> Compra na {offer.platformName}</li>
            <li className="flex items-center gap-1.5"><Clock className="h-4 w-4 shrink-0" /> {expired ? "Expirada" : `Termina em ${timeLeft(new Date(offer.expiresAt))}`}</li>
          </ul>

          {offer.description && (
            <div className="mt-6 border-t border-line pt-5">
              <h2 className="text-sm font-bold">Sobre a oferta</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-muted">{offer.description}</p>
            </div>
          )}
          <p className="mt-6 text-[11px] leading-relaxed text-ink-faint">
            {settings.siteName} pode receber comissão por compras feitas por este link. Preço e disponibilidade podem mudar a qualquer momento.
          </p>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-12">
          <SectionHeader title="Você também pode gostar" href={cat ? `/ofertas?cat=${cat.node.slug}` : "/ofertas"} />
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {related.map((o) => <OfferCard key={o.id} offer={o} />)}
          </div>
        </section>
      )}
    </div>
  );
}
