/** POST /api/ext/totp — 2º passo: código do Authenticator (ou de recuperação) → chave do navegador */
import { eq } from "drizzle-orm";
import { authenticator } from "otplib";
import { db } from "@/db";
import { apiTokens, users } from "@/db/schema";
import { decrypt } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";
import { roleLabel } from "@/lib/permissions";
import { consumeBackupCode, looksLikeBackupCode } from "@/server/backup-codes";
import { hashToken, json, newToken, preflight, readTicket } from "@/server/ext-auth";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
authenticator.options = { window: 1 };

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const userId = await readTicket(String(body.ticket ?? ""));
  if (!userId) return json(req, { erro: "O login expirou. Digite e-mail e senha de novo.", reiniciar: true }, 401);
  if (!rateLimit(`totp:${userId}`, 6, 5 * 60_000)) return json(req, { erro: "Muitas tentativas. Aguarde 5 minutos." }, 429);

  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u?.totpSecretEnc || u.isBlocked || !u.totpEnabled) return json(req, { erro: "Conta indisponível", reiniciar: true }, 403);

  const input = String(body.code ?? "").trim();
  if (looksLikeBackupCode(input)) {
    if (!(await consumeBackupCode(u.id, input))) return json(req, { erro: "Código de recuperação inválido ou já usado" }, 401);
  } else {
    const code = input.replace(/\D/g, "");
    if (code.length !== 6) return json(req, { erro: "Digite os 6 dígitos do aplicativo" }, 400);
    if (!authenticator.verify({ token: code, secret: decrypt(u.totpSecretEnc) })) return json(req, { erro: "Código inválido ou expirado" }, 401);
  }

  const token = newToken();
  const device = String(body.device ?? "Chrome").slice(0, 100);
  await db.insert(apiTokens).values({ userId: u.id, tokenHash: hashToken(token), name: `Extensão · ${device}`, sessionVersion: u.sessionVersion });
  return json(req, { token, usuario: { nome: u.name, grupo: roleLabel(u.role) } });
}
