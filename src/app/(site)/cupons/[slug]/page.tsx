import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { splitDiscount } from "@/lib/coupon-text";
import { couponStore } from "@/server/coupon-queries";
import { CouponUnlock, type CouponItem } from "@/components/public/CouponUnlock";

export const dynamic = "force-dynamic";

const brl = (v: string | null) => (v ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null);
const dia = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Bahia" });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const data = await couponStore((await params).slug);
  return data ? { title: `Cupons de desconto ${data.p.name}` } : {};
}

export default async function CuponsLojaPage({ params }: { params: Promise<{ slug: string }> }) {
  const data = await couponStore((await params).slug);
  if (!data) notFound();
  const { p, list } = data;
  const updated = list.reduce<Date | null>((m, { c }) => (!m || c.updatedAt > m ? c.updatedAt : m), null);

  const items: CouponItem[] = list.map(({ c, isToday }) => {
    const { highlight, rest } = splitDiscount(c.description, c.discount);
    return {
      id: c.id,
      code: c.code,
      highlight,
      title: highlight ? `${highlight} com cupom ${p.name}` : rest ?? `Cupom ${p.name}`,
      rest: highlight ? rest : null,
      details: [brl(c.minValue) && `Em compras acima de ${brl(c.minValue)}`, c.expiresAt && `Válido até ${dia(c.expiresAt)}`].filter(Boolean).join(" · ") || null,
      isToday: Boolean(isToday),
    };
  });
  const hoje = items.filter((i) => i.isToday).length;

  return (
    <div className="container-site py-6 sm:py-8">
      <Link href="/cupons" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-muted hover:text-ink">
        <ChevronLeft className="h-4 w-4" /> Todas as lojas
      </Link>

      <header className="mb-6 grid grid-cols-[84px_1fr] items-center gap-4 sm:grid-cols-[180px_1fr] sm:gap-6">
        <div className="grid aspect-square place-items-center rounded-card border border-line/70 bg-white p-2 shadow-card sm:p-4">
          {p.logoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.logoPath} alt={p.name} className="max-h-full max-w-[85%] object-contain sm:max-h-24" />
          ) : <span className="text-xl font-extrabold">{p.name}</span>}
        </div>
        <div>
          <h1 className="text-xl font-extrabold leading-tight tracking-tight sm:text-3xl">Cupons de desconto {p.name}</h1>
          <p className="mt-2 text-xs text-ink-muted sm:text-sm">
            {updated && <>Atualizado em {dia(updated)}.<br /></>}
            {items.length
              ? <>Encontramos <b className="text-ink">{items.length} {items.length > 1 ? "cupons" : "cupom"}</b> de desconto para {p.name}{hoje ? <>, <b className="text-ink">{hoje} {hoje > 1 ? "novos" : "novo"} hoje</b></> : null}.</>
              : <>Nenhum cupom valendo agora para {p.name}.</>}
          </p>
        </div>
      </header>

      {items.length > 0 && <CouponUnlock storeName={p.name} storeLink={p.couponUrl ? `/c/${p.slug}` : null} items={items} />}
    </div>
  );
}
