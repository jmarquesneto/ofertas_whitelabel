import { asc, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { offers, platforms, whatsappGroups, whatsappSends } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { getWhatsappSettings } from "@/lib/bot";
import { cn } from "@/lib/utils";
import { buildCouponMessage, buildMessage } from "@/server/whatsapp";
import { PageHeader } from "@/components/admin/PageHeader";
import { GroupsForm, ResendButton, WhatsappForm } from "@/components/admin/WhatsappForms";

export const metadata = { title: "WhatsApp" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, [string, string]> = {
  queued: ["Na fila", "bg-amber-100 text-amber-800"],
  sending: ["Enviando", "bg-sky-100 text-sky-800"],
  sent: ["Enviada", "bg-emerald-100 text-emerald-800"],
  failed: ["Falhou", "bg-red-100 text-red-800"],
};

function Bubble({ label, text, image }: { label: string; text: string; image: string }) {
  return (
    <div className="grid gap-2">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-faint">{label}</p>
      <div className="rounded-2xl bg-[#e7ffdb] p-3 text-[13px] leading-relaxed text-[#111b21] shadow-card">
        <div className="mb-2 grid aspect-[16/9] place-items-center rounded-lg bg-white/70 text-xs text-ink-faint">{image}</div>
        <p className="whitespace-pre-wrap break-words">{text}</p>
      </div>
    </div>
  );
}

export default async function WhatsappPage() {
  await requirePage("whatsapp");
  const [cfg, groups, history, [{ queued }]] = await Promise.all([
    getWhatsappSettings(),
    db.select().from(whatsappGroups).orderBy(asc(whatsappGroups.name)),
    db
      .select({ s: whatsappSends, title: offers.title, platform: platforms.name, group: whatsappGroups.name })
      .from(whatsappSends)
      .leftJoin(offers, eq(offers.id, whatsappSends.offerId))
      .leftJoin(platforms, eq(platforms.id, whatsappSends.platformId))
      .leftJoin(whatsappGroups, eq(whatsappGroups.jid, whatsappSends.groupJid))
      .orderBy(desc(whatsappSends.createdAt))
      .limit(50),
    db.select({ queued: count() }).from(whatsappSends).where(eq(whatsappSends.status, "queued")),
  ]);

  const sampleOffer = buildMessage({
    title: "Fone Bluetooth JBL Tune 520BT", price: "189.90", originalPrice: "299.90", coupon: "JBL10",
    description: "🚚 Frete grátis", slug: "fone-bluetooth-jbl-tune-520bt", platformName: "Mercado Livre",
  });
  const sampleCoupons = buildCouponMessage({ name: "Shopee", slug: "shopee", couponUrl: "https://s.shopee.com.br/x" }, [
    { code: "FRETE10", description: "frete grátis", minValue: "49.00", expiresAt: null },
    { code: "SHOPEE20", description: "R$ 20 off", minValue: "150.00", expiresAt: new Date(Date.now() + 5 * 86_400_000) },
  ]);

  return (
    <>
      <PageHeader
        title="WhatsApp"
        subtitle="Envio das ofertas e cupons aos seus grupos pela Evolution API. Os cliques passam pelo link curto e contam no Analytics."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="grid content-start gap-6">
          <WhatsappForm
            initial={{
              enabled: cfg.enabled, baseUrl: cfg.baseUrl, hasKey: Boolean(cfg.apiKeyEnc), instance: cfg.instance,
              minGapSeconds: cfg.minGapSeconds, sendImage: cfg.sendImage,
            }}
          />
          <GroupsForm saved={groups.map((g) => ({ jid: g.jid, name: g.name, sendOffers: g.sendOffers, sendCoupons: g.sendCoupons }))} />
        </div>
        <aside className="grid content-start gap-5">
          <Bubble label="Mensagem de oferta" text={sampleOffer} image="foto do produto" />
          <Bubble label="Mensagem de cupons" text={sampleCoupons} image="banner de cupons da loja" />
        </aside>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-extrabold">Envios recentes</h2>
          {queued > 0 && <p className="text-sm text-ink-muted">{queued} na fila · 1 a cada {cfg.minGapSeconds}s</p>}
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-surface">
              <tr>
                <th className="table-head">Mensagem</th>
                <th className="table-head">Grupo</th>
                <th className="table-head">Status</th>
                <th className="table-head">Quando</th>
                <th className="table-head text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr><td colSpan={5} className="table-cell py-10 text-center text-ink-muted">Nenhum envio ainda.</td></tr>
              )}
              {history.map(({ s, title, platform, group }) => {
                const [label, cls] = STATUS[s.status] ?? [s.status, ""];
                return (
                  <tr key={s.id}>
                    <td className="table-cell max-w-[340px]">
                      <p className="truncate font-medium">
                        {s.kind === "coupons" ? `🎟️ ${s.couponIds?.length ?? 0} cupom(ns) ${platform ?? ""}` : title}
                      </p>
                      {s.error && <p className="truncate text-xs text-red-700" title={s.error}>{s.error}</p>}
                    </td>
                    <td className="table-cell text-sm text-ink-muted">{group ?? s.groupJid ?? "—"}</td>
                    <td className="table-cell"><span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", cls)}>{label}</span></td>
                    <td className="table-cell text-xs text-ink-muted">
                      {(s.sentAt ?? s.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="table-cell text-right">
                      {s.status === "failed" || s.status === "sent" ? <ResendButton offerId={s.offerId} platformId={s.platformId} /> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
