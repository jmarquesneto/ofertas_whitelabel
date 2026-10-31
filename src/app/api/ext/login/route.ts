/** POST /api/ext/login — 1º passo do login da extensão (e-mail + senha) */
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { rateLimit } from "@/lib/rate-limit";
import { ipFromHeaders } from "@/lib/request";
import { json, preflight, signTicket } from "@/server/ext-auth";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

let DUMMY: string | null = null;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const ip = ipFromHeaders(req.headers);
  if (!rateLimit(`login:${ip}`) || !rateLimit(`login:${email}`))
    return json(req, { erro: "Muitas tentativas. Aguarde alguns minutos." }, 429);
  const [u] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
  const ok = await bcrypt.compare(password, u?.passwordHash ?? (DUMMY ??= bcrypt.hashSync("x-nao-existe", 12)));
  if (!u || !ok) return json(req, { erro: "E-mail ou senha incorretos" }, 401);
  if (u.isBlocked) return json(req, { erro: "Esta conta está bloqueada. Fale com um administrador." }, 403);
  if (!u.totpEnabled) return json(req, { erro: "Ative o 2FA entrando no painel pelo navegador antes de usar a extensão." }, 403);
  return json(req, { ticket: await signTicket(u.id), nome: u.name });
}
