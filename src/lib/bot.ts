import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { botSettings, whatsappSettings, type BotSources } from "@/db/schema";

export const DEFAULT_SOURCES: BotSources = {
  mercadolivre: { enabled: false, etiqueta: "", paginas: 1 },
  amazon: { enabled: false, tag: "", credentialId: "", credentialSecretEnc: null, paginas: 1, requisicoesPorCiclo: 4, buscas: [] },
  shopee: { enabled: false, appId: "", appSecretEnc: null, limite: 40, buscas: [] },
};

/** Lojas do robô → slug da plataforma na vitrine */
export const SOURCE_PLATFORM: Record<keyof BotSources, { slug: string; name: string }> = {
  mercadolivre: { slug: "mercado-livre", name: "Mercado Livre" },
  amazon: { slug: "amazon", name: "Amazon" },
  shopee: { slug: "shopee", name: "Shopee" },
};

/** Mescla com os padrões (colunas jsonb antigas podem não ter campos novos) */
function withDefaults(s: Partial<BotSources> | null | undefined): BotSources {
  return {
    mercadolivre: { ...DEFAULT_SOURCES.mercadolivre, ...s?.mercadolivre },
    amazon: { ...DEFAULT_SOURCES.amazon, ...s?.amazon },
    shopee: { ...DEFAULT_SOURCES.shopee, ...s?.shopee },
  };
}

export async function getBotSettings() {
  let [row] = await db.select().from(botSettings).where(eq(botSettings.id, 1)).limit(1);
  if (!row) {
    [row] = await db.insert(botSettings).values({ id: 1, sources: DEFAULT_SOURCES }).onConflictDoNothing().returning();
    if (!row) [row] = await db.select().from(botSettings).where(eq(botSettings.id, 1)).limit(1);
  }
  return { ...row, sources: withDefaults(row.sources) };
}

export async function getWhatsappSettings() {
  let [row] = await db.select().from(whatsappSettings).where(eq(whatsappSettings.id, 1)).limit(1);
  if (!row) {
    [row] = await db.insert(whatsappSettings).values({ id: 1 }).onConflictDoNothing().returning();
    if (!row) [row] = await db.select().from(whatsappSettings).where(eq(whatsappSettings.id, 1)).limit(1);
  }
  return row;
}

/** O coletor está vivo se falou com a vitrine nos últimos 3 minutos */
export function collectorOnline(seenAt?: string) {
  return Boolean(seenAt && Date.now() - new Date(seenAt).getTime() < 3 * 60_000);
}

/** Endereço interno do coletor e chave compartilhada (compose) */
export const COLLECTOR_URL = () => (process.env.COLLECTOR_URL || "http://coletor:8000").replace(/\/$/, "");
export const BOT_TOKEN = () => process.env.BOT_TOKEN || "";

/** Chama o coletor (converter link, ciclo agora, login do ML) */
export async function callCollector<T = unknown>(path: string, body?: unknown, timeoutMs = 120_000): Promise<T> {
  if (!BOT_TOKEN()) throw new Error("BOT_TOKEN não configurado no compose");
  let r: Response;
  try {
    r = await fetch(COLLECTOR_URL() + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { authorization: `Bearer ${BOT_TOKEN()}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch {
    throw new Error("Não consegui falar com o coletor. Ele está rodando?");
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { erro?: string }).erro || `Coletor respondeu HTTP ${r.status}`);
  return data as T;
}
