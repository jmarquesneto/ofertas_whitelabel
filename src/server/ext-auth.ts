import "server-only";
/**
 * Autenticação da extensão do Chrome.
 *  1. POST /api/ext/login  (e-mail + senha)      → ticket de 10 min
 *  2. POST /api/ext/totp   (ticket + código 2FA)  → chave do navegador (guardada só como hash)
 *  3. Demais rotas: "Authorization: Bearer <chave>"
 * A chave cai junto com bloqueio, reset de senha e "Sair dos outros dispositivos"
 * (comparação com users.session_version).
 */
import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { apiTokens, users } from "@/db/schema";
import { allowedPages } from "@/lib/auth";

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const newToken = () => "vte_" + randomBytes(32).toString("base64url");

const secret = () => new TextEncoder().encode(process.env.APP_SECRET ?? "");

export async function signTicket(userId: number) {
  return new SignJWT({ sub: String(userId), stage: "ext" })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(secret());
}
export async function readTicket(ticket: string) {
  try {
    const { payload } = await jwtVerify(ticket, secret(), { algorithms: ["HS256"] });
    return payload.stage === "ext" ? Number(payload.sub) : null;
  } catch {
    return null;
  }
}

/** CORS só para a extensão (origem chrome-extension://) */
export function cors(req: Request, res: NextResponse) {
  const origin = req.headers.get("origin") ?? "";
  if (origin.startsWith("chrome-extension://")) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Headers", "authorization, content-type");
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.headers.set("Vary", "Origin");
  }
  res.headers.set("Cache-Control", "no-store");
  return res;
}
export const json = (req: Request, body: unknown, status = 200) => cors(req, NextResponse.json(body, { status }));
export const preflight = (req: Request) => cors(req, new NextResponse(null, { status: 204 }));

export type ExtUser = typeof users.$inferSelect & { tokenId: number; pages: Awaited<ReturnType<typeof allowedPages>> };

/** Usuário dono da chave, ou uma resposta de erro pronta */
export async function extUser(req: Request): Promise<ExtUser | NextResponse> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token.startsWith("vte_")) return json(req, { erro: "Entre na extensão com seu usuário", sair: true }, 401);
  const [row] = await db
    .select({ t: apiTokens, u: users })
    .from(apiTokens)
    .innerJoin(users, eq(users.id, apiTokens.userId))
    .where(eq(apiTokens.tokenHash, hashToken(token)))
    .limit(1);
  if (!row) return json(req, { erro: "Esta extensão foi desconectada. Entre de novo.", sair: true }, 401);
  const { t, u } = row;
  if (u.isBlocked || !u.totpEnabled || u.sessionVersion !== t.sessionVersion) {
    await db.delete(apiTokens).where(eq(apiTokens.id, t.id));
    return json(req, { erro: u.isBlocked ? "Sua conta está bloqueada." : "Sua sessão foi encerrada. Entre de novo.", sair: true }, 401);
  }
  if (u.mustChangePassword) return json(req, { erro: "Troque sua senha no painel antes de usar a extensão." }, 403);
  if (!t.lastUsedAt || Date.now() - t.lastUsedAt.getTime() > 5 * 60_000)
    await db.update(apiTokens).set({ lastUsedAt: sql`now()` }).where(and(eq(apiTokens.id, t.id)));
  return { ...u, tokenId: t.id, pages: await allowedPages(u.role) };
}
