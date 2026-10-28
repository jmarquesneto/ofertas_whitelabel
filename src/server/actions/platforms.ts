"use server";
/** CONTROLLER — CRUD de Plataformas (nome + logo) */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { offers, platforms } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { uniquePlatformSlug } from "@/lib/slug";
import { removeUpload, saveUpload, UploadError } from "@/lib/uploads";
import type { ActionState } from "@/lib/utils";

const schema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(80),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean(),
  // Link de afiliado da loja, usado no "Teste o cupom através deste link"
  couponUrl: z
    .union([z.string().trim().url("Link de afiliado da loja inválido").refine((u) => /^https?:\/\//i.test(u), "O link precisa começar com http(s)://"), z.literal("")])
    .optional()
    .transform((v) => v || null),
});

function parse(form: FormData) {
  return schema.safeParse({
    name: form.get("name"),
    sortOrder: form.get("sortOrder") || 0,
    isActive: form.get("isActive") === "on",
    couponUrl: form.get("couponUrl") ?? undefined,
  });
}

export async function createPlatformAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requirePage("platforms");
  const p = parse(form);
  if (!p.success) return { error: p.error.issues[0].message };
  try {
    const logoPath = await saveUpload(form.get("logo"), "platforms");
    const couponBannerPath = await saveUpload(form.get("couponBanner"), "platforms");
    await db.insert(platforms).values({ ...p.data, slug: await uniquePlatformSlug(p.data.name), logoPath, couponBannerPath });
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    throw e;
  }
  revalidatePath("/");
  revalidatePath("/cupons");
  redirect("/admin/platforms");
}

export async function updatePlatformAction(id: number, _: ActionState, form: FormData): Promise<ActionState> {
  await requirePage("platforms");
  const p = parse(form);
  if (!p.success) return { error: p.error.issues[0].message };

  const [current] = await db.select().from(platforms).where(eq(platforms.id, id)).limit(1);
  if (!current) return { error: "Plataforma não encontrada" };
  try {
    const logoPath = await saveUpload(form.get("logo"), "platforms");
    const banner = await saveUpload(form.get("couponBanner"), "platforms");
    const removeBanner = form.get("removeCouponBanner") === "on";
    await db
      .update(platforms)
      .set({
        ...p.data,
        slug: current.name === p.data.name ? current.slug : await uniquePlatformSlug(p.data.name, id),
        logoPath: logoPath ?? current.logoPath,
        couponBannerPath: banner ?? (removeBanner ? null : current.couponBannerPath),
      })
      .where(eq(platforms.id, id));
    if (logoPath) await removeUpload(current.logoPath);
    if (banner || removeBanner) await removeUpload(current.couponBannerPath);
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    throw e;
  }
  revalidatePath("/");
  revalidatePath("/cupons");
  redirect("/admin/platforms");
}

export async function deletePlatformAction(id: number): Promise<ActionState> {
  await requirePage("platforms");
  const [{ n }] = await db.select({ n: count() }).from(offers).where(eq(offers.platformId, id));
  if (n > 0) return { error: `Existem ${n} oferta(s) nesta plataforma. Exclua-as ou desative a plataforma.` };
  const [gone] = await db.delete(platforms).where(eq(platforms.id, id)).returning();
  await removeUpload(gone?.logoPath);
  await removeUpload(gone?.couponBannerPath);
  revalidatePath("/");
  revalidatePath("/admin/platforms");
  return { ok: true };
}
