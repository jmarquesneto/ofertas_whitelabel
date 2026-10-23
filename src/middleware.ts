import { NextResponse, type NextRequest } from "next/server";

/**
 * O controle de acesso do painel é feito no servidor por requireAdmin()
 * (layout do painel, cada página e cada Server Action) e na página de 2FA.
 * Lá o redirect para /admin/login é relativo, então funciona atrás de qualquer
 * IP, porta ou domínio — algo que o middleware não garante, porque o servidor
 * interno do Next troca o Host antes de chegar aqui.
 *
 * O middleware só marca o painel como não indexável.
 */
export function middleware(_req: NextRequest) {
  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = { matcher: ["/admin/:path*"] };
