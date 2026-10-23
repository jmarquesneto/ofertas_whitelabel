import { requireAdmin } from "@/lib/auth";
import { clicksByOffer, dashboardStats } from "@/server/queries";
import { PageHeader } from "@/components/admin/PageHeader";
import { fmtInt, timeLeft } from "@/lib/utils";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  await requireAdmin();
  const [stats, ranking] = await Promise.all([dashboardStats(), clicksByOffer(50)]);
  const max = Math.max(1, ...stats.daily.map((d) => d.n));

  const kpis = [
    { label: "Cliques (24h)", value: stats.last24h },
    { label: "Cliques (7 dias)", value: stats.last7d },
    { label: "Visitantes únicos (7 dias)", value: stats.unique7d },
    { label: "Ofertas no ar", value: stats.liveOffers },
  ];

  return (
    <>
      <PageHeader title="Analytics" subtitle={`${fmtInt(stats.total)} cliques registrados desde o início`} />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4">
            <p className="text-xs font-medium text-ink-muted">{k.label}</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight">{fmtInt(k.value)}</p>
          </div>
        ))}
      </section>

      <section className="card mt-4 p-5">
        <h2 className="text-sm font-semibold">Cliques por dia · últimos 14 dias</h2>
        <div className="mt-4 flex h-40 items-end gap-1.5" role="img" aria-label="Gráfico de cliques por dia">
          {stats.daily.map((d) => {
            const [, m, day] = d.day.split("-");
            return (
              <div key={d.day} className="group flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] tabular-nums text-ink-muted opacity-0 transition group-hover:opacity-100">{d.n}</span>
                <div
                  className="w-full rounded-t-[4px] bg-secondary/80 transition group-hover:bg-secondary"
                  style={{ height: `${Math.max(2, (d.n / max) * 100)}%` }}
                  title={`${day}/${m}: ${d.n} cliques`}
                />
                <span className="text-[10px] tabular-nums text-ink-faint">{day}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card mt-4 overflow-hidden">
        <h2 className="px-4 pt-4 text-sm font-semibold">Cliques por oferta</h2>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full min-w-[640px]">
            <thead>
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
              {ranking.map((r) => {
                const live = r.isActive && r.expiresAt > new Date();
                return (
                  <tr key={r.id}>
                    <td className="table-cell max-w-[320px]">
                      <a href={`/admin/offers/${r.id}`} className="line-clamp-1 font-medium hover:underline">{r.title}</a>
                      <span className="text-xs text-ink-faint">/{r.slug}</span>
                    </td>
                    <td className="table-cell text-ink-muted">{r.platform}</td>
                    <td className="table-cell text-right tabular-nums">{fmtInt(r.last7d)}</td>
                    <td className="table-cell text-right font-semibold tabular-nums">{fmtInt(r.total)}</td>
                    <td className="table-cell">
                      <span className={live ? "text-emerald-700" : "text-ink-faint"}>
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
