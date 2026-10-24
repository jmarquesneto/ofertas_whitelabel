import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { offers, platforms } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { collectorOnline, getBotSettings, getWhatsappSettings } from "@/lib/bot";
import { discountPct, fmtBRL } from "@/lib/utils";
import { waReady } from "@/server/whatsapp";
import { PageHeader } from "@/components/admin/PageHeader";
import { ImportLinkForm, RejectAllButton, ReviewActions } from "@/components/admin/ApprovalForms";

export const metadata = { title: "Aprovação" };
export const dynamic = "force-dynamic";

export default async function AprovacaoPage() {
  await requirePage("approval");
  const [rows, bot, wa] = await Promise.all([
    db
      .select({ o: offers, platform: platforms.name })
      .from(offers)
      .innerJoin(platforms, eq(platforms.id, offers.platformId))
      .where(eq(offers.reviewStatus, "pending"))
      .orderBy(asc(offers.createdAt))
      .limit(100),
    getBotSettings(),
    getWhatsappSettings(),
  ]);
  const ready = waReady(wa);

  return (
    <>
      <PageHeader
        title="Aprovação"
        subtitle={
          bot.mode === "review"
            ? "Ofertas do robô e importadas esperando você. Aprovar publica no site (validade renovada) e manda ao WhatsApp."
            : "O robô está no modo “publicar direto”: só as ofertas importadas por link param aqui."
        }
        action={rows.length > 1 ? <RejectAllButton total={rows.length} /> : undefined}
      />

      <div className="grid gap-6">
        <ImportLinkForm online={collectorOnline(bot.status.seenAt)} />

        {rows.length === 0 ? (
          <p className="card p-10 text-center text-sm text-ink-muted">Nada esperando aprovação. 🎉</p>
        ) : (
          <ul className="grid gap-3">
            {rows.map(({ o, platform }) => {
              const pct = discountPct(o.price, o.originalPrice);
              return (
                <li key={o.id} className="card grid gap-4 p-4 sm:grid-cols-[96px_1fr_auto] sm:items-center">
                  <div className="grid aspect-square w-24 place-items-center overflow-hidden rounded-xl border border-line bg-white">
                    {o.imagePath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.imagePath} alt="" className="h-full w-full object-contain p-1.5" />
                    ) : <span className="text-[10px] text-ink-faint">sem foto</span>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink-muted">
                      {platform} · {o.source === "bot" ? "robô" : "importada"} · {o.createdAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                    <p className="mt-0.5 line-clamp-2 font-semibold">{o.title}</p>
                    <p className="mt-1 text-sm">
                      {pct && <span className="mr-2 text-ink-faint line-through">{fmtBRL(o.originalPrice)}</span>}
                      <span className="font-extrabold text-price">{fmtBRL(o.price) ?? "sem preço"}</span>
                      {pct && <span className="ml-2 rounded bg-primary px-1.5 py-0.5 text-xs font-bold text-primary-fg">-{pct}%</span>}
                    </p>
                    {o.description && <p className="mt-1 text-xs text-ink-muted">{o.description}</p>}
                    <a href={o.affiliateUrl} target="_blank" rel="noreferrer" className="mt-1 block truncate font-mono text-xs text-ink-muted underline">
                      {o.affiliateUrl}
                    </a>
                  </div>
                  <ReviewActions id={o.id} waReady={ready} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
