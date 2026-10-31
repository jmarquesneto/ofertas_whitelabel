/** GET /api/ext/me — tudo que o formulário da extensão precisa (lojas, categorias, afiliados, WhatsApp) */
import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { categories, platforms } from "@/db/schema";
import { getBotSettings, getWhatsappSettings } from "@/lib/bot";
import { roleLabel } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { extUser, json, preflight } from "@/server/ext-auth";
import { groupsFor, waReady } from "@/server/whatsapp";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function GET(req: Request) {
  const u = await extUser(req);
  if (u instanceof NextResponse) return u;
  const [site, plats, cats, bot, wa, offerGroups] = await Promise.all([
    getSettings(),
    db.select({ id: platforms.id, name: platforms.name, slug: platforms.slug }).from(platforms).orderBy(asc(platforms.sortOrder), asc(platforms.name)),
    db.select({ id: categories.id, name: categories.name, parentId: categories.parentId }).from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)),
    getBotSettings(),
    getWhatsappSettings(),
    groupsFor("offers"),
  ]);
  return json(req, {
    usuario: { nome: u.name, grupo: roleLabel(u.role) },
    site: { nome: site.siteName, url: (process.env.PUBLIC_URL ?? "").replace(/\/$/, "") },
    pode: { publicar: u.pages.includes("offers"), aprovar: u.pages.includes("approval") },
    lojas: plats,
    categorias: cats,
    afiliados: {
      mlEtiqueta: bot.sources.mercadolivre.etiqueta || null,
      amazonTag: bot.sources.amazon.tag || null,
      shopeeApi: Boolean(bot.sources.shopee.appId && bot.sources.shopee.appSecretEnc),
    },
    whatsapp: waReady(wa) && offerGroups.length > 0,
    validadeHoras: Number(process.env.OFFER_DEFAULT_HOURS ?? 72),
  });
}
