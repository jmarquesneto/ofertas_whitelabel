import { requireAdmin } from "@/lib/auth";
import { listAllPlatforms } from "@/server/queries";
import { deletePlatformAction } from "@/server/actions/platforms";
import { PageHeader } from "@/components/admin/PageHeader";
import { PlatformBadge } from "@/components/public/PlatformBadge";
import { DeletePlatformButton } from "@/components/admin/DeletePlatformButton";

export const metadata = { title: "Plataformas" };

export default async function PlatformsPage() {
  await requireAdmin();
  const rows = await listAllPlatforms();
  return (
    <>
      <PageHeader
        title="Plataformas"
        subtitle="Lojas e programas de afiliados exibidos nos filtros da vitrine."
        action={<a href="/admin/platforms/new" className="btn-primary">Nova plataforma</a>}
      />
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr>
              <th className="table-head">Plataforma</th>
              <th className="table-head">Ordem</th>
              <th className="table-head text-right">Ofertas</th>
              <th className="table-head">Status</th>
              <th className="table-head" />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="table-cell">
                  <span className="flex items-center gap-3">
                    <PlatformBadge name={p.name} logo={p.logoPath} />
                    <span>
                      <span className="block font-medium">{p.name}</span>
                      <span className="text-xs text-ink-faint">/?p={p.slug}</span>
                    </span>
                  </span>
                </td>
                <td className="table-cell tabular-nums">{p.sortOrder}</td>
                <td className="table-cell text-right tabular-nums">{p.offers}</td>
                <td className="table-cell">{p.isActive ? <span className="text-emerald-700">Ativa</span> : <span className="text-ink-faint">Inativa</span>}</td>
                <td className="table-cell">
                  <div className="flex justify-end gap-2">
                    <a href={`/admin/platforms/${p.id}`} className="btn-ghost px-3 py-1.5 text-xs">Editar</a>
                    <DeletePlatformButton action={deletePlatformAction.bind(null, p.id)} name={p.name} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
