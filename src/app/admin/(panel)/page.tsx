import { Eye, MousePointerClick, Tag, Users } from "lucide-react";
import { requirePage } from "@/lib/auth";
import { clicksByOffer, dashboardStats } from "@/server/queries";
import { PageHeader } from "@/components/admin/PageHeader";
import { fmtInt, timeLeft } from "@/lib/utils";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  await requirePage("analytics");
  const [stats, ranking] = await Promise.all([dashboardStats(), clicksByOffer(12)]);
  const max = Math.max(1, ...stats.daily.map((d) => d.n));
  const week = stats.daily.slice(-7).reduce((a, d) => a + d.n, 0);
  const prevWeek = stats.daily.slice(0, 7).reduce((a, d) => a + d.n, 0);
  const trend = prevWeek ? Math.round(((week - prevWeek) / prevWeek) * 100) : null;

  const kpis = [
    { label: "Cliques hoje (24h)", value: stats.last24h, icon: MousePointerClick },
    { label: "Cliques em 7 dias", value: stats.last7d, icon: Eye, extra: trend !== null ? `${trend >= 0 ? "+" : ""}${trend}% vs. semana anterior` : null, up: (trend ?? 0) >= 0 },
    { label: "Visitantes únicos (7d)", value: stats.unique7d, icon: Users },
    { label: "Ofertas no ar", value: stats.liveOffers, icon: Tag },
  ];

  return (
    <>
      <PageHeader title="Analytics" subtitle={`${fmtInt(stats.total)} cliques registrados desde o início`}
        action={<a href="/admin/offers/new" className="btn-primary">+ Nova oferta</a>} />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {kpis.map(({ label, value, icon: I, extra, up }) => (
          <div key={label} className="card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-ink-muted">{label}</p>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/20 text-ink"><I className="h-[18px] w-[18px]" /></span>
            </div>
            <p className="mt-2 text-3xl font-extrabold tabular-nums tracking-tight">{fmtInt(value)}</p>
            {extra && <p className={`mt-1 text-xs font-semibold ${up ? "text-price" : "text-red-700"}`}>{extra}</p>}
          </div>
        ))}
      </section>

      <section className="card mt-4 p-5 sm:p-6">
        <h2 className="font-bold">Cliques por dia</h2>
        <p className="text-xs text-ink-faint">Últimos 14 dias</p>
        <div className="mt-5 flex h-44 items-end gap-1.5 sm:gap-2" role="img" aria-label="Gráfico de cliques por dia">
          {stats.daily.map((d, i) => {
            const [, m, day] = d.day.split("-");
            const today = i === stats.daily.length - 1;
            return (
              <div key={d.day} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-[10px] font-semibold tabular-nums text-ink-muted opacity-0 transition group-hover:opacity-100">{d.n}</span>
                <div className={`w-full rounded-t-md transition ${today ? "bg-primary" : "bg-secondary/80 group-hover:bg-secondary"}`}
                  style={{ height: `${Math.max(3, (d.n / max) * 100)}%` }} title={`${day}/${m}: ${d.n} cliques`} />
                <span className={`text-[10px] tabular-nums ${today ? "font-bold text-ink" : "text-ink-faint"}`}>{day}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="font-bold">Ofertas que mais recebem cliques</h2>
          <a href="/admin/offers?f=all" className="text-sm font-semibold text-ink-muted hover:text-ink">Ver todas</a>
        </div>
        <div className="overflow-x-auto">
          <table className="mt-3 w-full min-w-[640px]">
            <thead className="bg-surface">
              <tr>
                <th className="table-head">Oferta</th>
                <th className="table-head">Plataforma</th>
                <th className="table-head text-right">7 dias</th>
                <th className="table-head text-right">Total</th>
                <th className="table-head">Status</th>
              </tr>
            </thead>
            <tbody>
              {ranking.length === 0 && (
                <tr><td colSpan={5} className="table-cell py-10 text-center text-ink-muted">Nenhuma oferta cadastrada ainda.</td></tr>
              )}
              {ranking.map((r, i) => {
                const live = r.isActive && r.expiresAt > new Date();
                return (
                  <tr key={r.id} className="hover:bg-surface/60">
                    <td className="table-cell max-w-[340px]">
                      <div className="flex items-center gap-3">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface-sunken text-xs font-bold text-ink-muted">{i + 1}</span>
                        <a href={`/admin/offers/${r.id}`} className="line-clamp-1 font-semibold hover:underline">{r.title}</a>
                      </div>
                    </td>
                    <td className="table-cell text-ink-muted">{r.platform}</td>
                    <td className="table-cell text-right tabular-nums">{fmtInt(r.last7d)}</td>
                    <td className="table-cell text-right font-bold tabular-nums">{fmtInt(r.total)}</td>
                    <td className="table-cell">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${live ? "bg-green-50 text-green-800" : "bg-surface-sunken text-ink-faint"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-green-600" : "bg-ink-faint"}`} />
                        {live ? `No ar · ${timeLeft(r.expiresAt)}` : r.isActive ? "Expirada" : "Pausada"}
                      </span>
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
