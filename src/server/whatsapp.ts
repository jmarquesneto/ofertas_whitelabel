import "server-only";
/**
 * Envio de ofertas ao grupo do WhatsApp pela Evolution API.
 *
 * Nada é enviado na hora: cada oferta entra na fila (whatsapp_sends) e um
 * worker dentro do servidor despacha uma por vez, respeitando o intervalo
 * mínimo entre mensagens (reduz o risco de o número ser bloqueado).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { coupons, offers, platforms, whatsappGroups, whatsappSends } from "@/db/schema";
import { getWhatsappSettings } from "@/lib/bot";
import { decrypt } from "@/lib/crypto";
import { UPLOAD_DIR } from "@/lib/uploads";

type WaConfig = Awaited<ReturnType<typeof getWhatsappSettings>>;

const MAX_ATTEMPTS = 3;
const brl = (v: string | null) =>
  v == null ? null : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Texto da mensagem (formatação do WhatsApp: *negrito*, ~riscado~) */
export function buildMessage(o: {
  title: string; price: string | null; originalPrice: string | null; coupon: string | null;
  description: string | null; slug: string; platformName: string;
}) {
  const base = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
  const lines = [`🔥 *${o.title.slice(0, 180)}*`, ""];
  const p = o.price ? Number(o.price) : null;
  const op = o.originalPrice ? Number(o.originalPrice) : null;
  if (p && op && op > p) {
    lines.push(`De ~${brl(o.originalPrice)}~`);
    lines.push(`Por *${brl(o.price)}* 🔻 -${Math.round(100 * (1 - p / op))}%`);
  } else if (p) {
    lines.push(`*${brl(o.price)}*`);
  }
  if (o.coupon) lines.push(`🎟️ Cupom: *${o.coupon}*`);
  if (o.description) lines.push(o.description.slice(0, 200));
  lines.push("", `🛒 ${o.platformName}`, `👉 ${base}/${o.slug}`);
  return lines.join("\n");
}

const dataBR = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: process.env.TZ || "America/Bahia", day: "2-digit", month: "2-digit" });

/** Linha de um cupom: "• *FRETE10*: frete grátis (mín. R$ 49,00 · até 31/12)" */
export function couponLine(c: { code: string; description: string | null; minValue: string | null; expiresAt: Date | null }) {
  const extra = [c.minValue ? `mín. ${brl(c.minValue)}` : null, c.expiresAt ? `até ${dataBR(c.expiresAt)}` : null].filter(Boolean);
  return `• *${c.code}*${c.description ? `: ${c.description}` : ""}${extra.length ? ` (${extra.join(" · ")})` : ""}`;
}

/** Mensagem padrão de cupons: uma por loja, com todos os cupons dela */
export function buildCouponMessage(
  platform: { name: string; slug: string; couponUrl: string | null },
  list: { code: string; description: string | null; minValue: string | null; expiresAt: Date | null }[],
) {
  const base = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
  const link = platform.couponUrl ? `${base}/c/${platform.slug}` : `${base}/cupons`;
  return [
    `🎟️ *Cupons ${platform.name}*`,
    "",
    // linha em branco entre um cupom e outro: fica legível no celular
    list.map(couponLine).join("\n\n"),
    "",
    "👉 Teste o cupom através deste link:",
    link,
  ].join("\n");
}

/** Pronto para enviar: ligado, com chave e instância (os grupos são escolhidos por tipo) */
export function waReady(cfg: WaConfig) {
  return Boolean(cfg.enabled && cfg.baseUrl && cfg.apiKeyEnc && cfg.instance);
}

export type GroupKind = "offers" | "coupons";
export async function groupsFor(kind: GroupKind) {
  return db
    .select()
    .from(whatsappGroups)
    .where(kind === "offers" ? eq(whatsappGroups.sendOffers, true) : eq(whatsappGroups.sendCoupons, true))
    .orderBy(asc(whatsappGroups.name));
}

async function evolution(cfg: WaConfig, route: string, body?: unknown) {
  const url = `${cfg.baseUrl.replace(/\/$/, "")}${route}`;
  let r: Response;
  try {
    r = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers: { apikey: decrypt(cfg.apiKeyEnc!), "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
    });
  } catch (e) {
    throw new Error(`Sem resposta do Evolution em ${cfg.baseUrl} (${(e as Error).message})`);
  }
  const text = await r.text();
  if (!r.ok) {
    let msg = text.slice(0, 300);
    try {
      const j = JSON.parse(text);
      const m = j?.response?.message ?? j?.message ?? j?.error;
      msg = Array.isArray(m) ? m.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join("; ") : String(m ?? msg);
    } catch {}
    throw new Error(`Evolution HTTP ${r.status}: ${msg}`);
  }
  try { return JSON.parse(text); } catch { return text; }
}

/** Imagem local (/uploads/…) vai em base64; externa vai como URL */
async function mediaFor(imagePath: string) {
  if (/^https?:\/\//i.test(imagePath)) return { media: imagePath, mimetype: undefined };
  const abs = path.resolve(UPLOAD_DIR, imagePath.replace(/^\/uploads\//, ""));
  if (!abs.startsWith(UPLOAD_DIR + path.sep)) throw new Error("Caminho de imagem inválido");
  const buf = await readFile(abs);
  const ext = path.extname(abs).slice(1).toLowerCase();
  const mimetype = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";
  return { media: buf.toString("base64"), mimetype };
}

/** Foto + legenda; se a foto falhar (link quebrado, formato…), vai só o texto com prévia do link */
async function sendWithImage(cfg: WaConfig, jid: string, imagePath: string | null, caption: string) {
  if (cfg.sendImage && imagePath) {
    try {
      const { media, mimetype } = await mediaFor(imagePath);
      await evolution(cfg, `/message/sendMedia/${encodeURIComponent(cfg.instance)}`, {
        number: jid, mediatype: "image", mimetype, media, caption,
      });
      return;
    } catch (e) {
      console.warn("[whatsapp] imagem falhou, enviando texto:", (e as Error).message);
    }
  }
  await evolution(cfg, `/message/sendText/${encodeURIComponent(cfg.instance)}`, { number: jid, text: caption, linkPreview: true });
}

async function sendOffer(cfg: WaConfig, offerId: number, jid: string) {
  const [o] = await db
    .select({
      title: offers.title, price: offers.price, originalPrice: offers.originalPrice, coupon: offers.coupon,
      description: offers.description, slug: offers.slug, imagePath: offers.imagePath,
      isActive: offers.isActive, expiresAt: offers.expiresAt, platformName: platforms.name,
    })
    .from(offers)
    .innerJoin(platforms, eq(platforms.id, offers.platformId))
    .where(eq(offers.id, offerId))
    .limit(1);
  if (!o) throw new Error("Oferta não existe mais");
  if (!o.isActive || o.expiresAt <= new Date()) throw new Error("A oferta não está no ar (pausada ou expirada)");
  await sendWithImage(cfg, jid, o.imagePath, buildMessage(o));
}

/** Cupons de uma loja numa mensagem; só os que ainda valem no momento do envio */
async function sendCoupons(cfg: WaConfig, platformId: number, ids: number[], jid: string) {
  const [p] = await db.select().from(platforms).where(eq(platforms.id, platformId)).limit(1);
  if (!p) throw new Error("A plataforma não existe mais");
  const list = await liveCoupons(platformId, ids);
  if (!list.length) throw new Error("Os cupons não estão mais valendo (vencidos ou desativados)");
  await sendWithImage(cfg, jid, p.couponBannerPath ?? p.logoPath, buildCouponMessage(p, list));
}

export async function liveCoupons(platformId: number, ids?: number[]) {
  return db
    .select()
    .from(coupons)
    .where(
      and(
        eq(coupons.platformId, platformId),
        eq(coupons.isActive, true),
        or(isNull(coupons.expiresAt), gt(coupons.expiresAt, sql`now()`)),
        ids?.length ? inArray(coupons.id, ids) : undefined,
      ),
    )
    .orderBy(asc(coupons.code));
}

/** Coloca a oferta na fila de cada grupo de Ofertas. Retorna em quantos grupos entrou. */
export async function enqueueWhatsapp(offerId: number) {
  const cfg = await getWhatsappSettings();
  if (!waReady(cfg)) return 0;
  const groups = await groupsFor("offers");
  let n = 0;
  for (const g of groups) {
    const pending = await db
      .select({ id: whatsappSends.id })
      .from(whatsappSends)
      .where(and(eq(whatsappSends.offerId, offerId), eq(whatsappSends.groupJid, g.jid), inArray(whatsappSends.status, ["queued", "sending"])))
      .limit(1);
    if (!pending.length) await db.insert(whatsappSends).values({ kind: "offer", offerId, groupJid: g.jid });
    n++;
  }
  return n;
}

/** Cupons de uma loja na fila de cada grupo de Cupons (uma mensagem por loja). */
export async function enqueueCoupons(platformId: number, couponIds?: number[]) {
  const cfg = await getWhatsappSettings();
  if (!waReady(cfg)) return 0;
  const ids = couponIds?.length ? couponIds : (await liveCoupons(platformId)).map((c) => c.id);
  if (!ids.length) return 0;
  const groups = await groupsFor("coupons");
  for (const g of groups) {
    await db.insert(whatsappSends).values({ kind: "coupons", platformId, couponIds: ids, groupJid: g.jid });
  }
  return groups.length;
}

/** Mensagem de teste para conferir instância e grupo */
export async function sendTest(cfg: WaConfig, jid: string) {
  await evolution(cfg, `/message/sendText/${encodeURIComponent(cfg.instance)}`, {
    number: jid, text: "✅ Teste da vitrine: a integração com o WhatsApp está funcionando.",
  });
}

/** Grupos em que o número está (para escolher no painel) */
export async function fetchGroups(cfg: WaConfig): Promise<{ id: string; subject: string; size?: number }[]> {
  const data = await evolution(cfg, `/group/fetchAllGroups/${encodeURIComponent(cfg.instance)}?getParticipants=false`);
  return (Array.isArray(data) ? data : [])
    .map((g: { id: string; subject?: string; size?: number }) => ({ id: g.id, subject: g.subject || g.id, size: g.size }))
    .sort((a, b) => a.subject.localeCompare(b.subject, "pt-BR"));
}

/** Estado da conexão da instância (open = conectado) */
export async function connectionState(cfg: WaConfig): Promise<string> {
  const d = await evolution(cfg, `/instance/connectionState/${encodeURIComponent(cfg.instance)}`);
  return d?.instance?.state ?? d?.state ?? "desconhecido";
}

/* ----------------------------- worker ----------------------------- */

async function tick() {
  const cfg = await getWhatsappSettings();
  if (!waReady(cfg)) return;

  const [last] = await db
    .select({ at: whatsappSends.sentAt })
    .from(whatsappSends)
    .where(isNotNull(whatsappSends.sentAt))
    .orderBy(desc(whatsappSends.sentAt))
    .limit(1);
  if (last?.at && Date.now() - last.at.getTime() < cfg.minGapSeconds * 1000) return;

  const [job] = await db
    .update(whatsappSends)
    .set({ status: "sending", attempts: sql`${whatsappSends.attempts} + 1` })
    .where(
      eq(
        whatsappSends.id,
        sql`(select id from whatsapp_sends where status = 'queued' order by created_at, id limit 1 for update skip locked)`,
      ),
    )
    .returning();
  if (!job) return;

  try {
    if (!job.groupJid) throw new Error("Envio sem grupo definido");
    if (job.kind === "coupons") await sendCoupons(cfg, job.platformId!, job.couponIds ?? [], job.groupJid);
    else await sendOffer(cfg, job.offerId!, job.groupJid);
    await db.update(whatsappSends).set({ status: "sent", error: null, sentAt: new Date() }).where(eq(whatsappSends.id, job.id));
  } catch (e) {
    const msg = (e as Error).message.slice(0, 500);
    const final = job.attempts >= MAX_ATTEMPTS || /não está no ar|não existe|não estão mais|sem grupo/.test(msg);
    await db
      .update(whatsappSends)
      // Falha também conta no intervalo, para não martelar o Evolution
      .set({ status: final ? "failed" : "queued", error: msg, sentAt: final ? new Date() : null })
      .where(eq(whatsappSends.id, job.id));
    console.warn(`[whatsapp] envio ${job.id} (${job.kind}): ${msg}`);
  }
}

const g = globalThis as unknown as { __waWorker?: NodeJS.Timeout };

export async function startWhatsappWorker() {
  if (g.__waWorker) return;
  // Envios que estavam "enviando" quando o container caiu voltam para a fila
  await db.update(whatsappSends).set({ status: "queued" }).where(eq(whatsappSends.status, "sending"));
  let busy = false;
  g.__waWorker = setInterval(async () => {
    if (busy) return;
    busy = true;
    try { await tick(); } catch (e) { console.warn("[whatsapp] worker:", (e as Error).message); }
    finally { busy = false; }
  }, 5_000);
  // Limpeza diária: ofertas descartadas pelo robô há mais de 30 dias
  setInterval(() => {
    db.delete(offers)
      .where(and(eq(offers.reviewStatus, "rejected"), lt(offers.createdAt, sql`now() - interval '30 days'`)))
      .catch(() => {});
  }, 24 * 3_600_000);
}
