"use server";
/**
 * CONTROLLER — Robô de ofertas (coletor)
 * Tudo que o coletor usa vem daqui: modo, ciclo, filtros, lojas e nichos.
 * O coletor relê essas configurações a cada ciclo — não precisa reiniciar nada.
 */
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { botSettings, type BotSources } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { callCollector, getBotSettings } from "@/lib/bot";
import { encrypt } from "@/lib/crypto";
import { NICHE_KEYS } from "@/lib/niches";
import type { ActionState } from "@/lib/utils";

const done = () => revalidatePath("/admin/robo");
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const int = (min: number, max: number, label: string) =>
  z.coerce.number({ invalid_type_error: `${label} inválido` }).int(`${label} precisa ser inteiro`)
    .min(min, `${label}: mínimo ${min}`).max(max, `${label}: máximo ${max}`);

const money = z.string().optional().transform((v) => {
  const raw = (v ?? "").replace(/R\$|\s/g, "");
  if (!raw) return null;
  const n = Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);
  return Number.isFinite(n) && n > 0 ? n.toFixed(2) : null;
});

/** "capinha, película\nadesivo" → ["capinha","película","adesivo"] */
const words = (v: FormDataEntryValue | null) =>
  [...new Set(String(v ?? "").split(/[,\n;]/).map((w) => w.trim().toLowerCase()).filter(Boolean))].slice(0, 200);

const generalSchema = z
  .object({
    enabled: z.boolean(),
    mode: z.enum(["review", "direct"]),
    intervalMinutes: int(5, 1440, "Intervalo"),
    maxPerCycle: int(1, 20, "Ofertas por ciclo"),
    spacingSeconds: int(0, 3600, "Pausa entre ofertas"),
    noRepeatDays: int(1, 90, "Dias sem repetir"),
    allDay: z.boolean(),
    activeFrom: z.string(),
    activeTo: z.string(),
    minDiscount: int(0, 99, "Desconto mínimo"),
    maxDiscount: int(1, 100, "Desconto máximo"),
    minPrice: money,
    maxPrice: money,
  })
  .refine((d) => d.allDay || (HHMM.test(d.activeFrom) && HHMM.test(d.activeTo)), "Horário no formato HH:MM")
  .refine((d) => d.allDay || d.activeFrom !== d.activeTo, "O horário de início e fim não podem ser iguais")
  .refine((d) => d.maxDiscount > d.minDiscount, "O desconto máximo precisa ser maior que o mínimo")
  .refine((d) => !(d.minPrice && d.maxPrice) || Number(d.maxPrice) > Number(d.minPrice), "O preço máximo precisa ser maior que o mínimo");

export async function saveBotGeneralAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requirePage("bot");
  const p = generalSchema.safeParse({
    enabled: form.get("enabled") === "on",
    mode: form.get("mode"),
    intervalMinutes: form.get("intervalMinutes"),
    maxPerCycle: form.get("maxPerCycle"),
    spacingSeconds: form.get("spacingSeconds"),
    noRepeatDays: form.get("noRepeatDays"),
    allDay: form.get("allDay") === "on",
    activeFrom: String(form.get("activeFrom") ?? ""),
    activeTo: String(form.get("activeTo") ?? ""),
    minDiscount: form.get("minDiscount"),
    maxDiscount: form.get("maxDiscount"),
    minPrice: form.get("minPrice") ?? undefined,
    maxPrice: form.get("maxPrice") ?? undefined,
  });
  if (!p.success) return { error: p.error.issues[0].message };
  const { allDay, ...d } = p.data;
  await getBotSettings();
  await db
    .update(botSettings)
    .set({
      ...d,
      // "00:00-24:00" = o dia todo (o coletor entende 24:00 como fim do dia)
      activeFrom: allDay ? "00:00" : d.activeFrom,
      activeTo: allDay ? "24:00" : d.activeTo,
      blockedWords: words(form.get("blockedWords")),
      updatedAt: sql`now()`,
    })
    .where(eq(botSettings.id, 1));
  done();
  return { ok: true, message: "Configurações do robô salvas. Valem a partir do próximo ciclo." };
}

/** Liga/desliga uma loja direto pelo interruptor do card */
export async function toggleSourceAction(src: keyof BotSources, enabled: boolean): Promise<ActionState> {
  await requirePage("bot");
  const s = await getBotSettings();
  if (!(src in s.sources)) return { error: "Loja inválida" };
  const sources = { ...s.sources, [src]: { ...s.sources[src], enabled } };
  await db.update(botSettings).set({ sources, updatedAt: sql`now()` }).where(eq(botSettings.id, 1));
  done();
  return { ok: true };
}

const terms = (v: FormDataEntryValue | null) =>
  [...new Set(String(v ?? "").split(/[,\n;]/).map((w) => w.trim()).filter(Boolean))].slice(0, 50);

export async function saveSourceAction(src: keyof BotSources, _: ActionState, form: FormData): Promise<ActionState> {
  await requirePage("bot");
  const s = await getBotSettings();
  const sources: BotSources = structuredClone(s.sources);
  const txt = (k: string, max = 200) => String(form.get(k) ?? "").trim().slice(0, max);
  const num = (k: string, min: number, max: number, def: number) => {
    const n = Number(form.get(k));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def;
  };

  if (src === "mercadolivre") {
    sources.mercadolivre = { ...sources.mercadolivre, etiqueta: txt("etiqueta", 80), paginas: num("paginas", 1, 5, 1) };
  } else if (src === "amazon") {
    const secret = txt("credentialSecret", 300);
    sources.amazon = {
      ...sources.amazon,
      tag: txt("tag", 60),
      credentialId: txt("credentialId", 200),
      credentialSecretEnc: form.get("clearSecret") === "on" ? null : secret ? encrypt(secret) : sources.amazon.credentialSecretEnc,
      paginas: num("paginas", 1, 5, 1),
      requisicoesPorCiclo: num("requisicoesPorCiclo", 0, 30, 4),
      buscas: terms(form.get("buscas")),
    };
    if (sources.amazon.tag && !/^[\w-]{3,40}$/.test(sources.amazon.tag)) return { error: "Tag da Amazon inválida (ex.: seunome-20)" };
  } else if (src === "shopee") {
    const secret = txt("appSecret", 300);
    sources.shopee = {
      ...sources.shopee,
      appId: txt("appId", 60),
      appSecretEnc: form.get("clearSecret") === "on" ? null : secret ? encrypt(secret) : sources.shopee.appSecretEnc,
      limite: num("limite", 5, 100, 40),
      buscas: terms(form.get("buscas")),
    };
  } else return { error: "Loja inválida" };

  await db.update(botSettings).set({ sources, updatedAt: sql`now()` }).where(eq(botSettings.id, 1));
  done();
  return { ok: true, message: "Salvo." };
}

export async function saveNichesAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requirePage("bot");
  const niches = form.getAll("niche").map(String).filter((k) => NICHE_KEYS.includes(k));
  await getBotSettings();
  await db.update(botSettings).set({ niches, updatedAt: sql`now()` }).where(eq(botSettings.id, 1));
  done();
  return {
    ok: true,
    message: niches.length ? `${niches.length} nicho(s) selecionado(s).` : "Nenhum nicho marcado: o robô busca em todas as categorias.",
  };
}

/* ---------------- ações que conversam com o coletor ---------------- */

export async function runCycleAction(): Promise<ActionState> {
  await requirePage("bot");
  try {
    await callCollector("/ciclo", {}, 15_000);
    return { ok: true, message: "Ciclo iniciado. As ofertas aparecem em Aprovação (ou direto no site) em alguns minutos." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export type TestResult = { ofertas: { titulo: string; preco: number | null; preco_original: number | null; desconto: number | null }[]; total: number };

export async function testSourceAction(src: keyof BotSources): Promise<ActionState & { result?: TestResult }> {
  await requirePage("bot");
  try {
    const result = await callCollector<TestResult>("/testar", { fonte: src }, 180_000);
    return { ok: true, result };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function mlLoginAction(op: "iniciar" | "parar"): Promise<ActionState & { session?: boolean; vncPassword?: string }> {
  await requirePage("bot");
  try {
    const r = await callCollector<{ ok: boolean; sessao?: boolean; mensagem?: string; senha?: string }>(`/ml-login/${op}`, {}, 90_000);
    revalidatePath("/admin/robo");
    return { ok: true, message: r.mensagem, session: r.sessao, vncPassword: r.senha };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
