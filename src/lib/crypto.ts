import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key(): Buffer {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 32) throw new Error("APP_SECRET ausente ou curto (mín. 32 caracteres)");
  return createHash("sha256").update(secret).digest();
}

/** AES-256-GCM → "iv.tag.dados" em base64url */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, data] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}

/** Hash de IP com sal — permite contar visitantes únicos sem guardar o IP (LGPD) */
export function hashIp(ip: string): string {
  return createHash("sha256").update(`${process.env.APP_SECRET}:${ip}`).digest("hex");
}
