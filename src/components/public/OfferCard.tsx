import { CouponButton } from "./CouponButton";
import { PlatformBadge } from "./PlatformBadge";
import { timeLeft } from "@/lib/utils";

export type PublicOffer = {
  id: number;
  title: string;
  description: string | null;
  slug: string;
  coupon: string | null;
  imagePath: string | null;
  expiresAt: Date;
  createdAt: Date;
  platformName: string;
  platformLogo: string | null;
};

export function OfferCard({ offer }: { offer: PublicOffer }) {
  const isNew = Date.now() - offer.createdAt.getTime() < 6 * 3_600_000;
  const href = `/${offer.slug}`;
  return (
    <article className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-12px_rgba(28,26,23,0.25)]">
      <a
        href={href}
        target="_blank"
        rel="sponsored noopener"
        className="relative block aspect-square bg-surface-sunken"
        tabIndex={-1}
        aria-hidden
      >
        {offer.imagePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={offer.imagePath} alt="" loading="lazy" className="h-full w-full object-contain p-4 mix-blend-multiply" />
        ) : (
          <div className="grid h-full place-items-center text-sm text-ink-faint">sem imagem</div>
        )}
        <span className="absolute left-2 top-2 flex max-w-[calc(100%-4.5rem)] items-center gap-1.5 rounded-full bg-white/95 py-1 pl-1 pr-2.5 text-xs font-semibold shadow-sm sm:left-3 sm:top-3">
          <PlatformBadge name={offer.platformName} logo={offer.platformLogo} size="sm" className="shrink-0" />
          <span className="truncate">{offer.platformName}</span>
        </span>
        {isNew && (
          <span className="absolute right-2 top-2 rounded-full sm:right-3 sm:top-3 bg-primary px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary-fg">
            Nova
          </span>
        )}
      </a>

      <div className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
        <div className="space-y-1">
          <h2 className="line-clamp-2 text-[15px] font-semibold leading-snug">
            <a href={href} target="_blank" rel="sponsored noopener" className="hover:underline">
              {offer.title}
            </a>
          </h2>
          {offer.description && <p className="line-clamp-2 text-sm text-ink-muted">{offer.description}</p>}
        </div>

        <div className="mt-auto space-y-2.5">
          {offer.coupon && <CouponButton code={offer.coupon} />}
          <a href={href} target="_blank" rel="sponsored noopener" className="btn-primary w-full whitespace-nowrap px-3">
            <span>Ver oferta<span className="hidden sm:inline"> na loja</span></span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="M7 17 17 7M8 7h9v9" />
            </svg>
          </a>
          <p className="text-center text-[11px] text-ink-faint">Termina em {timeLeft(offer.expiresAt)}</p>
        </div>
      </div>
    </article>
  );
}
