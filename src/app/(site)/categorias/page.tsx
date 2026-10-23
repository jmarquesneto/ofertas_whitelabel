import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { categoryTree } from "@/server/queries";
import { Icon } from "@/components/Icon";

export const metadata = { title: "Categorias" };
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const tree = await categoryTree();
  return (
    <div className="container-site py-6 sm:py-8">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Categorias</h1>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tree.map((c) => (
          <div key={c.id} className="card p-4">
            <Link href={`/ofertas?cat=${c.slug}`} className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/20"><Icon name={c.icon} className="h-5 w-5" /></span>
              <span className="flex-1 font-bold">{c.name}</span>
              <span className="text-xs text-ink-faint">{c.n} {c.n === 1 ? "oferta" : "ofertas"}</span>
              <ChevronRight className="h-4 w-4 text-ink-faint" />
            </Link>
            {c.children.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
                {c.children.map((s) => (
                  <Link key={s.id} href={`/ofertas?cat=${s.slug}`} className="rounded-full bg-surface-sunken px-3 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink">{s.name}</Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
