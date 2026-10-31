/** POST /api/ext/logout — a extensão apaga a própria chave */
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { apiTokens } from "@/db/schema";
import { extUser, json, preflight } from "@/server/ext-auth";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function POST(req: Request) {
  const u = await extUser(req);
  if (u instanceof NextResponse) return json(req, { ok: true });
  await db.delete(apiTokens).where(eq(apiTokens.id, u.tokenId));
  return json(req, { ok: true });
}
