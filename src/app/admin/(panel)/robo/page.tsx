import { and, count, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { offers } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { collectorOnline, getBotSettings } from "@/lib/bot";
import { PageHeader } from "@/components/admin/PageHeader";
import { AmazonCard, GeneralForm, MercadoLivreCard, NichesForm, RunCycleButton, ShopeeCard } from "@/components/admin/BotForms";
import { cn, fmtInt } from "@/lib/utils";

export const metadata = { title: "Robô de ofertas" };
export const dynamic = "force-dynamic";

const ago = (iso?: string) => {
  if (!iso) return "nunca";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  return m < 1 ? "agora" : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} dia(s)`;
};

export default async function RoboPage() {
  await requirePage("bot");
  const s = await getBotSettings();
  const st = s.status;
  const online = collectorOnline(st.seenAt);
  const [{ n: last24 }] = await db
    .select({ n: count() })
    .from(offers)
    .where(and(eq(offers.source, "bot"), gt(offers.createdAt, sql`now() - interval '24 hours'`)));

  return (
    <>
      <PageHeader
        title="Robô de ofertas"
        subtitle="Garimpa promoções no Mercado Livre, Amazon e Shopee com os seus links de afiliado e manda para o site e o WhatsApp."
        action={<RunCycleButton disabled={!online} />}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {[
          ["Coletor", online ? "Online" : "Offline", online ? "text-emerald-700" : "text-red-700",
            online ? `falou ${ago(st.seenAt)}` : "confira o container coletor no Portainer"],
          ["Robô", s.enabled ? (st.running ? "Buscando…" : "Ligado") : "Desligado", s.enabled ? "text-emerald-700" : "text-ink-muted",
            s.mode === "review" ? "esteira de aprovação" : "publica direto"],
          ["Último ciclo", ago(st.lastCycleAt), "",
            st.lastCycle ? `${st.lastCycle.coletadas} lidas · ${st.lastCycle.aprovadas} passaram · ${st.lastCycle.enviadas} entregues` : "—"],
          ["Ofertas do robô (24h)", fmtInt(last24), "", st.lastCycle?.erro ?? `a cada ${s.intervalMinutes} min`],
        ].map(([label, value, color, sub]) => (
          <div key={label} className="card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
            <p className={cn("mt-1 text-lg font-extrabold", color)}>{value}</p>
            <p className="mt-0.5 truncate text-xs text-ink-muted" title={sub}>{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="grid content-start gap-6">
          <GeneralForm
            initial={{
              enabled: s.enabled, mode: s.mode as "review" | "direct", intervalMinutes: s.intervalMinutes,
              maxPerCycle: s.maxPerCycle, spacingSeconds: s.spacingSeconds, noRepeatDays: s.noRepeatDays,
              activeFrom: s.activeFrom, activeTo: s.activeTo, minDiscount: s.minDiscount, maxDiscount: s.maxDiscount,
              minPrice: s.minPrice, maxPrice: s.maxPrice, blockedWords: s.blockedWords,
            }}
          />
          <NichesForm selected={s.niches} />
        </div>
        <div className="grid content-start gap-6">
          <h2 className="-mb-3 text-lg font-extrabold">Lojas</h2>
          <MercadoLivreCard cfg={s.sources.mercadolivre} status={st.sources?.mercadolivre} session={st.mlSession}
            loginOpen={st.mlLoginOpen} novncUrl={process.env.NOVNC_URL ?? ""} novncPort={Number(process.env.NOVNC_PORT ?? 6080)} />
          <AmazonCard cfg={s.sources.amazon} status={st.sources?.amazon} />
          <ShopeeCard cfg={s.sources.shopee} status={st.sources?.shopee} />
        </div>
      </div>
    </>
  );
}
