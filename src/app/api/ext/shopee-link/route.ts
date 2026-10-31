/** POST /api/ext/shopee-link — link curto de afiliado da Shopee pela Open API (credenciais do menu Robô) */
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getBotSettings } from "@/lib/bot";
import { decrypt } from "@/lib/crypto";
import { extUser, json, preflight } from "@/server/ext-auth";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function POST(req: Request) {
  const u = await extUser(req);
  if (u instanceof NextResponse) return u;
  const { url } = await req.json().catch(() => ({}));
  if (typeof url !== "string" || !/shopee\.com\.br|shp\.ee|s\.shopee\./i.test(url)) return json(req, { erro: "Link da Shopee inválido" }, 400);
  const sp = (await getBotSettings()).sources.shopee;
  if (!sp.appId || !sp.appSecretEnc) return json(req, { erro: "Configure App ID e Secret da Shopee em Robô › Shopee, ou cole o link de afiliado." }, 400);

  const query = `mutation{generateShortLink(input:{originUrl:${JSON.stringify(url.split("?")[0])},subIds:["extensao"]}){shortLink}}`;
  const payload = JSON.stringify({ query });
  const ts = String(Math.floor(Date.now() / 1000));
  const signature = createHash("sha256").update(sp.appId + ts + payload + decrypt(sp.appSecretEnc)).digest("hex");
  try {
    const r = await fetch("https://open-api.affiliate.shopee.com.br/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `SHA256 Credential=${sp.appId}, Timestamp=${ts}, Signature=${signature}` },
      body: payload,
      signal: AbortSignal.timeout(20_000),
    });
    const data = await r.json();
    const link = data?.data?.generateShortLink?.shortLink;
    if (!link) return json(req, { erro: `Shopee: ${JSON.stringify(data?.errors ?? data).slice(0, 200)}` }, 502);
    return json(req, { link });
  } catch (e) {
    return json(req, { erro: `Shopee não respondeu: ${(e as Error).message}` }, 502);
  }
}
