import { ArrowRight } from "lucide-react";
import { CouponButton } from "./CouponButton";
import { FavButton } from "./FavButton";
import { PlatformBadge } from "./PlatformBadge";
import { discountPct, fmtBRL } from "@/lib/utils";

export type PublicOffer = {
  id: number;
  title: string;
  slug: string;
  coupon: string | null;
  imagePath: string | null;
  price: string | null;
  originalPrice: string | null;
  expiresAt: Date | string;
  createdAt: Date | string;
  platformName: string;
  platformLogo: string | null;
};

/**
 * Card da vitrine. Imagem e título abrem a página da oferta;
 * o botão "Ver oferta" vai direto para a loja (clique contado, nova aba).
 */
export function OfferCard({ offer }: { offer: PublicOffer }) {
  const pct = discountPct(offer.price, offer.originalPrice);
  const price = fmtBRL(offer.price);
  const original = pct ? fmtBRL(offer.originalPrice) : null;
  const isNew = Date.now() - new Date(offer.createdAt).getTime() < 6 * 3_600_000;
  const page = `/oferta/${offer.slug}`;

  return (
    <article className="group relative flex flex-col rounded-card border border-line/70 bg-surface-raised p-3 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-lift sm:p-4">
      <div className="absolute left-3 top-3 z-10 flex gap-1.5 sm:left-4 sm:top-4">
        {pct ? (
          <span className="rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-extrabold text-primary-fg">-{pct}%</span>
        ) : isNew ? (
          <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-bold text-secondary-fg">Nova</span>
        ) : null}
      </div>
      <FavButton id={offer.id} className="absolute right-3 top-3 z-10 sm:right-4 sm:top-4" />

      <a href={page} className="block aspect-square overflow-hidden rounded-xl bg-white" tabIndex={-1} aria-hidden>
        {offer.imagePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={offer.imagePath} alt="" loading="lazy" className="h-full w-full object-contain p-3 transition duration-300 group-hover:scale-[1.04] sm:p-5" />
        ) : (
          <div className="grid h-full place-items-center rounded-xl bg-surface-sunken text-xs text-ink-faint">sem imagem</div>
        )}
      </a>

      <div className="mt-3 flex flex-1 flex-col">
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-ink-faint">
          <PlatformBadge name={offer.platformName} logo={offer.platformLogo} size="xs" />
          <span className="truncate">{offer.platformName}</span>
        </p>
        <h3 className="mt-1 line-clamp-2 min-h-[2.5rem] text-[13px] font-semibold leading-5 text-ink sm:text-sm">
          <a href={page} className="hover:underline">{offer.title}</a>
        </h3>

        <div className="mt-2 min-h-[2.75rem]">
          {original && <p className="text-xs text-ink-faint line-through">{original}</p>}
          {price ? (
            <p className="text-lg font-extrabold leading-tight tracking-tight text-price sm:text-xl">{price}</p>
          ) : (
            <p className="text-sm font-semibold text-ink-muted">Ver preço na loja</p>
          )}
        </div>

        <div className="mt-auto space-y-2 pt-3">
          {offer.coupon && <CouponButton code={offer.coupon} />}
          <a
            href={`/${offer.slug}`}
            target="_blank"
            rel="sponsored noopener"
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-[13px] font-bold text-primary-fg transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Ver oferta <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </article>
  );
}
