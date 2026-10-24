import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { rolePermissions, users } from "@/db/schema";
import { ADMIN_ONLY, PAGES, type PageKey } from "./permissions";
import { SESSION_COOKIE, verifyToken, type SessionClaims } from "./session";

/** Usuário da sessão completa (pós-2FA) ou null. Bloqueado = sem sessão. */
export const getCurrentUser = cache(async () => {
  const jar = await cookies();
  const claims = await verifyToken<SessionClaims>(jar.get(SESSION_COOKIE)?.value);
  if (!claims || claims.stage !== "full") return null;
  const [u] = await db.select().from(users).where(eq(users.id, Number(claims.sub))).limit(1);
  // sessionVersion permite "deslogar de todos os dispositivos" (reset de senha, bloqueio…)
  if (!u || !u.totpEnabled || u.isBlocked || u.sessionVersion !== claims.v) return null;
  return u;
});

/** Páginas liberadas para um grupo (admin: todas) */
export const allowedPages = cache(async (role: string): Promise<PageKey[]> => {
  if (role === "admin") return PAGES.map((p) => p.key);
  const rows = await db.select({ page: rolePermissions.page }).from(rolePermissions).where(eq(rolePermissions.role, role));
  const set = new Set(rows.map((r) => r.page));
  return PAGES.map((p) => p.key).filter((k) => set.has(k) && !ADMIN_ONLY.includes(k));
});

/** Qualquer usuário logado (ex.: Meu perfil) */
export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) redirect("/admin/login");
  return u;
}

/**
 * Guard de TODA página e Server Action do painel: usuário logado
 * e com permissão para a página. Sem permissão → primeira página liberada.
 */
export async function requirePage(page: PageKey) {
  const u = await requireUser();
  if (u.mustChangePassword) redirect("/admin/perfil?trocar-senha=1");
  const pages = await allowedPages(u.role);
  if (!pages.includes(page)) {
    const first = PAGES.find((p) => pages.includes(p.key));
    redirect(first ? `${first.href}${first.href.includes("?") ? "&" : "?"}sem-acesso=1` : "/admin/perfil?sem-acesso=1");
  }
  return u;
}
