/**
 * CONTROLLER — Link da loja nos cupons
 *
 *   GET /c/shopee  →  registra o clique  →  302 para o link de afiliado da loja
 *
 * É o link do "Teste o cupom através deste link" das mensagens de cupons.
 * Sem link de afiliado cadastrado na plataforma, leva para /cupons do site.
 */
import { NextResponse, after, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { couponClicks, platforms } from "@/db/schema";
import { hashIp } from "@/lib/crypto";
import { ipFromHeaders } from "@/lib/request";

export const dynamic = "force-dynamic";

const BOT_RE =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegrambot|preview|curl|wget|python-requests|headless|lighthouse/i;

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [p] = await db
    .select({ id: platforms.id, url: platforms.couponUrl, isActive: platforms.isActive })
    .from(platforms)
    .where(eq(platforms.slug, slug.toLowerCase()))
    .limit(1);

  if (!p || !p.url) {
    return new NextResponse(null, { status: 302, headers: { Location: "/cupons", "Cache-Control": "no-store" } });
  }

  const ua = req.headers.get("user-agent") ?? "";
  const isPrefetch = req.headers.get("purpose") === "prefetch" || req.headers.get("sec-purpose")?.includes("prefetch");
  if (!BOT_RE.test(ua) && !isPrefetch) {
    const ip = ipFromHeaders(req.headers);
    after(async () => {
      try {
        await db.insert(couponClicks).values({ platformId: p.id, ipHash: hashIp(ip) });
      } catch (err) {
        console.error("[cupom] falha ao registrar clique", err);
      }
    });
  }

  const res = NextResponse.redirect(p.url, 302);
  res.headers.set("Cache-Control", "no-store, max-age=0");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}
