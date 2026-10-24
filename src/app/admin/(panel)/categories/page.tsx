import { CornerDownRight, Pencil, Trash2 } from "lucide-react";
import { requirePage } from "@/lib/auth";
import { listAllCategories } from "@/server/queries";
import { deleteCategoryAction } from "@/server/actions/categories";
import { PageHeader } from "@/components/admin/PageHeader";
import { IconAction } from "@/components/admin/ui";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/utils";

export const metadata = { title: "Categorias" };
export const dynamic = "force-dynamic";

export default async function CategoriesAdmin() {
  await requirePage("categories");
  const all = await listAllCategories();
  const roots = all.filter((c) => !c.parentId);

  return (
    <>
      <PageHeader title="Categorias" subtitle="Aparecem no menu, na home e na lateral da página de ofertas."
        action={<a href="/admin/categories/new" className="btn-primary">+ Nova categoria</a>} />
      <div className="grid gap-3">
        {roots.map((r) => {
          const subs = all.filter((c) => c.parentId === r.id);
          return (
            <div key={r.id} className={cn("card overflow-hidden", !r.isActive && "opacity-60")}>
              <Row c={r} root />
              {subs.map((s) => <Row key={s.id} c={s} />)}
            </div>
          );
        })}
        {roots.length === 0 && <p className="card p-10 text-center text-sm text-ink-muted">Nenhuma categoria ainda.</p>}
      </div>
    </>
  );
}

function Row({ c, root }: { c: Awaited<ReturnType<typeof listAllCategories>>[number]; root?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 px-4 py-3", !root && "border-t border-line bg-surface/50 pl-6")}>
      {root ? (
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/20"><Icon name={c.icon} className="h-5 w-5" /></span>
      ) : (
        <CornerDownRight className="h-4 w-4 text-ink-faint" />
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("truncate", root ? "font-bold" : "text-sm font-semibold")}>
          {c.name} {!c.isActive && <span className="ml-1 rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] font-semibold text-ink-faint">inativa</span>}
        </p>
        <p className="text-xs text-ink-faint">/ofertas?cat={c.slug} · {c.offers} {c.offers === 1 ? "oferta" : "ofertas"}</p>
      </div>
      <a href={`/admin/categories/${c.id}`} title="Editar" aria-label="Editar" className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink"><Pencil className="h-4 w-4" /></a>
      <IconAction action={deleteCategoryAction.bind(null, c.id)} label="Excluir" danger
        confirmText={root ? `Excluir "${c.name}" e suas subcategorias? As ofertas ficam sem categoria.` : `Excluir "${c.name}"? As ofertas ficam sem categoria.`}>
        <Trash2 className="h-4 w-4" />
      </IconAction>
    </div>
  );
}
