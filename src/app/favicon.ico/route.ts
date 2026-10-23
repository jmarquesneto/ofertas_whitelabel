import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Navegadores pedem /favicon.ico direto: aponta para o favicon configurado no painel */
export async function GET() {
  const s = await getSettings();
  if (!s.faviconPath) return new NextResponse(null, { status: 204 });
  return new NextResponse(null, { status: 302, headers: { Location: s.faviconPath } });
}
