/**
 * POST /api/ext/offers — publica (ou manda para Aprovação) a oferta montada na extensão.
 * Mesmo produto publicado nos últimos 7 dias → 409 com aviso; a extensão pergunta e reenvia com force.
 */
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { categories, offers, platforms } from "@/db/schema";
import { uniqueOfferSlug } from "@/lib/slug";
import { extUser, json, preflight } from "@/server/ext-auth";
import { enqueueWhatsapp } from "@/server/whatsapp";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

const DEFAULT_HOURS = Number(process.env.OFFER_DEFAULT_HOURS ?? 72);
const httpUrl = z.string().trim().url().max(2000).refine((u) => /^https?:\/\//i.test(u), "link precisa começar com http(s)://");
const money = z.union([z.number(), z.string()]).nullable().optional().transform((v) => {
  if (v == null || v === "") return null;
  const raw = String(v).replace(/R\$|\s/g, "");
  const n = typeof v === "number" ? v : Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);
  return Number.isFinite(n) && n > 0 ? n.toFixed(2) : null;
});

const schema = z.object({
  platformId: z.coerce.number().int().positive("Escolha a loja"),
  categoryId: z.coerce.number().int().positive().nullable().optional(),
  title: z.string().trim().min(3, "Título muito curto").max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  price: money,
  originalPrice: money,
  coupon: z.string().trim().max(60).nullable().optional(),
  imageUrl: z.union([httpUrl, z.literal("")]).nullable().optional(),
  affiliateUrl: httpUrl,
  productKey: z.string().trim().max(120).nullable().optional(), // ex.: "mercadolivre:MLB123"
  mode: z.enum(["publish", "review"]),
  sendWhatsapp: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  hours: z.coerce.number().int().min(1).max(720).optional(),
  force: z.boolean().optional(),
});

export async function POST(req: Request) {
  const u = await extUser(req);
  if (u instanceof NextResponse) return u;
  if (!u.pages.includes("offers")) return json(req, { erro: "Seu grupo não tem permissão para publicar ofertas." }, 403);

  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) {
    const i = p.error.issues[0];
    return json(req, { erro: `${i.path.join(".") || "dados"}: ${i.message}` }, 400);
  }
  const d = p.data;
  const [plat] = await db.select({ id: platforms.id }).from(platforms).where(eq(platforms.id, d.platformId)).limit(1);
  if (!plat) return json(req, { erro: "Loja não encontrada" }, 400);
  if (d.categoryId) {
    const [c] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, d.categoryId)).limit(1);
    if (!c) return json(req, { erro: "Categoria não encontrada" }, 400);
  }

  if (d.productKey && !d.force) {
    const [dup] = await db
      .select({ title: offers.title, createdAt: offers.createdAt, reviewStatus: offers.reviewStatus })
      .from(offers)
      .where(and(eq(offers.externalId, d.productKey), gt(offers.createdAt, sql`now() - interval '7 days'`)))
      .orderBy(desc(offers.createdAt))
      .limit(1);
    if (dup)
      return json(req, {
        duplicada: true,
        erro: `Este produto já foi publicado em ${dup.createdAt.toLocaleString("pt-BR", { timeZone: "America/Bahia", dateStyle: "short", timeStyle: "short" })}${dup.reviewStatus === "pending" ? " (está em Aprovação)" : ""}.`,
      }, 409);
  }

  const review = d.mode === "review";
  let original = d.originalPrice;
  if (original && d.price && Number(original) <= Number(d.price)) original = null;
  const [row] = await db
    .insert(offers)
    .values({
      platformId: d.platformId,
      categoryId: d.categoryId ?? null,
      title: d.title,
      description: d.description || null,
      price: d.price,
      originalPrice: original,
      coupon: d.coupon ? d.coupon.toUpperCase() : null,
      imagePath: d.imageUrl || null,
      affiliateUrl: d.affiliateUrl,
      slug: await uniqueOfferSlug(d.title.slice(0, 80)),
      isActive: !review,
      isFeatured: Boolean(d.isFeatured),
      reviewStatus: review ? "pending" : null,
      expiresAt: new Date(Date.now() + (d.hours ?? DEFAULT_HOURS) * 3_600_000),
      externalId: d.productKey || null,
      source: "manual",
      createdBy: u.id,
    })
    .returning({ id: offers.id, slug: offers.slug });

  const grupos = !review && d.sendWhatsapp ? await enqueueWhatsapp(row.id) : 0;
  revalidatePath("/");
  revalidatePath("/admin/offers");
  revalidatePath("/admin/aprovacao");
  const base = (process.env.PUBLIC_URL ?? "").replace(/\/$/, "");
  return json(req, {
    ok: true,
    status: review ? "aprovacao" : "publicada",
    linkCurto: `${base}/${row.slug}`,
    painel: `${base}${review ? "/admin/aprovacao" : `/admin/offers/${row.id}`}`,
    whatsappGrupos: grupos,
  });
}
