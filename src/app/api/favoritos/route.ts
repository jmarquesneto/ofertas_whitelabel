import { NextResponse, type NextRequest } from "next/server";
import { offersByIds } from "@/server/queries";

export const dynamic = "force-dynamic";

/** GET /api/favoritos?ids=1,2,3 → ofertas visíveis (para a página de favoritos) */
export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 100);
  const rows = await offersByIds(ids);
  return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
}
