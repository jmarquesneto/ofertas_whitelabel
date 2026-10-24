"use server";
/**
 * CONTROLLER — Esteira de aprovação
 * Ofertas do robô (modo "aprovação") e do "Importar por link" esperam aqui,
 * pausadas. Aprovar publica (renovando a validade) e manda ao WhatsApp.
 */
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { offers } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { callCollector } from "@/lib/bot";
import type { ActionState } from "@/lib/utils";
import { intakeOffer, intakeSchema } from "@/server/bot-intake";
import { enqueueWhatsapp } from "@/server/whatsapp";

const DEFAULT_HOURS = Number(process.env.OFFER_DEFAULT_HOURS ?? 72);

const refresh = () => {
  revalidatePath("/admin/aprovacao");
  revalidatePath("/admin", "layout");
  revalidatePath("/");
};

export async function approveAction(id: number, sendWhatsapp: boolean): Promise<ActionState> {
  await requirePage("approval");
  const [o] = await db
    .update(offers)
    .set({
      isActive: true,
      reviewStatus: null,
      expiresAt: new Date(Date.now() + DEFAULT_HOURS * 3_600_000),
      updatedAt: sql`now()`,
    })
    .where(and(eq(offers.id, id), eq(offers.reviewStatus, "pending")))
    .returning({ id: offers.id });
  if (!o) return { error: "Essa oferta já foi aprovada ou descartada" };
  const queued = sendWhatsapp ? await enqueueWhatsapp(id) : false;
  refresh();
  return { ok: true, message: queued ? "Publicada e na fila do WhatsApp." : "Publicada." };
}

export async function rejectAction(id: number): Promise<ActionState> {
  await requirePage("approval");
  // Fica guardada como "descartada" para o robô não trazer o mesmo produto de novo
  await db.update(offers).set({ reviewStatus: "rejected", isActive: false }).where(and(eq(offers.id, id), eq(offers.reviewStatus, "pending")));
  refresh();
  return { ok: true };
}

export async function rejectAllAction(): Promise<ActionState> {
  await requirePage("approval");
  await db.update(offers).set({ reviewStatus: "rejected", isActive: false }).where(eq(offers.reviewStatus, "pending"));
  refresh();
  return { ok: true };
}

const urlSchema = z.string().trim().url("Cole um link válido").refine(
  (u) => /mercadolivre\.com|mercadolibre\.com|meli\.la\/|amazon\.com|amzn\.to\/|amzn\.eu\/|shopee\.com\.br|s\.shopee\.|shp\.ee\//i.test(u),
  "Por enquanto: links do Mercado Livre, Amazon ou Shopee",
);

/** "Importar por link": o coletor lê o produto e gera o seu link de afiliado */
export async function importLinkAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requirePage("approval");
  const u = urlSchema.safeParse(form.get("url"));
  if (!u.success) return { error: u.error.issues[0].message };
  let data: unknown;
  try {
    data = await callCollector("/converter", { url: u.data }, 120_000);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const p = intakeSchema.safeParse(data);
  if (!p.success) return { error: "O coletor não conseguiu montar a oferta a partir desse link" };
  await intakeOffer(p.data, { manual: true, userId: user.id });
  refresh();
  return { ok: true, message: `“${p.data.titulo.slice(0, 60)}” pronta para revisar abaixo.` };
}
