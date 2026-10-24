import "server-only";
import { createHmac, randomInt } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { backupCodes } from "@/db/schema";

// Sem caracteres ambíguos (0/O, 1/I/L)
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const BACKUP_COUNT = 10;

const normalize = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "");
const hash = (c: string) => createHmac("sha256", process.env.APP_SECRET ?? "").update(normalize(c)).digest("hex");

/** Parece um código de recuperação (XXXX-XXXX) e não um TOTP de 6 dígitos */
export const looksLikeBackupCode = (input: string) => normalize(input).length === 8 && /[A-Z]/.test(normalize(input));

/** Gera 10 códigos novos (invalida os anteriores). Retorna em texto puro — só é mostrado uma vez. */
export async function regenerateBackupCodes(userId: number): Promise<string[]> {
  const codes = Array.from({ length: BACKUP_COUNT }, () => {
    const raw = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
  await db.transaction(async (tx) => {
    await tx.delete(backupCodes).where(eq(backupCodes.userId, userId));
    await tx.insert(backupCodes).values(codes.map((c) => ({ userId, codeHash: hash(c) })));
  });
  return codes;
}

/** Usa um código: válido e ainda não usado → marca como usado e retorna true */
export async function consumeBackupCode(userId: number, input: string): Promise<boolean> {
  const [hit] = await db
    .update(backupCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(backupCodes.userId, userId), eq(backupCodes.codeHash, hash(input)), isNull(backupCodes.usedAt)))
    .returning({ id: backupCodes.id });
  return Boolean(hit);
}

export async function remainingBackupCodes(userId: number) {
  const rows = await db.select({ id: backupCodes.id }).from(backupCodes).where(and(eq(backupCodes.userId, userId), isNull(backupCodes.usedAt)));
  return rows.length;
}
