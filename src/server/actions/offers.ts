"use server";
/**
 * CONTROLLER — CRUD de Ofertas
 * - slug gerado automaticamente a partir do título (ou informado manualmente)
 * - expiração padrão de 72h (configurável por oferta)
 * - imagem por upload OU URL externa
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { offers, platforms } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { RESERVED_SLUGS, slugify, uniqueOfferSlug } from "@/lib/slug";
import { removeUpload, saveUpload, UploadError } from "@/lib/uploads";
import type { ActionState } from "@/lib/utils";

const DEFAULT_HOURS = Number(process.env.OFFER_DEFAULT_HOURS ?? 72);

const httpUrl = z
  .string()
  .trim()
  .url("Link inválido")
  .refine((u) => /^https?:\/\//i.test(u), "O link precisa começar com http:// ou https://");

const schema = z.object({
  platformId: z.coerce.number().int().positive("Selecione a plataforma"),
  title: z.string().trim().min(3, "Título muito curto").max(200),
  description: z.string().trim().max(2000).optional().transform((v) => v || null),
  affiliateUrl: httpUrl,
  coupon: z.string().trim().max(60).optional().transform((v) => v?.toUpperCase() || null),
  imageUrl: z.union([httpUrl, z.literal("")]).optional(),
  slug: z.string().trim().max(110).optional(),
  hours: z.union([z.coerce.number().int().min(1, "Mínimo 1h").max(24 * 30, "Máximo 30 dias"), z.literal("")]).optional(),
  isActive: z.boolean(),
});

function parse(form: FormData) {
  return schema.safeParse({
    platformId: form.get("platformId"),
    title: form.get("title"),
    description: form.get("description") ?? undefined,
    affiliateUrl: form.get("affiliateUrl"),
    coupon: form.get("coupon") ?? undefined,
    imageUrl: form.get("imageUrl") ?? undefined,
    slug: form.get("slug") ?? undefined,
    hours: form.get("hours") ?? undefined,
    isActive: form.get("isActive") === "on",
  });
}

async function resolveSlug(manual: string | undefined, title: string, ignoreId?: number) {
  if (manual) {
    const s = slugify(manual, 110);
    if (RESERVED_SLUGS.has(s)) throw new UploadError(`"${s}" é um endereço reservado do sistema`);
    return uniqueOfferSlug(s, ignoreId);
  }
  return uniqueOfferSlug(title, ignoreId);
}

async function platformExists(id: number) {
  const r = await db.select({ id: platforms.id }).from(platforms).where(eq(platforms.id, id)).limit(1);
  return r.length > 0;
}

export async function createOfferAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const p = parse(form);
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  if (!(await platformExists(d.platformId))) return { error: "Plataforma inválida" };

  try {
    const uploaded = await saveUpload(form.get("image"), "offers");
    const hours = typeof d.hours === "number" ? d.hours : DEFAULT_HOURS;
    await db.insert(offers).values({
      platformId: d.platformId,
      title: d.title,
      description: d.description,
      affiliateUrl: d.affiliateUrl,
      coupon: d.coupon,
      imagePath: uploaded ?? (d.imageUrl || null),
      slug: await resolveSlug(d.slug, d.title),
      isActive: d.isActive,
      expiresAt: new Date(Date.now() + hours * 3_600_000),
      createdBy: user.id,
    });
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    throw e;
  }
  revalidatePath("/");
  redirect("/admin/offers?created=1");
}

export async function updateOfferAction(id: number, _: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const p = parse(form);
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;

  const [current] = await db.select().from(offers).where(eq(offers.id, id)).limit(1);
  if (!current) return { error: "Oferta não encontrada" };
  if (!(await platformExists(d.platformId))) return { error: "Plataforma inválida" };

  try {
    const uploaded = await saveUpload(form.get("image"), "offers");
    const removeImage = form.get("removeImage") === "on";
    const imagePath = uploaded ?? (d.imageUrl ? d.imageUrl : removeImage ? null : current.imagePath);

    // slug só muda se o usuário editou o campo (links já divulgados continuam funcionando)
    const slug = d.slug && slugify(d.slug, 110) !== current.slug ? await resolveSlug(d.slug, d.title, id) : current.slug;

    await db
      .update(offers)
      .set({
        platformId: d.platformId,
        title: d.title,
        description: d.description,
        affiliateUrl: d.affiliateUrl,
        coupon: d.coupon,
        imagePath,
        slug,
        isActive: d.isActive,
        // "Renovar por X horas": conta a partir de agora. Em branco = mantém a validade.
        ...(typeof d.hours === "number" ? { expiresAt: new Date(Date.now() + d.hours * 3_600_000) } : {}),
        updatedAt: sql`now()`,
      })
      .where(eq(offers.id, id));

    if (imagePath !== current.imagePath) await removeUpload(current.imagePath);
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    throw e;
  }
  revalidatePath("/");
  redirect("/admin/offers?updated=1");
}

export async function deleteOfferAction(id: number) {
  await requireAdmin();
  const [gone] = await db.delete(offers).where(eq(offers.id, id)).returning();
  await removeUpload(gone?.imagePath);
  revalidatePath("/");
  revalidatePath("/admin/offers");
}

/** Ação rápida da listagem: renova por mais N horas (padrão 72h) e reativa */
export async function renewOfferAction(id: number) {
  await requireAdmin();
  await db
    .update(offers)
    .set({ expiresAt: new Date(Date.now() + DEFAULT_HOURS * 3_600_000), isActive: true, updatedAt: sql`now()` })
    .where(eq(offers.id, id));
  revalidatePath("/");
  revalidatePath("/admin/offers");
}

export async function toggleOfferAction(id: number) {
  await requireAdmin();
  await db.update(offers).set({ isActive: sql`not ${offers.isActive}`, updatedAt: sql`now()` }).where(eq(offers.id, id));
  revalidatePath("/");
  revalidatePath("/admin/offers");
}
