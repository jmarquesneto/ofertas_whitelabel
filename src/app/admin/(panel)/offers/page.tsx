import { Copy, Pause, Pencil, Play, RotateCw, Search, Star, Trash2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { listAdminOffers } from "@/server/queries";
import {
  deleteOfferAction, duplicateOfferAction, renewOfferAction, toggleFeaturedAction, toggleOfferAction,
} from "@/server/actions/offers";
import { PageHeader } from "@/components/admin/PageHeader";
import { IconAction } from "@/components/admin/ui";
import { cn, discountPct, fmtBRL, fmtInt, timeLeft } from "@/lib/utils";

export const metadata = { title: "Ofertas" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "live", label: "No ar" },
  { key: "expired", label: "Expiradas e pausadas" },
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
        subtitle="Saem da vitrine sozinhas quando a validade termina. A estrela coloca a oferta em destaque na home."
        action={<a href="/admin/offers/new" className="btn-primary">+ Nova oferta</a>}
      />

      {(sp.created || sp.updated) && (
        <p role="status" className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          {sp.created ? "Oferta publicada." : "Oferta atualizada."}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-surface-sunken p-1">
          {TABS.map((t) => (
            <a key={t.key} href={`/admin/offers?f=${t.key}`}
              className={cn("rounded-lg px-3.5 py-2 text-sm font-semibold transition", filter === t.key ? "bg-surface-raised text-ink shadow-sm" : "text-ink-muted hover:text-ink")}>
              {t.label}
            </a>
          ))}
        </div>
        <form className="relative">
          <input type="hidden" name="f" value={filter} />
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input name="q" defaultValue={sp.q} placeholder="Buscar pelo título" className="input h-10 w-64 py-2 pl-9" />
        </form>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-surface">
            <tr>
              <th className="table-head">Oferta</th>
              <th className="table-head">Preço</th>
              <th className="table-head">Validade</th>
              <th className="table-head text-right">Cliques</th>
              <th className="table-head text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="table-cell py-14 text-center text-ink-muted">Nada por aqui.</td></tr>
            )}
            {rows.map(({ offer: o, platformName, categoryName }) => {
              const expired = o.expiresAt <= now;
              const pct = discountPct(o.price, o.originalPrice);
              return (
                <tr key={o.id} className={cn("hover:bg-surface/60", !o.isActive && "opacity-60")}>
                  <td className="table-cell max-w-[380px]">
                    <div className="flex items-center gap-3">
                      {o.imagePath ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={o.imagePath} alt="" className="h-12 w-12 shrink-0 rounded-lg bg-white object-contain ring-1 ring-line" />
                      ) : <span className="h-12 w-12 shrink-0 rounded-lg bg-surface-sunken" />}
                      <div className="min-w-0">
                        <a href={`/admin/offers/${o.id}`} className="line-clamp-1 font-semibold hover:underline">{o.title}</a>
                        <p className="truncate text-xs text-ink-faint">
                          {platformName}{categoryName && ` · ${categoryName}`}{o.coupon && <> · <span className="font-mono font-semibold text-ink-muted">{o.coupon}</span></>}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell whitespace-nowrap">
                    {o.price ? (
                      <div>
                        <span className="font-bold text-price">{fmtBRL(o.price)}</span>
                        {pct && <span className="ml-1.5 rounded bg-primary px-1 py-0.5 text-[10px] font-extrabold text-primary-fg">-{pct}%</span>}
                      </div>
                    ) : <span className="text-ink-faint">—</span>}
                  </td>
                  <td className="table-cell whitespace-nowrap text-sm">
                    {!o.isActive ? <span className="font-semibold text-ink-faint">Pausada</span>
                      : expired ? <span className="font-semibold text-red-700">Expirada</span>
                      : <span className="font-semibold text-green-700">{timeLeft(o.expiresAt)}</span>}
                  </td>
                  <td className="table-cell text-right font-bold tabular-nums">{fmtInt(o.clicksCount)}</td>
                  <td className="table-cell">
                    <div className="flex justify-end gap-1">
                      <IconAction action={toggleFeaturedAction.bind(null, o.id)} label={o.isFeatured ? "Tirar do destaque" : "Destacar na home"}>
                        <Star className={cn("h-4 w-4", o.isFeatured && "fill-primary text-primary")} />
                      </IconAction>
                      {expired ? (
                        <IconAction action={renewOfferAction.bind(null, o.id)} label="Renovar por 72h e publicar"><RotateCw className="h-4 w-4" /></IconAction>
                      ) : o.isActive ? (
                        <IconAction action={toggleOfferAction.bind(null, o.id)} label="Pausar"><Pause className="h-4 w-4" /></IconAction>
                      ) : (
                        <IconAction action={toggleOfferAction.bind(null, o.id)} label="Publicar"><Play className="h-4 w-4" /></IconAction>
                      )}
                      <IconAction action={duplicateOfferAction.bind(null, o.id)} label="Duplicar"><Copy className="h-4 w-4" /></IconAction>
                      <a href={`/admin/offers/${o.id}`} title="Editar" aria-label="Editar" className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted transition hover:bg-surface-sunken hover:text-ink">
                        <Pencil className="h-4 w-4" />
                      </a>
                      <IconAction action={deleteOfferAction.bind(null, o.id)} label="Excluir" danger confirmText="Excluir esta oferta e o histórico de cliques?">
                        <Trash2 className="h-4 w-4" />
                      </IconAction>
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
