import { NextResponse, type NextRequest } from "next/server";

/**
 * O controle de acesso do painel é feito no servidor por requireUser()/requirePage()
 * (layout, cada página e cada Server Action) e na página de 2FA. O redirect para
 * /admin/login é relativo, então funciona atrás de qualquer IP, porta ou domínio.
 *
 * Aqui só: repassar o caminho atual para o layout (menu ativo / troca de senha
 * obrigatória) e marcar o painel como não indexável.
 */
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = { matcher: ["/admin/:path*"] };
