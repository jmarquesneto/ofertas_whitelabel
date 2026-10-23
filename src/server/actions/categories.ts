"use server";
/** CONTROLLER — CRUD de Categorias (2 níveis) */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { categories, offers } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { uniqueCategorySlug } from "@/lib/slug";
import { ICONS } from "@/components/Icon";
import type { ActionState } from "@/lib/utils";

const schema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(80),
  parentId: z.union([z.coerce.number().int().positive(), z.literal("")]).optional().transform((v) => (typeof v === "number" ? v : null)),
  icon: z.string().refine((v) => v in ICONS, "Ícone inválido"),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean(),
});

const parse = (f: FormData) =>
  schema.safeParse({
    name: f.get("name"),
    parentId: f.get("parentId") ?? undefined,
    icon: f.get("icon") ?? "tag",
    sortOrder: f.get("sortOrder") || 0,
    isActive: f.get("isActive") === "on",
  });

/** Só 2 níveis: o pai precisa ser uma categoria raiz e não pode ser ela mesma */
async function validParent(parentId: number | null, selfId?: number) {
  if (!parentId) return null;
  if (parentId === selfId) return "Uma categoria não pode ser subcategoria dela mesma";
  const [p] = await db.select().from(categories).where(eq(categories.id, parentId)).limit(1);
  if (!p) return "Categoria pai não encontrada";
  if (p.parentId) return "Só são permitidos 2 níveis (categoria → subcategoria)";
  if (selfId) {
    const [{ n }] = await db.select({ n: count() }).from(categories).where(eq(categories.parentId, selfId));
    if (n > 0) return "Esta categoria tem subcategorias, então não pode virar subcategoria";
  }
  return null;
}

export async function createCategoryAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const p = parse(form);
  if (!p.success) return { error: p.error.issues[0].message };
  const err = await validParent(p.data.parentId);
  if (err) return { error: err };
  await db.insert(categories).values({ ...p.data, slug: await uniqueCategorySlug(p.data.name) });
  revalidatePath("/", "layout");
  redirect("/admin/categories");
}

export async function updateCategoryAction(id: number, _: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const p = parse(form);
  if (!p.success) return { error: p.error.issues[0].message };
  const [current] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  if (!current) return { error: "Categoria não encontrada" };
  const err = await validParent(p.data.parentId, id);
  if (err) return { error: err };
  await db
    .update(categories)
    .set({ ...p.data, slug: current.name === p.data.name ? current.slug : await uniqueCategorySlug(p.data.name, id) })
    .where(eq(categories.id, id));
  revalidatePath("/", "layout");
  redirect("/admin/categories");
}

/** Excluir: ofertas ficam "sem categoria"; subcategorias são excluídas junto */
export async function deleteCategoryAction(id: number) {
  await requireAdmin();
  const subs = await db.select({ id: categories.id }).from(categories).where(eq(categories.parentId, id));
  for (const s of [...subs.map((x) => x.id), id]) {
    await db.update(offers).set({ categoryId: null }).where(and(eq(offers.categoryId, s)));
  }
  await db.delete(categories).where(eq(categories.id, id));
  revalidatePath("/", "layout");
  revalidatePath("/admin/categories");
}
