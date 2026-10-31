"use server";
/** CONTROLLER — Meu perfil (qualquer usuário logado) */
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/db";
import { apiTokens, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { PRE_COOKIE, PRE_TTL_S, SESSION_COOKIE, SESSION_TTL_S, cookieOpts, signToken } from "@/lib/session";
import { redirect } from "next/navigation";
import { backupCodes } from "@/db/schema";
import { regenerateBackupCodes } from "@/server/backup-codes";
import type { ActionState } from "@/lib/utils";

/** Mantém a sessão atual viva depois de invalidar as outras (sessionVersion + 1) */
async function bumpAndKeepSession(userId: number) {
  const [u] = await db
    .update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, userId))
    .returning({ v: users.sessionVersion });
  (await cookies()).set(SESSION_COOKIE, await signToken({ sub: String(userId), v: u.v, stage: "full" }, SESSION_TTL_S), cookieOpts(SESSION_TTL_S));
}

async function checkPassword(userId: number, hash: string, pwd: string) {
  if (!rateLimit(`profile-pwd:${userId}`, 8, 10 * 60_000)) return "Muitas tentativas. Aguarde alguns minutos.";
  if (!pwd || !(await bcrypt.compare(pwd, hash))) return "Senha atual incorreta";
  return null;
}

const profileSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(190),
});

export async function updateProfileAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const p = profileSchema.safeParse({ name: form.get("name"), email: form.get("email") });
  if (!p.success) return { error: p.error.issues[0].message };
  const emailChanged = p.data.email !== me.email.toLowerCase();
  if (emailChanged) {
    const err = await checkPassword(me.id, me.passwordHash, String(form.get("currentPassword") ?? ""));
    if (err) return { error: err === "Senha atual incorreta" ? "Para trocar o e-mail, confirme sua senha atual" : err };
    const taken = await db.select({ id: users.id }).from(users).where(and(sql`lower(${users.email}) = ${p.data.email}`, ne(users.id, me.id))).limit(1);
    if (taken.length) return { error: "Este e-mail já está em uso" };
  }
  await db.update(users).set(p.data).where(eq(users.id, me.id));
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Dados atualizados" };
}

const pwdSchema = z
  .object({
    current: z.string(),
    password: z.string().min(10, "A nova senha precisa de pelo menos 10 caracteres").max(200),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "As senhas não conferem", path: ["confirm"] })
  .refine((d) => d.password !== d.current, { message: "A nova senha precisa ser diferente da atual", path: ["password"] });

export async function changePasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const p = pwdSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const err = await checkPassword(me.id, me.passwordHash, p.data.current);
  if (err) return { error: err };
  await db.update(users).set({ passwordHash: await bcrypt.hash(p.data.password, 12), mustChangePassword: false }).where(eq(users.id, me.id));
  await bumpAndKeepSession(me.id); // desconecta os outros aparelhos
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Senha alterada. Outros aparelhos conectados foram desconectados." };
}

/** Gera 10 códigos novos (os antigos deixam de valer). Retorna os códigos uma única vez. */
export async function generateBackupCodesAction(_: ActionState, form: FormData): Promise<ActionState & { codes?: string[] }> {
  const me = await requireUser();
  const err = await checkPassword(me.id, me.passwordHash, String(form.get("current") ?? ""));
  if (err) return { error: err === "Senha atual incorreta" ? "Confirme sua senha atual para gerar os códigos" : err };
  const codes = await regenerateBackupCodes(me.id);
  revalidatePath("/admin", "layout");
  return { ok: true, codes };
}

export async function logoutOthersAction(): Promise<ActionState> {
  const me = await requireUser();
  await bumpAndKeepSession(me.id);
  return { ok: true, message: "Todos os outros aparelhos foram desconectados." };
}

/** Celular novo: apaga o vínculo atual e leva direto para escanear um novo QR Code */
export async function reconfigure2faAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const err = await checkPassword(me.id, me.passwordHash, String(form.get("current") ?? ""));
  if (err) return { error: err === "Senha atual incorreta" ? "Confirme sua senha atual" : err };
  await db.transaction(async (tx) => {
    await tx.update(users).set({ totpEnabled: false, totpSecretEnc: null, sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, me.id));
    await tx.delete(backupCodes).where(eq(backupCodes.userId, me.id));
  });
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.set(PRE_COOKIE, await signToken({ sub: String(me.id), stage: "setup" }, PRE_TTL_S), cookieOpts(PRE_TTL_S));
  redirect("/admin/2fa");
}

/** Desconecta uma extensão do Chrome (apaga a chave daquele navegador) */
export async function revokeExtensionAction(id: number): Promise<ActionState> {
  const me = await requireUser();
  await db.delete(apiTokens).where(and(eq(apiTokens.id, id), eq(apiTokens.userId, me.id)));
  revalidatePath("/admin/perfil");
  return { ok: true };
}
