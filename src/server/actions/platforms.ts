"use server";
/** CONTROLLER — CRUD de Plataformas (nome + logo) */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { offers, platforms } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { uniquePlatformSlug } from "@/lib/slug";
import { removeUpload, saveUpload, UploadError } from "@/lib/uploads";
import type { ActionState } from "@/lib/utils";

const schema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(80),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean(),
});

function parse(form: FormData) {
  return schema.safeParse({
    name: form.get("name"),
    sortOrder: form.get("sortOrder") || 0,
    isActive: form.get("isActive") === "on",
  });
}

export async function createPlatformAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const p = parse(form);
  if (!p.success) return { error: p.error.issues[0].message };
  try {
    const logoPath = await saveUpload(form.get("logo"), "platforms");
    await db.insert(platforms).values({ ...p.data, slug: await uniquePlatformSlug(p.data.name), logoPath });
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    throw e;
  }
  revalidatePath("/");
  redirect("/admin/platforms");
}

export async function updatePlatformAction(id: number, _: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const p = parse(form);
  if (!p.success) return { error: p.error.issues[0].message };

  const [current] = await db.select().from(platforms).where(eq(platforms.id, id)).limit(1);
  if (!current) return { error: "Plataforma não encontrada" };
  try {
    const logoPath = await saveUpload(form.get("logo"), "platforms");
    await db
      .update(platforms)
      .set({
        ...p.data,
        slug: current.name === p.data.name ? current.slug : await uniquePlatformSlug(p.data.name, id),
        logoPath: logoPath ?? current.logoPath,
      })
      .where(eq(platforms.id, id));
    if (logoPath) await removeUpload(current.logoPath);
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    throw e;
  }
  revalidatePath("/");
  redirect("/admin/platforms");
}

export async function deletePlatformAction(id: number): Promise<ActionState> {
  await requireAdmin();
  const [{ n }] = await db.select({ n: count() }).from(offers).where(eq(offers.platformId, id));
  if (n > 0) return { error: `Existem ${n} oferta(s) nesta plataforma. Exclua-as ou desative a plataforma.` };
  const [gone] = await db.delete(platforms).where(eq(platforms.id, id)).returning();
  await removeUpload(gone?.logoPath);
  revalidatePath("/");
  revalidatePath("/admin/platforms");
  return { ok: true };
}
