"use server";
/**
 * CONTROLLER — Autenticação (cadastro, login, 2FA TOTP, logout)
 *
 * Fluxo:
 *   cadastro ─┐
 *   login ────┴─► cookie PRE (stage=setup|totp) ─► /admin/2fa ─► código válido ─► cookie SESSION
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { count, eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { decrypt } from "@/lib/crypto";
import { registrationOpen } from "@/server/auth-helpers";
import { consumeBackupCode, looksLikeBackupCode } from "@/server/backup-codes";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import {
  PRE_COOKIE, PRE_TTL_S, SESSION_COOKIE, SESSION_TTL_S, cookieOpts, signToken, verifyToken, type PreClaims,
} from "@/lib/session";
import type { ActionState } from "@/lib/utils";

authenticator.options = { window: 1 }; // tolera ±30s de diferença de relógio

// Hash usado quando o e-mail não existe: mantém o tempo de resposta igual
let DUMMY_HASH: string | undefined;
const dummyHash = () => (DUMMY_HASH ??= bcrypt.hashSync("senha-inexistente", 12));

const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Informe seu nome").max(120),
    email: z.string().trim().toLowerCase().email("E-mail inválido").max(190),
    password: z.string().min(10, "A senha precisa de pelo menos 10 caracteres").max(200),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "As senhas não conferem", path: ["confirm"] });

export async function registerAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await registrationOpen())) return { error: "Cadastro desativado. Peça acesso a um administrador." };

  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password } = parsed.data;

  const exists = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
  if (exists.length) return { error: "Já existe uma conta com este e-mail" };

  // O primeiro usuário do sistema é administrador; cadastros abertos depois entram como postador
  const [{ n }] = await db.select({ n: count() }).from(users);
  const [u] = await db
    .insert(users)
    .values({ name, email, passwordHash: await bcrypt.hash(password, 12), role: n === 0 ? "admin" : "poster" })
    .returning({ id: users.id });

  const jar = await cookies();
  jar.set(PRE_COOKIE, await signToken({ sub: String(u.id), stage: "setup" }, PRE_TTL_S), cookieOpts(PRE_TTL_S));
  redirect("/admin/2fa");
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

export async function loginAction(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password } = parsed.data;

  const ip = await clientIp();
  if (!rateLimit(`login:${ip}`) || !rateLimit(`login:${email}`))
    return { error: "Muitas tentativas. Aguarde alguns minutos." };

  const [u] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
  const ok = await bcrypt.compare(password, u?.passwordHash ?? dummyHash());
  if (!u || !ok) return { error: "E-mail ou senha incorretos" };
  if (u.isBlocked) return { error: "Esta conta está bloqueada. Fale com um administrador." };

  const stage = u.totpEnabled ? "totp" : "setup"; // sem 2FA configurado = obrigado a configurar
  const jar = await cookies();
  jar.set(PRE_COOKIE, await signToken({ sub: String(u.id), stage }, PRE_TTL_S), cookieOpts(PRE_TTL_S));
  redirect("/admin/2fa");
}

export async function verifyTotpAction(_: ActionState, form: FormData): Promise<ActionState> {
  const jar = await cookies();
  const pre = await verifyToken<PreClaims>(jar.get(PRE_COOKIE)?.value);
  if (!pre) redirect("/admin/login");

  const input = String(form.get("code") ?? "").trim();
  if (!rateLimit(`totp:${pre.sub}`, 6, 5 * 60_000)) return { error: "Muitas tentativas. Aguarde 5 minutos." };

  const [u] = await db.select().from(users).where(eq(users.id, Number(pre.sub))).limit(1);
  if (!u?.totpSecretEnc || u.isBlocked) redirect("/admin/login");

  let usedBackup = false;
  if (pre.stage === "totp" && looksLikeBackupCode(input)) {
    // Celular perdido: código de recuperação (vale uma única vez)
    if (!(await consumeBackupCode(u.id, input))) return { error: "Código de recuperação inválido ou já usado" };
    usedBackup = true;
  } else {
    const code = input.replace(/\D/g, "");
    if (code.length !== 6) return { error: "Digite os 6 dígitos do aplicativo" };
    if (!authenticator.verify({ token: code, secret: decrypt(u.totpSecretEnc) }))
      return { error: "Código inválido ou expirado" };
  }

  await db
    .update(users)
    .set({ totpEnabled: true, lastLoginAt: new Date() })
    .where(eq(users.id, u.id));

  jar.delete(PRE_COOKIE);
  jar.set(
    SESSION_COOKIE,
    await signToken({ sub: String(u.id), v: u.sessionVersion, stage: "full" }, SESSION_TTL_S),
    cookieOpts(SESSION_TTL_S),
  );
  if (u.mustChangePassword) redirect("/admin/perfil?trocar-senha=1");
  if (pre.stage === "setup") redirect("/admin/perfil?2fa-ativado=1#recuperacao");
  if (usedBackup) redirect("/admin/perfil?usou-codigo=1#recuperacao");
  redirect("/admin");
}

export async function logoutAction() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(PRE_COOKIE);
  redirect("/admin/login");
}
