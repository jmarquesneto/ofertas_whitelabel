import { isNull, asc } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { createCategoryAction } from "@/server/actions/categories";
import { PageHeader } from "@/components/admin/PageHeader";
import { CategoryForm } from "@/components/admin/CategoryForm";

export const metadata = { title: "Nova categoria" };

export default async function NewCategory() {
  await requirePage("categories");
  const roots = await db.select({ id: categories.id, name: categories.name }).from(categories).where(isNull(categories.parentId)).orderBy(asc(categories.sortOrder));
  return (
    <>
      <PageHeader title="Nova categoria" />
      <CategoryForm action={createCategoryAction} roots={roots} />
    </>
  );
}
