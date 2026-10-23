import "server-only";
// Funções internas (NÃO são Server Actions: não ficam expostas ao navegador)
import { count, eq } from "drizzle-orm";
import { authenticator } from "otplib";
import { db } from "@/db";
import { users } from "@/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";

export async function registrationOpen(): Promise<boolean> {
  if (process.env.ALLOW_REGISTRATION === "true") return true;
  const [{ n }] = await db.select({ n: count() }).from(users);
  return n === 0; // só o primeiro administrador pode se cadastrar sozinho
}

/** Estágio "setup" do 2FA: cria (uma vez) o segredo e devolve a URI otpauth:// para o QR */
export async function getOrCreateTotpSetup(userId: number) {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u || u.totpEnabled) return null; // nunca recria o segredo de quem já ativou o 2FA
  let secret = u.totpSecretEnc ? decrypt(u.totpSecretEnc) : null;
  if (!secret) {
    secret = authenticator.generateSecret(20);
    await db.update(users).set({ totpSecretEnc: encrypt(secret) }).where(eq(users.id, u.id));
  }
  const issuer = process.env.TOTP_ISSUER || "Vitrine Admin";
  return { secret, uri: authenticator.keyuri(u.email, issuer, secret), email: u.email };
}
