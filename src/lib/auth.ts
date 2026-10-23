import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { SESSION_COOKIE, verifyToken, type SessionClaims } from "./session";

/** Usuário da sessão completa (pós-2FA) ou null */
export async function getCurrentUser() {
  const jar = await cookies();
  const claims = await verifyToken<SessionClaims>(jar.get(SESSION_COOKIE)?.value);
  if (!claims || claims.stage !== "full") return null;
  const [u] = await db.select().from(users).where(eq(users.id, Number(claims.sub))).limit(1);
  // sessionVersion permite "deslogar de todos os dispositivos"
  if (!u || !u.totpEnabled || u.sessionVersion !== claims.v) return null;
  return u;
}

/** Guard usado em TODA página e Server Action do painel */
export async function requireAdmin() {
  const u = await getCurrentUser();
  if (!u) redirect("/admin/login");
  return u;
}
