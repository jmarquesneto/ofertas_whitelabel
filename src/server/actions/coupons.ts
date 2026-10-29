"use server";
/**
 * CONTROLLER — Cupons
 * Importação por CSV em 2 passos (prévia → confirmar), cadastro manual e manutenção.
 * Ao confirmar com "Enviar ao WhatsApp", sai UMA mensagem por loja com os cupons dela,
 * para cada grupo marcado como "Cupons".
 */
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { coupons, platforms } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { normHeader, parseCsv } from "@/lib/csv";
import type { ActionState } from "@/lib/utils";
import { enqueueCoupons } from "@/server/whatsapp";

const MAX_ROWS = 2000;
const TZ_OFFSET = "-03:00"; // validade = fim do dia no horário de Brasília

const refresh = () => {
  revalidatePath("/admin/cupons");
  revalidatePath("/cupons");
};

/* ----------------------------- normalização ----------------------------- */

const HEADERS: Record<string, "loja" | "codigo" | "descricao" | "validade" | "minimo" | "desconto"> = {
  desconto: "desconto", destaque: "desconto", discount: "desconto", off: "desconto",
  lojaid: "loja", idloja: "loja", loja: "loja", plataforma: "loja", plataformaid: "loja", idplataforma: "loja", storeid: "loja",
  codigo: "codigo", cupom: "codigo", code: "codigo", codigocupom: "codigo", coupon: "codigo",
  descricao: "descricao", description: "descricao", desc: "descricao", beneficio: "descricao",
  validade: "validade", vencimento: "validade", expira: "validade", expiracao: "validade", validoate: "validade", ate: "validade",
  valorminimo: "minimo", minimo: "minimo", pedidominimo: "minimo", compraminima: "minimo", min: "minimo",
};

export type CouponRow = {
  line: number;
  platformId: number | null;
  platformName?: string;
  code: string;
  discount: string | null;
  description: string | null;
  expiresAt: string | null; // ISO
  minValue: string | null;
  status: "novo" | "atualiza" | "erro";
  error?: string;
};

/** "31/12/2026", "31/12/26", "2026-12-31" (com ou sem hora) → fim do dia em Brasília */
function parseDate(v: string): { iso: string | null; error?: string } {
  const t = v.trim();
  if (!t) return { iso: null };
  let y: number, m: number, d: number;
  let mt = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/);
  if (mt) { d = +mt[1]; m = +mt[2]; y = +mt[3] < 100 ? 2000 + +mt[3] : +mt[3]; }
  else if ((mt = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) { y = +mt[1]; m = +mt[2]; d = +mt[3]; }
  else return { iso: null, error: `validade “${t}” não reconhecida (use 31/12/2026)` };
  const date = new Date(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T23:59:59${TZ_OFFSET}`);
  if (Number.isNaN(date.getTime()) || date.getUTCDate() === 0 || m > 12 || d > 31) return { iso: null, error: `validade “${t}” inválida` };
  if (date.getTime() < Date.now()) return { iso: null, error: `validade ${t} já passou` };
  return { iso: date.toISOString() };
}

/** "R$ 49,90", "49.9", "49" → "49.90" */
function parseMoney(v: string): { value: string | null; error?: string } {
  const raw = v.replace(/R\$|\s/g, "");
  if (!raw) return { value: null };
  const n = Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);
  if (!Number.isFinite(n) || n < 0 || n > 9_999_999) return { value: null, error: `valor mínimo “${v.trim()}” inválido` };
  return { value: n > 0 ? n.toFixed(2) : null };
}

/** ISO (UTC) → "2026-12-31" no horário de Brasília (a validade é guardada como 23:59 local) */
const isoToLocalDate = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3_600_000).toISOString().slice(0, 10);

const CODE_RE = /^[A-Z0-9][A-Z0-9_.\-]{1,59}$/;

/** Valida linhas já mapeadas e marca novo/atualiza/erro (consulta o banco uma vez) */
async function classify(
  input: { line: number; loja: string; codigo: string; descricao: string; validade: string; minimo: string; desconto?: string }[],
): Promise<CouponRow[]> {
  const plats = await db.select({ id: platforms.id, name: platforms.name }).from(platforms);
  const platById = new Map(plats.map((p) => [p.id, p.name]));
  const out: CouponRow[] = [];
  const seen = new Map<string, number>();

  for (const r of input) {
    const code = r.codigo.trim().toUpperCase().replace(/\s+/g, "");
    const pid = Number(r.loja.trim());
    const row: CouponRow = { line: r.line, platformId: Number.isInteger(pid) ? pid : null, code, discount: null, description: null, expiresAt: null, minValue: null, status: "novo" };
    const errs: string[] = [];
    if (!r.loja.trim()) errs.push("loja_id vazio");
    else if (!Number.isInteger(pid) || !platById.has(pid)) errs.push(`loja_id ${r.loja.trim()} não existe em Plataformas`);
    else row.platformName = platById.get(pid);
    if (!code) errs.push("código vazio");
    else if (!CODE_RE.test(code)) errs.push(`código “${code}” com caracteres inválidos`);
    const desc = r.descricao.trim();
    if (desc.length > 200) errs.push("descrição passa de 200 caracteres");
    row.description = desc ? desc.slice(0, 200) : null;
    const disc = (r.desconto ?? "").trim();
    if (disc.length > 30) errs.push("desconto passa de 30 caracteres (ex.: 15% OFF)");
    row.discount = disc ? disc.slice(0, 30).toUpperCase() : null;
    const dt = parseDate(r.validade);
    if (dt.error) errs.push(dt.error);
    row.expiresAt = dt.iso;
    const mv = parseMoney(r.minimo);
    if (mv.error) errs.push(mv.error);
    row.minValue = mv.value;

    const key = `${row.platformId}:${code}`;
    if (!errs.length && seen.has(key)) {
      // repetido no mesmo arquivo: vale a última linha
      const prev = out[seen.get(key)!];
      prev.status = "erro";
      prev.error = `repetido na linha ${r.line} (vale a última)`;
    }
    if (errs.length) { row.status = "erro"; row.error = errs.join("; "); }
    else seen.set(key, out.length);
    out.push(row);
  }

  // Já existe no banco? → "atualiza"
  const ok = out.filter((r) => r.status !== "erro");
  if (ok.length) {
    const existing = await db
      .select({ platformId: coupons.platformId, code: coupons.code })
      .from(coupons)
      .where(inArray(coupons.code, [...new Set(ok.map((r) => r.code))]));
    const ex = new Set(existing.map((e) => `${e.platformId}:${e.code}`));
    for (const r of ok) if (ex.has(`${r.platformId}:${r.code}`)) r.status = "atualiza";
  }
  return out;
}

/* ------------------------------ passo 1: prévia ------------------------------ */

export async function previewCouponsAction(_: unknown, form: FormData): Promise<{ error?: string; rows?: CouponRow[] }> {
  await requirePage("coupons");
  const file = form.get("file");
  let text = String(form.get("text") ?? "");
  if (file instanceof File && file.size > 0) {
    if (file.size > 2 * 1024 * 1024) return { error: "Arquivo grande demais (máx. 2 MB)" };
    const buf = Buffer.from(await file.arrayBuffer());
    // Excel às vezes salva em Windows-1252: se não for UTF-8 válido, decodifica como latin1
    text = buf.toString("utf8");
    if (text.includes("�")) text = buf.toString("latin1");
  }
  if (!text.trim()) return { error: "Escolha o arquivo CSV (ou cole o conteúdo)" };

  const table = parseCsv(text);
  if (table.length < 2) return { error: "O CSV precisa do cabeçalho e de pelo menos uma linha" };
  const cols = table[0].map((h) => HEADERS[normHeader(h)]);
  if (!cols.includes("loja") || !cols.includes("codigo"))
    return { error: "O cabeçalho precisa das colunas loja_id e codigo (baixe o modelo para ver o formato)" };
  if (table.length - 1 > MAX_ROWS) return { error: `No máximo ${MAX_ROWS} cupons por arquivo` };

  const input = table.slice(1).map((cells, i) => {
    const get = (k: string) => { const idx = cols.indexOf(k as never); return idx >= 0 ? (cells[idx] ?? "") : ""; };
    return { line: i + 2, loja: get("loja"), codigo: get("codigo"), descricao: get("descricao"), validade: get("validade"), minimo: get("minimo"), desconto: get("desconto") };
  });
  return { rows: await classify(input) };
}

/* ---------------------------- passo 2: confirmar ---------------------------- */

const confirmSchema = z.array(
  z.object({
    line: z.number(), platformId: z.number().int(), code: z.string(),
    discount: z.string().nullable().optional(), description: z.string().nullable(), expiresAt: z.string().nullable(), minValue: z.string().nullable(),
  }),
).max(MAX_ROWS);

export async function importCouponsAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requirePage("coupons");
  let raw: unknown;
  try { raw = JSON.parse(String(form.get("rows") ?? "[]")); } catch { return { error: "Prévia inválida, faça de novo" }; }
  const p = confirmSchema.safeParse(raw);
  if (!p.success || !p.data.length) return { error: "Nada para importar" };

  // Revalida no servidor (a prévia veio do navegador)
  const rows = (await classify(p.data.map((r) => ({
    line: r.line, loja: String(r.platformId), codigo: r.code, descricao: r.description ?? "", desconto: r.discount ?? "",
    validade: r.expiresAt ? isoToLocalDate(r.expiresAt) : "", minimo: r.minValue ?? "",
  })))).filter((r) => r.status !== "erro");
  if (!rows.length) return { error: "Nenhuma linha válida para importar" };

  const byPlatform = new Map<number, number[]>();
  let created = 0, updated = 0;
  await db.transaction(async (tx) => {
    for (const r of rows) {
      const [res] = await tx
        .insert(coupons)
        .values({
          platformId: r.platformId!, code: r.code, discount: r.discount, description: r.description, minValue: r.minValue,
          expiresAt: r.expiresAt ? new Date(r.expiresAt) : null, isActive: true, createdBy: user.id,
        })
        .onConflictDoUpdate({
          target: [coupons.platformId, coupons.code],
          set: {
            discount: r.discount, description: r.description, minValue: r.minValue, isActive: true, updatedAt: sql`now()`,
            expiresAt: r.expiresAt ? new Date(r.expiresAt) : null,
          },
        })
        .returning({ id: coupons.id, inserted: sql<boolean>`xmax = 0` });
      if (res.inserted) created++; else updated++;
      byPlatform.set(r.platformId!, [...(byPlatform.get(r.platformId!) ?? []), res.id]);
    }
  });

  let msgs = 0;
  if (form.get("sendWhatsapp") === "on") {
    for (const [pid, ids] of byPlatform) msgs += await enqueueCoupons(pid, ids);
  }
  refresh();
  revalidatePath("/admin/whatsapp");
  const wa = form.get("sendWhatsapp") === "on"
    ? msgs ? ` ${msgs} mensagem(ns) na fila do WhatsApp (${byPlatform.size} loja(s) × grupos de cupons).` : " WhatsApp: nenhum grupo de Cupons ativo, nada enviado."
    : "";
  return { ok: true, message: `${created} cupom(ns) novo(s) e ${updated} atualizado(s).${wa}` };
}

/* ------------------------------ cadastro manual ------------------------------ */

export async function createCouponAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requirePage("coupons");
  const [r] = await classify([{
    line: 1,
    loja: String(form.get("platformId") ?? ""),
    codigo: String(form.get("code") ?? ""),
    descricao: String(form.get("description") ?? ""),
    validade: String(form.get("expiresAt") ?? ""), // input date: 2026-12-31
    minimo: String(form.get("minValue") ?? ""),
    desconto: String(form.get("discount") ?? ""),
  }]);
  if (r.status === "erro") return { error: r.error };
  const [row] = await db
    .insert(coupons)
    .values({
      platformId: r.platformId!, code: r.code, discount: r.discount, description: r.description, minValue: r.minValue,
      expiresAt: r.expiresAt ? new Date(r.expiresAt) : null, createdBy: user.id,
    })
    .onConflictDoUpdate({
      target: [coupons.platformId, coupons.code],
      set: { discount: r.discount, description: r.description, minValue: r.minValue, expiresAt: r.expiresAt ? new Date(r.expiresAt) : null, isActive: true, updatedAt: sql`now()` },
    })
    .returning({ id: coupons.id });
  let wa = "";
  if (form.get("sendWhatsapp") === "on") {
    const n = await enqueueCoupons(r.platformId!, [row.id]);
    wa = n ? " Na fila do WhatsApp." : " (nenhum grupo de Cupons ativo)";
  }
  refresh();
  return { ok: true, message: `Cupom ${r.code} salvo em ${r.platformName}.${wa}` };
}

export async function toggleCouponAction(id: number) {
  await requirePage("coupons");
  await db.update(coupons).set({ isActive: sql`not ${coupons.isActive}`, updatedAt: sql`now()` }).where(eq(coupons.id, id));
  refresh();
}

export async function deleteCouponAction(id: number) {
  await requirePage("coupons");
  await db.delete(coupons).where(eq(coupons.id, id));
  refresh();
}

export async function deleteExpiredCouponsAction(): Promise<ActionState> {
  await requirePage("coupons");
  const gone = await db
    .delete(coupons)
    .where(and(isNotNull(coupons.expiresAt), lte(coupons.expiresAt, sql`now()`)))
    .returning({ id: coupons.id });
  refresh();
  return { ok: true, message: `${gone.length} cupom(ns) vencido(s) excluído(s).` };
}
