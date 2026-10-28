/** GET /admin/cupons/modelo — CSV modelo com o ID de cada loja (abre direto no Excel) */
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { platforms } from "@/db/schema";
import { requirePage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  await requirePage("coupons");
  const list = await db.select({ id: platforms.id, name: platforms.name }).from(platforms).orderBy(asc(platforms.sortOrder), asc(platforms.id));
  const year = new Date().getFullYear();
  const lines = ["loja_id;codigo;descricao;validade;valor_minimo"];
  const examples = [
    ["FRETE10", "frete grátis", `31/12/${year}`, "49,00"],
    ["DESCONTO20", "R$ 20 off", "", "150,00"],
    ["BEMVINDO", "10% na primeira compra", "", ""],
  ];
  list.forEach((p, i) => {
    const [code, desc, val, min] = examples[i % examples.length];
    lines.push([p.id, `${p.name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)}${code}`, desc, val, min].join(";"));
  });
  // BOM: o Excel abre com acentos certos
  return new Response("﻿" + lines.join("\r\n") + "\r\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="modelo-cupons.csv"',
      "cache-control": "no-store",
    },
  });
}
