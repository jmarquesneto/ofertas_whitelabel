"use server";
/**
 * CONTROLLER — Usuários e permissões (só administradores)
 *
 * Regras de segurança:
 *  - ninguém bloqueia, rebaixa ou reseta o 2FA de si mesmo por aqui (use Meu perfil)
 *  - o sistema nunca fica sem pelo menos 1 administrador ativo
 *  - reset de senha, bloqueio e reset de 2FA derrubam todas as sessões da pessoa
 */
import { revalidatePath } from "next/cache";
import { and, count, eq, ne, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { db } from "@/db";
import { backupCodes, rolePermissions, users } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { ADMIN_ONLY, PAGES, ROLES, type PageKey } from "@/lib/permissions";
import type { ActionState } from "@/lib/utils";

const roleEnum = z.enum(["admin", "moderator", "poster"], { message: "Escolha um grupo" });
const password = z.string().min(10, "A senha precisa de pelo menos 10 caracteres").max(200);

const done = () => revalidatePath("/admin/users");

/** Outros administradores ativos além deste usuário */
async function otherActiveAdmins(exceptId: number) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.isBlocked, false), ne(users.id, exceptId)));
  return n;
}

async function target(id: number, me: number) {
  if (id === me) return { error: "Para alterar a sua própria conta, use Meu perfil." } as const;
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!u) return { error: "Usuário não encontrado" } as const;
  return { u } as const;
}

/** Senha temporária legível: 3 blocos de 4 (ex.: kt7m-p2qx-9wfa) */
function tempPassword() {
  const a = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 3 }, () => Array.from({ length: 4 }, () => a[randomInt(a.length)]).join("")).join("-");
}

const createSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(190),
  password,
  role: roleEnum,
});

export async function createUserAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requirePage("users");
  const p = createSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const exists = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${p.data.email}`).limit(1);
  if (exists.length) return { error: "Já existe um usuário com este e-mail" };
  await db.insert(users).values({
    name: p.data.name,
    email: p.data.email,
    role: p.data.role,
    passwordHash: await bcrypt.hash(p.data.password, 12),
    // Você definiu a senha, então a pessoa cria a dela no primeiro acesso (depois de ativar o 2FA)
    mustChangePassword: true,
  });
  done();
  return {
    ok: true,
    message: `${p.data.name} criado. No primeiro acesso ela vai ativar o 2FA e criar a própria senha.`,
  };
}

export async function changeRoleAction(id: number, role: string): Promise<ActionState> {
  const me = await requirePage("users");
  const r = roleEnum.safeParse(role);
  if (!r.success) return { error: "Grupo inválido" };
  const t = await target(id, me.id);
  if ("error" in t) return { error: t.error };
  if (t.u.role === "admin" && r.data !== "admin" && (await otherActiveAdmins(id)) === 0)
    return { error: "O sistema precisa de pelo menos um administrador ativo" };
  await db.update(users).set({ role: r.data }).where(eq(users.id, id));
  done();
  return { ok: true };
}

/** Reset de senha: gera uma temporária (ou usa a digitada) e obriga a troca no próximo login */
export async function resetPasswordAction(id: number, _: ActionState, form: FormData): Promise<ActionState> {
  const me = await requirePage("users");
  const t = await target(id, me.id);
  if ("error" in t) return { error: t.error };
  const typed = String(form.get("newPassword") ?? "").trim();
  const pwd = typed || tempPassword();
  if (typed) {
    const ok = password.safeParse(typed);
    if (!ok.success) return { error: ok.error.issues[0].message };
  }
  await db
    .update(users)
    .set({ passwordHash: await bcrypt.hash(pwd, 12), mustChangePassword: true, sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, id));
  done();
  return { ok: true, message: pwd };
}

export async function toggleBlockAction(id: number): Promise<ActionState> {
  const me = await requirePage("users");
  const t = await target(id, me.id);
  if ("error" in t) return { error: t.error };
  if (!t.u.isBlocked && t.u.role === "admin" && (await otherActiveAdmins(id)) === 0)
    return { error: "Não dá para bloquear o último administrador ativo" };
  await db
    .update(users)
    .set({ isBlocked: !t.u.isBlocked, sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, id));
  done();
  return { ok: true };
}

/** Celular perdido e sem códigos: a pessoa configura o Authenticator de novo no próximo login */
export async function reset2faAction(id: number): Promise<ActionState> {
  const me = await requirePage("users");
  const t = await target(id, me.id);
  if ("error" in t) return { error: t.error };
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ totpEnabled: false, totpSecretEnc: null, sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.id, id));
    await tx.delete(backupCodes).where(eq(backupCodes.userId, id));
  });
  done();
  return { ok: true };
}

/** Matriz grupo × página. Admin sempre vê tudo; páginas ADMIN_ONLY nunca são liberadas. */
export async function savePermissionsAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requirePage("users");
  const rows: { role: string; page: PageKey }[] = [];
  for (const r of ROLES.filter((r) => r.key !== "admin"))
    for (const p of PAGES.filter((p) => !ADMIN_ONLY.includes(p.key)))
      if (form.get(`perm:${r.key}:${p.key}`) === "on") rows.push({ role: r.key, page: p.key });
  await db.transaction(async (tx) => {
    await tx.delete(rolePermissions);
    if (rows.length) await tx.insert(rolePermissions).values(rows);
  });
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Permissões salvas. Valem a partir do próximo clique de cada usuário." };
}
