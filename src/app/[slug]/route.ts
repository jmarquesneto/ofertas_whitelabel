/**
 * CONTROLLER — Redirecionamento + registro de clique
 *
 *   GET /fone-bluetooth-jbl  →  registra o clique  →  302 para o link de afiliado
 *
 * - 302 (e não 301) de propósito: 301 é cacheado pelo navegador para sempre,
 *   então cliques repetidos não seriam contados e trocar o link bruto não teria efeito.
 * - Bots/crawlers e prefetch são redirecionados, mas não contam.
 * - A gravação do clique roda em paralelo; o redirecionamento não espera o banco.
 */
import { NextResponse, after, type NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { clicks, offers } from "@/db/schema";
import { hashIp } from "@/lib/crypto";
import { ipFromHeaders } from "@/lib/request";

export const dynamic = "force-dynamic";

const BOT_RE =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegrambot|preview|curl|wget|python-requests|headless|lighthouse/i;

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Location relativo: não depende do host interno do container
  const home = () => new NextResponse(null, { status: 302, headers: { Location: "/", "Cache-Control": "no-store" } });

  const [offer] = await db
    .select({ id: offers.id, url: offers.affiliateUrl, isActive: offers.isActive, expiresAt: offers.expiresAt })
    .from(offers)
    .where(eq(offers.slug, slug.toLowerCase()))
    .limit(1);

  if (!offer || !offer.isActive) return home();

  // Oferta expirada: some da home, mas o link compartilhado (WhatsApp/Telegram)
  // continua levando à loja — a comissão não se perde. Para bloquear, troque por
  // um redirect para "/?expirada=1".
  // if (offer.expiresAt <= new Date()) ...

  const ua = req.headers.get("user-agent") ?? "";
  const isPrefetch =
    req.headers.get("purpose") === "prefetch" || req.headers.get("sec-purpose")?.includes("prefetch");

  if (!BOT_RE.test(ua) && !isPrefetch) {
    const ip = ipFromHeaders(req.headers);
    const referer = req.headers.get("referer")?.slice(0, 500) ?? null;
    after(async () => {
      try {
        await db.transaction(async (tx) => {
          await tx.insert(clicks).values({ offerId: offer.id, ipHash: hashIp(ip), userAgent: ua.slice(0, 400), referer });
          await tx.update(offers).set({ clicksCount: sql`${offers.clicksCount} + 1` }).where(eq(offers.id, offer.id));
        });
      } catch (err) {
        console.error("[click] falha ao registrar", err);
      }
    });
  }

  const res = NextResponse.redirect(offer.url, 302);
  res.headers.set("Cache-Control", "no-store, max-age=0");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}
