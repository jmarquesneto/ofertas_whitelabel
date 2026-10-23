import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, PRE_COOKIE, verifyToken, type SessionClaims, type PreClaims } from "@/lib/session";

/**
 * Primeira barreira do painel (Edge). A verificação definitiva
 * (usuário existe, 2FA ativo, versão da sessão) acontece em requireAdmin().
 */
const PUBLIC_ADMIN = ["/admin/login", "/admin/register"];

// Location relativo: funciona atrás de qualquer proxy reverso/domínio sem depender do Host interno
const toLogin = () => new NextResponse(null, { status: 307, headers: { Location: "/admin/login" } });

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_ADMIN.includes(pathname)) return NextResponse.next();

  if (pathname === "/admin/2fa") {
    const pre = await verifyToken<PreClaims>(req.cookies.get(PRE_COOKIE)?.value);
    return pre ? NextResponse.next() : toLogin();
  }

  const s = await verifyToken<SessionClaims>(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s || s.stage !== "full") return toLogin();
  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = { matcher: ["/admin/:path*"] };
