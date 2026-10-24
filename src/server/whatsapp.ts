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
import { and, desc, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { offers, platforms, whatsappSends } from "@/db/schema";
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

export function waReady(cfg: WaConfig) {
  return Boolean(cfg.enabled && cfg.baseUrl && cfg.apiKeyEnc && cfg.instance && cfg.groupJid);
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

async function sendOffer(cfg: WaConfig, offerId: number) {
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

  const caption = buildMessage(o);
  if (cfg.sendImage && o.imagePath) {
    try {
      const { media, mimetype } = await mediaFor(o.imagePath);
      await evolution(cfg, `/message/sendMedia/${encodeURIComponent(cfg.instance)}`, {
        number: cfg.groupJid, mediatype: "image", mimetype, media, caption,
      });
      return;
    } catch (e) {
      // Imagem recusada (link quebrado, formato…): manda só o texto, com prévia do link
      console.warn("[whatsapp] imagem falhou, enviando texto:", (e as Error).message);
    }
  }
  await evolution(cfg, `/message/sendText/${encodeURIComponent(cfg.instance)}`, {
    number: cfg.groupJid, text: caption, linkPreview: true,
  });
}

/** Coloca a oferta na fila (se o WhatsApp estiver configurado). Retorna se entrou. */
export async function enqueueWhatsapp(offerId: number) {
  const cfg = await getWhatsappSettings();
  if (!waReady(cfg)) return false;
  const pending = await db
    .select({ id: whatsappSends.id })
    .from(whatsappSends)
    .where(and(eq(whatsappSends.offerId, offerId), inArray(whatsappSends.status, ["queued", "sending"])))
    .limit(1);
  if (pending.length) return true;
  await db.insert(whatsappSends).values({ offerId });
  return true;
}

/** Mensagem de teste para conferir instância e grupo */
export async function sendTest(cfg: WaConfig) {
  await evolution(cfg, `/message/sendText/${encodeURIComponent(cfg.instance)}`, {
    number: cfg.groupJid, text: "✅ Teste da vitrine: a integração com o WhatsApp está funcionando.",
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
    await sendOffer(cfg, job.offerId);
    await db.update(whatsappSends).set({ status: "sent", error: null, sentAt: new Date() }).where(eq(whatsappSends.id, job.id));
  } catch (e) {
    const msg = (e as Error).message.slice(0, 500);
    const final = job.attempts >= MAX_ATTEMPTS || /não está no ar|não existe/.test(msg);
    await db
      .update(whatsappSends)
      // Falha também conta no intervalo, para não martelar o Evolution
      .set({ status: final ? "failed" : "queued", error: msg, sentAt: final ? new Date() : null })
      .where(eq(whatsappSends.id, job.id));
    console.warn(`[whatsapp] oferta ${job.offerId}: ${msg}`);
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
