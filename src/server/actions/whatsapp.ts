"use server";
/** CONTROLLER — Integração com o WhatsApp (Evolution API) */
import { revalidatePath } from "next/cache";
import { eq, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { whatsappGroups, whatsappSettings } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { getWhatsappSettings } from "@/lib/bot";
import { encrypt } from "@/lib/crypto";
import type { ActionState } from "@/lib/utils";
import { connectionState, enqueueCoupons, enqueueWhatsapp, fetchGroups, sendTest } from "@/server/whatsapp";

const schema = z.object({
  enabled: z.boolean(),
  baseUrl: z.string().trim().url("Endereço do Evolution inválido (ex.: http://evolution-api:8080)").max(300),
  instance: z.string().trim().max(80),
  minGapSeconds: z.coerce.number().int().min(10, "Intervalo mínimo: 10 segundos").max(3600),
  sendImage: z.boolean(),
});

const done = () => revalidatePath("/admin/whatsapp");

export async function saveWhatsappAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requirePage("whatsapp");
  const p = schema.safeParse({
    enabled: form.get("enabled") === "on",
    baseUrl: form.get("baseUrl"),
    instance: form.get("instance"),
    minGapSeconds: form.get("minGapSeconds"),
    sendImage: form.get("sendImage") === "on",
  });
  if (!p.success) return { error: p.error.issues[0].message };
  const cur = await getWhatsappSettings();
  const key = String(form.get("apiKey") ?? "").trim();
  const apiKeyEnc = key ? encrypt(key) : cur.apiKeyEnc;
  if (p.data.enabled && !(apiKeyEnc && p.data.instance)) return { error: "Para ligar, preencha a chave da API e a instância" };
  await db
    .update(whatsappSettings)
    .set({ ...p.data, baseUrl: p.data.baseUrl.replace(/\/$/, ""), apiKeyEnc, updatedAt: sql`now()` })
    .where(eq(whatsappSettings.id, 1));
  done();
  return { ok: true, message: "Configurações do WhatsApp salvas." };
}

const groupSchema = z.array(
  z.object({
    jid: z.string().regex(/@g\.us$/, "ID de grupo inválido"),
    name: z.string().trim().min(1).max(120),
    sendOffers: z.boolean(),
    sendCoupons: z.boolean(),
  }),
).max(50);

/**
 * Grupos que recebem mensagens. Só ficam salvos os marcados para Ofertas e/ou Cupons.
 * Recebe JSON (o formulário monta a lista com as caixinhas marcadas).
 */
export async function saveGroupsAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requirePage("whatsapp");
  let raw: unknown;
  try { raw = JSON.parse(String(form.get("groups") ?? "[]")); } catch { return { error: "Lista de grupos inválida" }; }
  const p = groupSchema.safeParse(raw);
  if (!p.success) return { error: p.error.issues[0].message };
  const keep = p.data.filter((g) => g.sendOffers || g.sendCoupons);
  await db.transaction(async (tx) => {
    if (keep.length) await tx.delete(whatsappGroups).where(notInArray(whatsappGroups.jid, keep.map((g) => g.jid)));
    else await tx.delete(whatsappGroups);
    for (const g of keep)
      await tx.insert(whatsappGroups).values(g)
        .onConflictDoUpdate({ target: whatsappGroups.jid, set: { name: g.name, sendOffers: g.sendOffers, sendCoupons: g.sendCoupons } });
  });
  done();
  const o = keep.filter((g) => g.sendOffers).length, c = keep.filter((g) => g.sendCoupons).length;
  return { ok: true, message: `Grupos salvos: ${o} recebe(m) ofertas e ${c} recebe(m) cupons.` };
}

const notReady = (c: Awaited<ReturnType<typeof getWhatsappSettings>>) =>
  !c.apiKeyEnc || !c.instance ? "Salve primeiro o endereço, a chave e a instância" : null;

export async function testWhatsappAction(jid: string): Promise<ActionState> {
  await requirePage("whatsapp");
  const cfg = await getWhatsappSettings();
  const err = notReady(cfg) ?? (!/@g\.us$/.test(jid) ? "Grupo inválido" : null);
  if (err) return { error: err };
  try {
    await sendTest(cfg, jid);
    return { ok: true, message: "Mensagem de teste enviada. Confira no grupo." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function checkConnectionAction(): Promise<ActionState & { groups?: { id: string; subject: string; size?: number }[] }> {
  await requirePage("whatsapp");
  const cfg = await getWhatsappSettings();
  const err = notReady(cfg);
  if (err) return { error: err };
  try {
    const state = await connectionState(cfg);
    if (state !== "open") return { error: `A instância “${cfg.instance}” não está conectada (estado: ${state}). Leia o QR code no /manager do Evolution.` };
    const groups = await fetchGroups(cfg);
    return { ok: true, message: `Conectado. ${groups.length} grupo(s) encontrado(s).`, groups };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function resendAction(offerId: number): Promise<ActionState> {
  await requirePage("offers");
  const n = await enqueueWhatsapp(offerId);
  revalidatePath("/admin/offers");
  done();
  return n ? { ok: true, message: `Na fila do WhatsApp (${n} grupo${n > 1 ? "s" : ""}).` } : { error: "O WhatsApp não está ligado ou não há grupo de Ofertas" };
}

export async function resendCouponsAction(platformId: number): Promise<ActionState> {
  await requirePage("coupons");
  const n = await enqueueCoupons(platformId);
  revalidatePath("/admin/cupons");
  done();
  return n ? { ok: true, message: `Cupons na fila do WhatsApp (${n} grupo${n > 1 ? "s" : ""}).` } : { error: "O WhatsApp não está ligado, não há grupo de Cupons ou a loja não tem cupons valendo" };
}
