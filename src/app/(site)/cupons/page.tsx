import { and, asc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { ArrowRight, Ticket } from "lucide-react";
import { db } from "@/db";
import { coupons, platforms } from "@/db/schema";
import { CouponButton } from "@/components/public/CouponButton";

export const metadata = { title: "Cupons de desconto", description: "Cupons válidos das lojas parceiras, atualizados todo dia." };
export const dynamic = "force-dynamic";

const brl = (v: string | null) => (v ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null);

export default async function CuponsPage() {
  const rows = await db
    .select({ c: coupons, p: platforms })
    .from(coupons)
    .innerJoin(platforms, eq(platforms.id, coupons.platformId))
    .where(and(
      eq(coupons.isActive, true),
      eq(platforms.isActive, true),
      or(isNull(coupons.expiresAt), gt(coupons.expiresAt, sql`now()`)),
    ))
    .orderBy(asc(platforms.sortOrder), asc(platforms.name), asc(coupons.code));

  const stores = new Map<number, { p: (typeof rows)[number]["p"]; list: (typeof rows)[number]["c"][] }>();
  for (const { c, p } of rows) {
    if (!stores.has(p.id)) stores.set(p.id, { p, list: [] });
    stores.get(p.id)!.list.push(c);
  }

  return (
    <div className="container-site py-6 sm:py-8">
      <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
        <Ticket className="h-7 w-7 text-primary" strokeWidth={2.4} /> Cupons de desconto
      </h1>
      <p className="mt-1 text-sm text-ink-muted">Toque no cupom para copiar e use o botão da loja para aplicar no carrinho.</p>

      {stores.size === 0 ? (
        <p className="card mt-8 p-10 text-center text-sm text-ink-muted">Nenhum cupom valendo agora. Volte daqui a pouco!</p>
      ) : (
        <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[...stores.values()].map(({ p, list }) => (
            <section key={p.id} id={p.slug} className="card flex flex-col overflow-hidden">
              {p.couponBannerPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.couponBannerPath} alt={`Cupons ${p.name}`} className="aspect-[16/9] w-full bg-surface-sunken object-cover" />
              ) : (
                <div className="flex aspect-[16/9] items-center justify-center gap-3 bg-secondary text-secondary-fg">
                  {p.logoPath && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.logoPath} alt="" className="h-14 w-14 rounded-xl bg-white object-contain p-1.5" />
                  )}
                  <span className="text-xl font-extrabold">Cupons {p.name}</span>
                </div>
              )}
              <div className="flex flex-1 flex-col gap-3 p-4">
                <h2 className="font-extrabold">{p.name} <span className="text-sm font-semibold text-ink-muted">· {list.length} {list.length > 1 ? "cupons" : "cupom"}</span></h2>
                <ul className="grid gap-3">
                  {list.map((c) => (
                    <li key={c.id} className="grid gap-1">
                      <CouponButton code={c.code} size="lg" />
                      {(c.description || c.minValue || c.expiresAt) && (
                        <p className="px-1 text-xs text-ink-muted">
                          {[c.description, brl(c.minValue) && `mín. ${brl(c.minValue)}`,
                            c.expiresAt && `válido até ${c.expiresAt.toLocaleDateString("pt-BR", { timeZone: "America/Bahia" })}`]
                            .filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
                {p.couponUrl && (
                  <a href={`/c/${p.slug}`} target="_blank" rel="nofollow sponsored noopener" className="btn-primary mt-auto w-full">
                    Testar o cupom na loja <ArrowRight className="h-4 w-4" />
                  </a>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
