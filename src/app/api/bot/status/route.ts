/** POST /api/bot/status — o coletor avisa como foi o ciclo e como está cada loja */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { botSettings, type BotStatus } from "@/db/schema";
import { getBotSettings } from "@/lib/bot";
import { botAuthorized } from "@/server/bot-intake";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!botAuthorized(req)) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as BotStatus;
  const s = await getBotSettings();
  const status: BotStatus = {
    ...s.status,
    ...body,
    sources: { ...s.status.sources, ...body.sources },
    seenAt: new Date().toISOString(),
  };
  await db.update(botSettings).set({ status }).where(eq(botSettings.id, 1));
  return NextResponse.json({ ok: true });
}
