"use client";
import { useActionState, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp } from "lucide-react";
import { createCouponAction, importCouponsAction, previewCouponsAction, type CouponRow } from "@/server/actions/coupons";
import { cn } from "@/lib/utils";
import { FormMessage, SubmitButton } from "./ui";

const dataBR = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Bahia" }) : "—";
const brl = (v: string | null) => (v ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—");

const STATUS: Record<CouponRow["status"], [string, string]> = {
  novo: ["Novo", "bg-emerald-100 text-emerald-800"],
  atualiza: ["Atualiza", "bg-sky-100 text-sky-800"],
  erro: ["Erro", "bg-red-100 text-red-800"],
};

/** Importação em 2 passos: escolher o arquivo → prévia → confirmar */
export function CouponImport({ waReady, couponGroups }: { waReady: boolean; couponGroups: number }) {
  const [preview, previewAction] = useActionState(previewCouponsAction, {});
  const [importedRows, setImportedRows] = useState<CouponRow[] | null>(null);
  const [result, importAction] = useActionState(async (prev: Awaited<ReturnType<typeof importCouponsAction>>, f: FormData) => {
    const r = await importCouponsAction(prev, f);
    if (r.ok) setImportedRows(preview.rows ?? null);
    return r;
  }, {});
  const [fileName, setFileName] = useState("");
  const rows = preview.rows ?? [];
  const valid = rows.filter((r) => r.status !== "erro");
  const errors = rows.length - valid.length;
  const stores = new Set(valid.map((r) => r.platformId)).size;
  const imported = Boolean(importedRows) && importedRows === preview.rows; // esta prévia já foi importada

  return (
    <section className="card grid gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">Importar por CSV</h2>
          <p className="hint mt-0.5">
            Colunas: <code>loja_id</code> e <code>codigo</code> (obrigatórias) · <code>descricao</code>, <code>validade</code>, <code>valor_minimo</code> (opcionais).
            Aceita vírgula ou ponto e vírgula. Cupom que já existe na loja é atualizado.
          </p>
        </div>
        <a href="/admin/cupons/modelo" className="btn-ghost shrink-0">Baixar modelo CSV</a>
      </div>

      <form action={previewAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-line px-4 py-3 text-sm hover:border-ink/30">
          <FileUp className="h-5 w-5 shrink-0 text-ink-faint" />
          <span className="truncate">{fileName || "Escolher arquivo .csv"}</span>
          <input type="file" name="file" accept=".csv,text/csv,text/plain" required className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")} />
        </label>
        <SubmitButton className="btn-secondary shrink-0" pendingText="Lendo…">Ver prévia</SubmitButton>
      </form>
      {preview.error && <p role="alert" className="text-sm text-red-700">{preview.error}</p>}

      {rows.length > 0 && (
        <div className="grid gap-3">
          <p className="text-sm">
            <b>{rows.length}</b> linha(s): <span className="text-emerald-700">{valid.filter((r) => r.status === "novo").length} novo(s)</span> ·{" "}
            <span className="text-sky-700">{valid.filter((r) => r.status === "atualiza").length} atualiza(m)</span>
            {errors > 0 && <> · <span className="text-red-700">{errors} com erro (serão ignoradas)</span></>}
          </p>
          <div className="max-h-[360px] overflow-auto rounded-xl border border-line">
            <table className="w-full min-w-[720px]">
              <thead className="sticky top-0 bg-surface">
                <tr>
                  <th className="table-head">Linha</th><th className="table-head">Loja</th><th className="table-head">Código</th>
                  <th className="table-head">Descrição</th><th className="table-head">Validade</th><th className="table-head">Mínimo</th>
                  <th className="table-head">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.line} className={cn(r.status === "erro" && "bg-red-50/60")}>
                    <td className="table-cell text-xs text-ink-faint">{r.line}</td>
                    <td className="table-cell text-sm">{r.platformName ?? (r.platformId ?? "—")}</td>
                    <td className="table-cell font-mono text-sm font-bold">{r.code || "—"}</td>
                    <td className="table-cell max-w-[220px] truncate text-sm">{r.description ?? "—"}</td>
                    <td className="table-cell text-sm">{dataBR(r.expiresAt)}</td>
                    <td className="table-cell text-sm">{brl(r.minValue)}</td>
                    <td className="table-cell">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STATUS[r.status][1])}>{STATUS[r.status][0]}</span>
                      {r.error && <p className="mt-0.5 text-xs text-red-700">{r.error}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {valid.length > 0 && !imported && (
            <form action={importAction} className="flex flex-wrap items-center gap-4 rounded-xl bg-surface-sunken p-4">
              <input type="hidden" name="rows" value={JSON.stringify(valid.map(({ line, platformId, code, description, expiresAt, minValue }) =>
                ({ line, platformId, code, description, expiresAt, minValue })))} />
              {waReady && couponGroups > 0 ? (
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" name="sendWhatsapp" defaultChecked className="h-4 w-4 accent-[rgb(var(--c-secondary))]" />
                  Enviar ao WhatsApp: {stores} mensagem(ns) (uma por loja) × {couponGroups} grupo(s) de cupons
                </label>
              ) : (
                <p className="text-sm text-ink-muted">
                  Para enviar ao WhatsApp, ligue o WhatsApp e marque ao menos um grupo como <b>Cupons</b>.
                </p>
              )}
              <SubmitButton className="btn-primary ml-auto" pendingText="Importando…">Importar {valid.length} cupom(ns)</SubmitButton>
            </form>
          )}
        </div>
      )}
      {result.error && <p role="alert" className="text-sm text-red-700">{result.error}</p>}
      {imported && result.message && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {result.message}
        </p>
      )}
    </section>
  );
}

export function CouponCreateForm({ platforms, waReady, couponGroups }: {
  platforms: { id: number; name: string }[]; waReady: boolean; couponGroups: number;
}) {
  const [state, action] = useActionState(createCouponAction, {});
  return (
    <form action={action} className="card grid gap-4 p-5 sm:p-6">
      <h2 className="font-bold">Cadastrar um cupom</h2>
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field">
          <label className="label" htmlFor="c-platform">Loja</label>
          <select className="input" id="c-platform" name="platformId" required defaultValue="">
            <option value="" disabled>Selecione…</option>
            {platforms.map((p) => <option key={p.id} value={p.id}>{p.name} (ID {p.id})</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="c-code">Código</label>
          <input className="input font-mono uppercase" id="c-code" name="code" required maxLength={60} placeholder="FRETE10" />
        </div>
        <div className="field sm:col-span-2">
          <label className="label" htmlFor="c-desc">Descrição <span className="font-normal text-ink-faint">(opcional)</span></label>
          <input className="input" id="c-desc" name="description" maxLength={200} placeholder="R$ 20 off acima de R$ 150" />
        </div>
        <div className="field">
          <label className="label" htmlFor="c-exp">Validade <span className="font-normal text-ink-faint">(opcional)</span></label>
          <input className="input" id="c-exp" name="expiresAt" type="date" />
        </div>
        <div className="field">
          <label className="label" htmlFor="c-min">Valor mínimo <span className="font-normal text-ink-faint">(opcional)</span></label>
          <input className="input" id="c-min" name="minValue" inputMode="decimal" placeholder="150,00" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton className="btn-primary">Salvar cupom</SubmitButton>
        {waReady && couponGroups > 0 && (
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="sendWhatsapp" className="h-4 w-4 accent-[rgb(var(--c-secondary))]" /> Enviar ao WhatsApp
          </label>
        )}
      </div>
    </form>
  );
}

export function MissingSetupHint({ banner, link }: { banner: boolean; link: boolean }) {
  if (banner && link) return null;
  return (
    <p className="flex items-center gap-1.5 text-xs text-amber-700">
      <AlertTriangle className="h-3.5 w-3.5" />
      {!banner && "sem banner de cupons (usa o logo)"}{!banner && !link && " · "}{!link && "sem link de afiliado da loja (o link vai para /cupons)"}
    </p>
  );
}
