"use server";
/** CONTROLLER — Integração com o WhatsApp (Evolution API) */
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { whatsappSettings } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { getWhatsappSettings } from "@/lib/bot";
import { encrypt } from "@/lib/crypto";
import type { ActionState } from "@/lib/utils";
import { connectionState, enqueueWhatsapp, fetchGroups, sendTest } from "@/server/whatsapp";

const schema = z.object({
  enabled: z.boolean(),
  baseUrl: z.string().trim().url("Endereço do Evolution inválido (ex.: http://evolution-api:8080)").max(300),
  instance: z.string().trim().max(80),
  groupJid: z.string().trim().max(80).refine((v) => !v || /@g\.us$/.test(v), "O ID do grupo termina em @g.us"),
  minGapSeconds: z.coerce.number().int().min(10, "Intervalo mínimo: 10 segundos").max(3600),
  sendImage: z.boolean(),
});

export async function saveWhatsappAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requirePage("whatsapp");
  const p = schema.safeParse({
    enabled: form.get("enabled") === "on",
    baseUrl: form.get("baseUrl"),
    instance: form.get("instance"),
    groupJid: form.get("groupJid"),
    minGapSeconds: form.get("minGapSeconds"),
    sendImage: form.get("sendImage") === "on",
  });
  if (!p.success) return { error: p.error.issues[0].message };
  const cur = await getWhatsappSettings();
  const key = String(form.get("apiKey") ?? "").trim();
  const apiKeyEnc = key ? encrypt(key) : cur.apiKeyEnc;
  if (p.data.enabled && !(apiKeyEnc && p.data.instance && p.data.groupJid))
    return { error: "Para ligar, preencha a chave da API, a instância e o grupo" };
  await db
    .update(whatsappSettings)
    .set({ ...p.data, baseUrl: p.data.baseUrl.replace(/\/$/, ""), apiKeyEnc, updatedAt: sql`now()` })
    .where(eq(whatsappSettings.id, 1));
  revalidatePath("/admin/whatsapp");
  return { ok: true, message: "Configurações do WhatsApp salvas." };
}

const notReady = (c: Awaited<ReturnType<typeof getWhatsappSettings>>) =>
  !c.apiKeyEnc || !c.instance ? "Salve primeiro o endereço, a chave e a instância" : null;

export async function testWhatsappAction(): Promise<ActionState> {
  await requirePage("whatsapp");
  const cfg = await getWhatsappSettings();
  const err = notReady(cfg) ?? (!cfg.groupJid ? "Escolha o grupo e salve" : null);
  if (err) return { error: err };
  try {
    await sendTest(cfg);
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
  const ok = await enqueueWhatsapp(offerId);
  revalidatePath("/admin/offers");
  revalidatePath("/admin/whatsapp");
  return ok ? { ok: true, message: "Na fila do WhatsApp." } : { error: "O WhatsApp não está ligado/configurado" };
}
