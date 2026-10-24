"use client";
import { useActionState, useState, useTransition } from "react";
import { Check, Link2, X } from "lucide-react";
import { approveAction, importLinkAction, rejectAction, rejectAllAction } from "@/server/actions/approval";
import { cn } from "@/lib/utils";
import { FormMessage, SubmitButton } from "./ui";

export function ImportLinkForm({ online }: { online: boolean }) {
  const [state, action] = useActionState(importLinkAction, {});
  return (
    <form action={action} className="card grid gap-3 p-5 sm:p-6">
      <div>
        <h2 className="flex items-center gap-2 font-bold"><Link2 className="h-4 w-4" /> Importar por link</h2>
        <p className="hint mt-0.5">
          Cole o link de um produto do Mercado Livre, Amazon ou Shopee. O coletor busca título, foto e preço e gera o seu link de afiliado.
        </p>
      </div>
      <FormMessage state={state} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className="input" name="url" type="url" required placeholder="https://www.mercadolivre.com.br/…" disabled={!online} />
        <SubmitButton className="btn-primary shrink-0" pendingText="Lendo o produto…">Importar</SubmitButton>
      </div>
      {!online && <p className="text-xs text-red-700">O coletor está offline. Confira o container no Portainer.</p>}
    </form>
  );
}

export function ReviewActions({ id, waReady }: { id: number; waReady: boolean }) {
  const [send, setSend] = useState(waReady);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; message?: string }>({});
  return (
    <div className="grid gap-2">
      {waReady && (
        <label className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
          <input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} className="accent-[rgb(var(--c-secondary))]" />
          Enviar ao WhatsApp
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} className="btn-primary py-2"
          onClick={() => start(async () => setMsg(await approveAction(id, send)))}>
          <Check className="h-4 w-4" /> Aprovar
        </button>
        <a href={`/admin/offers/${id}`} className="btn-ghost py-2">Editar</a>
        <button type="button" disabled={pending} className="btn-danger py-2"
          onClick={() => start(async () => setMsg(await rejectAction(id)))}>
          <X className="h-4 w-4" /> Descartar
        </button>
      </div>
      {(msg.error || msg.message) && <p className={cn("text-xs", msg.error ? "text-red-700" : "text-emerald-700")}>{msg.error ?? msg.message}</p>}
    </div>
  );
}

export function RejectAllButton({ total }: { total: number }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn-ghost" disabled={pending}
      onClick={() => { if (window.confirm(`Descartar as ${total} ofertas da fila?`)) start(async () => { await rejectAllAction(); }); }}>
      Descartar todas
    </button>
  );
}
