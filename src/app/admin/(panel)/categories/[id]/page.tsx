import { notFound } from "next/navigation";
import { asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { updateCategoryAction } from "@/server/actions/categories";
import { PageHeader } from "@/components/admin/PageHeader";
import { CategoryForm } from "@/components/admin/CategoryForm";

export const metadata = { title: "Editar categoria" };

export default async function EditCategory({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("categories");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [[c], roots] = await Promise.all([
    db.select().from(categories).where(eq(categories.id, id)).limit(1),
    db.select({ id: categories.id, name: categories.name }).from(categories).where(isNull(categories.parentId)).orderBy(asc(categories.sortOrder)),
  ]);
  if (!c) notFound();
  return (
    <>
      <PageHeader title={`Editar · ${c.name}`} />
      <CategoryForm action={updateCategoryAction.bind(null, id)} roots={roots} initial={c} selfId={id} />
    </>
  );
}
