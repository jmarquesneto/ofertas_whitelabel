/** POST /api/bot/ofertas — o coletor entrega uma oferta já com link de afiliado */
import { NextResponse } from "next/server";
import { botAuthorized, intakeOffer, intakeSchema } from "@/server/bot-intake";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!botAuthorized(req)) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  const p = intakeSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) {
    const i = p.error.issues[0];
    return NextResponse.json({ erro: `${i.path.join(".")}: ${i.message}` }, { status: 400 });
  }
  return NextResponse.json(await intakeOffer(p.data));
}
