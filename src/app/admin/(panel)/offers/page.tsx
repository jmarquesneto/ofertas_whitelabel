import { requireAdmin } from "@/lib/auth";
import { listAdminOffers } from "@/server/queries";
import { deleteOfferAction, renewOfferAction, toggleOfferAction } from "@/server/actions/offers";
import { PageHeader } from "@/components/admin/PageHeader";
import { ActionButton } from "@/components/admin/ui";
import { cn, fmtInt, timeLeft } from "@/lib/utils";

export const metadata = { title: "Ofertas" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "live", label: "No ar" },
  { key: "expired", label: "Expiradas / pausadas" },
  { key: "all", label: "Todas" },
] as const;

export default async function OffersPage({
  searchParams,
}: { searchParams: Promise<{ f?: string; q?: string; created?: string; updated?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const filter = (TABS.find((t) => t.key === sp.f)?.key ?? "live") as "live" | "expired" | "all";
  const rows = await listAdminOffers(filter, sp.q);
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Ofertas"
        subtitle="Ofertas saem da vitrine automaticamente ao expirar (padrão 72h)."
        action={<a href="/admin/offers/new" className="btn-primary">Nova oferta</a>}
      />

      {(sp.created || sp.updated) && (
        <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {sp.created ? "Oferta publicada." : "Oferta atualizada."}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-surface-sunken p-1">
          {TABS.map((t) => (
            <a key={t.key} href={`/admin/offers?f=${t.key}`}
              className={cn("rounded-md px-3 py-1.5 text-sm font-medium", filter === t.key ? "bg-surface-raised shadow-sm" : "text-ink-muted hover:text-ink")}>
              {t.label}
            </a>
          ))}
        </div>
        <form className="flex gap-2">
          <input type="hidden" name="f" value={filter} />
          <input name="q" defaultValue={sp.q} placeholder="Buscar pelo título" className="input h-9 w-56 py-1.5" />
        </form>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead>
            <tr>
              <th className="table-head w-14" />
              <th className="table-head">Oferta</th>
              <th className="table-head">Cupom</th>
              <th className="table-head">Validade</th>
              <th className="table-head text-right">Cliques</th>
              <th className="table-head" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="table-cell py-12 text-center text-ink-muted">Nada por aqui.</td></tr>
            )}
            {rows.map(({ offer: o, platformName }) => {
              const expired = o.expiresAt <= now;
              return (
                <tr key={o.id} className={cn(!o.isActive && "opacity-60")}>
                  <td className="table-cell">
                    {o.imagePath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.imagePath} alt="" className="h-10 w-10 rounded-md bg-surface-sunken object-contain" />
                    ) : <span className="block h-10 w-10 rounded-md bg-surface-sunken" />}
                  </td>
                  <td className="table-cell max-w-[340px]">
                    <a href={`/admin/offers/${o.id}`} className="line-clamp-1 font-medium hover:underline">{o.title}</a>
                    <span className="text-xs text-ink-faint">{platformName} · <a href={`/${o.slug}`} target="_blank" className="hover:underline">/{o.slug}</a></span>
                  </td>
                  <td className="table-cell font-mono text-xs">{o.coupon ?? "—"}</td>
                  <td className="table-cell text-sm">
                    {!o.isActive ? <span className="text-ink-faint">Pausada</span>
                      : expired ? <span className="text-red-700">Expirada</span>
                      : <span className="text-emerald-700">{timeLeft(o.expiresAt)}</span>}
                  </td>
                  <td className="table-cell text-right font-semibold tabular-nums">{fmtInt(o.clicksCount)}</td>
                  <td className="table-cell">
                    <div className="flex justify-end gap-1.5">
                      {(expired || !o.isActive) && (
                        <ActionButton action={renewOfferAction.bind(null, o.id)} className="btn-ghost px-2.5 py-1.5 text-xs">Renovar 72h</ActionButton>
                      )}
                      {!expired && (
                        <ActionButton action={toggleOfferAction.bind(null, o.id)} className="btn-ghost px-2.5 py-1.5 text-xs">
                          {o.isActive ? "Pausar" : "Publicar"}
                        </ActionButton>
                      )}
                      <a href={`/admin/offers/${o.id}`} className="btn-ghost px-2.5 py-1.5 text-xs">Editar</a>
                      <ActionButton action={deleteOfferAction.bind(null, o.id)} className="btn-danger px-2.5 py-1.5 text-xs" confirmText="Excluir esta oferta e seus cliques?">
                        Excluir
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
