import "server-only";
/**
 * Entrada das ofertas do robô (coletor → vitrine).
 * - não repete o mesmo produto dentro do prazo configurado
 * - modo "review": entra pausada na esteira de aprovação
 * - modo "direct": publica e coloca na fila do WhatsApp
 */
import { timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNotNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { offers, platforms, type BotSources } from "@/db/schema";
import { BOT_TOKEN, getBotSettings, SOURCE_PLATFORM } from "@/lib/bot";
import { uniqueOfferSlug } from "@/lib/slug";
import { enqueueWhatsapp } from "./whatsapp";

const DEFAULT_HOURS = Number(process.env.OFFER_DEFAULT_HOURS ?? 72);

/** Confere o "Authorization: Bearer <BOT_TOKEN>" do coletor */
export function botAuthorized(req: Request) {
  const expected = BOT_TOKEN();
  if (!expected || expected.length < 16) return false;
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** IDs externos já usados dentro do prazo de não repetição (inclui descartados) */
export async function recentExternalIds(days: number) {
  const rows = await db
    .select({ id: offers.externalId })
    .from(offers)
    .where(and(isNotNull(offers.externalId), gt(offers.createdAt, sql`now() - make_interval(days => ${days})`)));
  return rows.map((r) => r.id!);
}

export const intakeSchema = z.object({
  plataforma: z.enum(["mercadolivre", "amazon", "shopee"]),
  id_produto: z.string().min(1).max(120),
  titulo: z.string().trim().min(3).max(400),
  url_afiliado: z.string().url().max(2000),
  preco: z.number().nonnegative().nullable().optional(),
  preco_original: z.number().nonnegative().nullable().optional(),
  imagem: z.string().url().max(500).nullable().optional(),
  extra: z.string().max(400).nullable().optional(),
});
export type IntakeOffer = z.infer<typeof intakeSchema>;

/** Plataforma da vitrine para a loja (cria se o admin tiver apagado) */
async function platformFor(src: keyof BotSources) {
  const { slug, name } = SOURCE_PLATFORM[src];
  const [p] = await db.select({ id: platforms.id }).from(platforms).where(eq(platforms.slug, slug)).limit(1);
  if (p) return p.id;
  const [created] = await db.insert(platforms).values({ name, slug, sortOrder: 99 }).onConflictDoNothing().returning({ id: platforms.id });
  if (created) return created.id;
  const [again] = await db.select({ id: platforms.id }).from(platforms).where(eq(platforms.slug, slug)).limit(1);
  return again.id;
}

const money = (v: number | null | undefined) => (v == null || !Number.isFinite(v) || v <= 0 ? null : v.toFixed(2));

/**
 * opts.manual: veio do "Importar por link" do painel → sempre vai para a
 * aprovação (é a prévia) e ignora a regra de não repetir.
 */
export async function intakeOffer(o: IntakeOffer, opts: { manual?: boolean; userId?: number } = {}) {
  const s = await getBotSettings();
  const externalId = `${o.plataforma}:${o.id_produto}`;

  const dup = opts.manual ? [] : await db
    .select({ id: offers.id })
    .from(offers)
    .where(and(eq(offers.externalId, externalId), gt(offers.createdAt, sql`now() - make_interval(days => ${s.noRepeatDays})`)))
    .limit(1);
  if (dup.length) return { status: "duplicate" as const, id: dup[0].id };

  const direct = !opts.manual && s.mode === "direct";
  const price = money(o.preco);
  let original = money(o.preco_original);
  if (original && price && Number(original) <= Number(price)) original = null;

  const [row] = await db
    .insert(offers)
    .values({
      platformId: await platformFor(o.plataforma),
      title: o.titulo.slice(0, 200),
      description: o.extra || null,
      price,
      originalPrice: original,
      affiliateUrl: o.url_afiliado,
      imagePath: o.imagem || null,
      slug: await uniqueOfferSlug(o.titulo.slice(0, 80)),
      isActive: direct,
      reviewStatus: direct ? null : "pending",
      expiresAt: new Date(Date.now() + DEFAULT_HOURS * 3_600_000),
      source: opts.manual ? "manual" : "bot",
      externalId,
      createdBy: opts.userId ?? null,
    })
    .returning({ id: offers.id });

  let whatsapp = false;
  if (direct) {
    whatsapp = await enqueueWhatsapp(row.id);
    revalidatePath("/");
  }
  return { status: direct ? ("published" as const) : ("pending" as const), id: row.id, whatsapp };
}
