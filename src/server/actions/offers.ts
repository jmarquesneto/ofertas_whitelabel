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
import { requirePage } from "@/lib/auth";
import { RESERVED_SLUGS, slugify, uniqueOfferSlug } from "@/lib/slug";
import { copyUpload, removeUpload, saveUpload, UploadError } from "@/lib/uploads";
import type { ActionState } from "@/lib/utils";
import { enqueueWhatsapp } from "@/server/whatsapp";

const DEFAULT_HOURS = Number(process.env.OFFER_DEFAULT_HOURS ?? 72);

const httpUrl = z
  .string()
  .trim()
  .url("Link inválido")
  .refine((u) => /^https?:\/\//i.test(u), "O link precisa começar com http:// ou https://");

/** Aceita "1.849,90", "1849,90", "1849.90" ou "R$ 1.849,90" → "1849.90" | null */
const money = (label: string) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      const raw = (v ?? "").replace(/R\$|\s/g, "");
      if (!raw) return null;
      const norm = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
      const n = Number(norm);
      if (!Number.isFinite(n) || n < 0 || n > 99_999_999) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} inválido` });
        return z.NEVER;
      }
      return n.toFixed(2);
    });

const schema = z.object({
  platformId: z.coerce.number().int().positive("Selecione a plataforma"),
  categoryId: z.union([z.coerce.number().int().positive(), z.literal("")]).optional().transform((v) => (typeof v === "number" ? v : null)),
  price: money("Preço"),
  originalPrice: money("Preço original"),
  isFeatured: z.boolean(),
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
    categoryId: form.get("categoryId") ?? undefined,
    price: form.get("price") ?? undefined,
    originalPrice: form.get("originalPrice") ?? undefined,
    isFeatured: form.get("isFeatured") === "on",
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
  const user = await requirePage("offers");
  const p = parse(form);
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  if (!(await platformExists(d.platformId))) return { error: "Plataforma inválida" };

  try {
    const uploaded = await saveUpload(form.get("image"), "offers");
    const hours = typeof d.hours === "number" ? d.hours : DEFAULT_HOURS;
    const [row] = await db.insert(offers).values({
      platformId: d.platformId,
      categoryId: d.categoryId,
      price: d.price,
      originalPrice: d.originalPrice,
      isFeatured: d.isFeatured,
      title: d.title,
      description: d.description,
      affiliateUrl: d.affiliateUrl,
      coupon: d.coupon,
      imagePath: uploaded ?? (d.imageUrl || null),
      slug: await resolveSlug(d.slug, d.title),
      isActive: d.isActive,
      expiresAt: new Date(Date.now() + hours * 3_600_000),
      createdBy: user.id,
    }).returning({ id: offers.id });
    if (d.isActive && form.get("sendWhatsapp") === "on") await enqueueWhatsapp(row.id);
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    throw e;
  }
  revalidatePath("/");
  redirect("/admin/offers?created=1");
}

export async function updateOfferAction(id: number, _: ActionState, form: FormData): Promise<ActionState> {
  await requirePage("offers");
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
        categoryId: d.categoryId,
        price: d.price,
        originalPrice: d.originalPrice,
        isFeatured: d.isFeatured,
        title: d.title,
        description: d.description,
        affiliateUrl: d.affiliateUrl,
        coupon: d.coupon,
        imagePath,
        slug,
        // Na esteira de aprovação continua pausada: quem publica é o botão "Aprovar"
        isActive: current.reviewStatus === "pending" ? false : d.isActive,
        // "Renovar por X horas": conta a partir de agora. Em branco = mantém a validade.
        ...(typeof d.hours === "number" ? { expiresAt: new Date(Date.now() + d.hours * 3_600_000) } : {}),
        updatedAt: sql`now()`,
      })
      .where(eq(offers.id, id));

    if (d.isActive && !current.reviewStatus && form.get("sendWhatsapp") === "on") await enqueueWhatsapp(id);
    if (imagePath !== current.imagePath) await removeUpload(current.imagePath);
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    throw e;
  }
  revalidatePath("/");
  redirect(current.reviewStatus === "pending" ? "/admin/aprovacao" : "/admin/offers?updated=1");
}

export async function deleteOfferAction(id: number) {
  await requirePage("offers");
  const [gone] = await db.delete(offers).where(eq(offers.id, id)).returning();
  await removeUpload(gone?.imagePath);
  revalidatePath("/");
  revalidatePath("/admin/offers");
}

/** Ação rápida da listagem: renova por mais N horas (padrão 72h) e reativa */
export async function renewOfferAction(id: number) {
  await requirePage("offers");
  await db
    .update(offers)
    .set({ expiresAt: new Date(Date.now() + DEFAULT_HOURS * 3_600_000), isActive: true, updatedAt: sql`now()` })
    .where(eq(offers.id, id));
  revalidatePath("/");
  revalidatePath("/admin/offers");
}

export async function toggleOfferAction(id: number) {
  await requirePage("offers");
  await db.update(offers).set({ isActive: sql`not ${offers.isActive}`, updatedAt: sql`now()` }).where(eq(offers.id, id));
  revalidatePath("/");
  revalidatePath("/admin/offers");
}

/** Estrela da listagem: liga/desliga "destaque na home" */
export async function toggleFeaturedAction(id: number) {
  await requirePage("offers");
  await db.update(offers).set({ isFeatured: sql`not ${offers.isFeatured}`, updatedAt: sql`now()` }).where(eq(offers.id, id));
  revalidatePath("/");
  revalidatePath("/admin/offers");
}

/** Duplicar: cria uma cópia pausada para editar (ex.: mesma oferta em outra loja) */
export async function duplicateOfferAction(id: number) {
  const user = await requirePage("offers");
  const [o] = await db.select().from(offers).where(eq(offers.id, id)).limit(1);
  if (!o) return;
  const [copy] = await db
    .insert(offers)
    .values({
      platformId: o.platformId, categoryId: o.categoryId, title: o.title, description: o.description,
      price: o.price, originalPrice: o.originalPrice, affiliateUrl: o.affiliateUrl, coupon: o.coupon,
      imagePath: await copyUpload(o.imagePath),
      slug: await uniqueOfferSlug(o.title), isActive: false, isFeatured: false,
      expiresAt: new Date(Date.now() + DEFAULT_HOURS * 3_600_000), createdBy: user.id,
    })
    .returning({ id: offers.id });
  redirect(`/admin/offers/${copy.id}`);
}
