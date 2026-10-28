"use client";
import { useActionState, useState, useTransition } from "react";
import { RefreshCw, Send, Wifi } from "lucide-react";
import {
  checkConnectionAction, resendAction, resendCouponsAction, saveGroupsAction, saveWhatsappAction, testWhatsappAction,
} from "@/server/actions/whatsapp";
import { cn, type ActionState } from "@/lib/utils";
import { Switch } from "./BotForms";
import { FormMessage, SubmitButton } from "./ui";

type Initial = { enabled: boolean; baseUrl: string; hasKey: boolean; instance: string; minGapSeconds: number; sendImage: boolean };
type Group = { jid: string; name: string; size?: number; sendOffers: boolean; sendCoupons: boolean };

export function WhatsappForm({ initial }: { initial: Initial }) {
  const [state, action] = useActionState(saveWhatsappAction, {});
  const [enabled, setEnabled] = useState(initial.enabled);
  return (
    <form action={action} className="card grid gap-4 p-5 sm:p-6">
      <FormMessage state={state} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-bold">Envio pelo WhatsApp</h2>
          <p className="hint mt-0.5">Ligado, ofertas publicadas e cupons importados entram na fila de envio dos grupos marcados abaixo.</p>
        </div>
        <input type="hidden" name="enabled" value={enabled ? "on" : ""} />
        <Switch checked={enabled} onChange={setEnabled} label="WhatsApp ligado" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field">
          <label className="label" htmlFor="baseUrl">Endereço do Evolution</label>
          <input className="input font-mono text-xs" id="baseUrl" name="baseUrl" defaultValue={initial.baseUrl} required />
          <span className="hint">Pela rede interna: <code>http://evolution-api:8080</code></span>
        </div>
        <div className="field">
          <label className="label" htmlFor="apiKey">Chave da API (EVO_API_KEY)</label>
          <input className="input font-mono text-xs" id="apiKey" name="apiKey" type="password" autoComplete="new-password"
            placeholder={initial.hasKey ? "•••••••• (salva; deixe em branco para manter)" : ""} />
        </div>
        <div className="field">
          <label className="label" htmlFor="instance">Instância</label>
          <input className="input" id="instance" name="instance" defaultValue={initial.instance} placeholder="pato_ofertas" />
          <span className="hint">O nome exato criado no /manager.</span>
        </div>
        <div className="field">
          <label className="label" htmlFor="minGapSeconds">Intervalo mínimo entre mensagens (s)</label>
          <input className="input" id="minGapSeconds" name="minGapSeconds" type="number" min={10} max={3600} defaultValue={initial.minGapSeconds} />
          <span className="hint">Vale para todos os grupos. Protege o número contra bloqueio.</span>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="sendImage" defaultChecked={initial.sendImage} className="h-4 w-4 accent-[rgb(var(--c-secondary))]" />
        Enviar com imagem (foto do produto ou banner de cupons da loja)
      </label>
      <div><SubmitButton className="btn-primary px-6">Salvar</SubmitButton></div>
    </form>
  );
}

/** Lista de grupos: o que já está salvo + o que o "Verificar conexão" encontrar */
export function GroupsForm({ saved }: { saved: Group[] }) {
  const [state, action] = useActionState(saveGroupsAction, {});
  const [groups, setGroups] = useState<Group[]>(saved);
  const [conn, setConn] = useState<ActionState>({});
  const [test, setTest] = useState<ActionState & { jid?: string }>({});
  const [pending, start] = useTransition();

  const merge = (found: { id: string; subject: string; size?: number }[]) =>
    setGroups((cur) => {
      const byJid = new Map(cur.map((g) => [g.jid, g]));
      for (const f of found) {
        const old = byJid.get(f.id);
        byJid.set(f.id, { jid: f.id, name: f.subject, size: f.size, sendOffers: old?.sendOffers ?? false, sendCoupons: old?.sendCoupons ?? false });
      }
      return [...byJid.values()].sort((a, b) => Number(b.sendOffers || b.sendCoupons) - Number(a.sendOffers || a.sendCoupons) || a.name.localeCompare(b.name, "pt-BR"));
    });
  const toggle = (jid: string, k: "sendOffers" | "sendCoupons") =>
    setGroups((cur) => cur.map((g) => (g.jid === jid ? { ...g, [k]: !g[k] } : g)));

  return (
    <form action={action} className="card grid gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">Grupos</h2>
          <p className="hint mt-0.5">Marque o que cada grupo recebe. Ex.: o grupo de ofertas recebe <b>Ofertas</b> e <b>Cupons</b>; o grupo de cupons só <b>Cupons</b>.</p>
        </div>
        <button type="button" className="btn-ghost" disabled={pending}
          onClick={() => start(async () => { const r = await checkConnectionAction(); setConn(r); if (r.groups) merge(r.groups); })}>
          <Wifi className="h-4 w-4" /> {pending ? "Verificando…" : "Verificar conexão"}
        </button>
      </div>
      {(conn.error || conn.message) && <p className={cn("text-sm", conn.error ? "text-red-700" : "text-emerald-700")}>{conn.error ?? conn.message}</p>}
      <FormMessage state={state} />

      {groups.length === 0 ? (
        <p className="rounded-lg bg-surface-sunken p-4 text-sm text-ink-muted">Clique em “Verificar conexão” para listar os grupos em que o número está.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[520px]">
            <thead className="bg-surface">
              <tr>
                <th className="table-head">Grupo</th>
                <th className="table-head text-center">Ofertas</th>
                <th className="table-head text-center">Cupons</th>
                <th className="table-head text-right">Teste</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.jid} className={cn(!(g.sendOffers || g.sendCoupons) && "text-ink-muted")}>
                  <td className="table-cell">
                    <p className="font-medium">{g.name}{g.size ? <span className="font-normal text-ink-faint"> · {g.size} pessoas</span> : null}</p>
                    <p className="font-mono text-[11px] text-ink-faint">{g.jid}</p>
                  </td>
                  {(["sendOffers", "sendCoupons"] as const).map((k) => (
                    <td key={k} className="table-cell text-center">
                      <input type="checkbox" aria-label={`${k === "sendOffers" ? "Ofertas" : "Cupons"} em ${g.name}`} checked={g[k]}
                        onChange={() => toggle(g.jid, k)} className="h-4 w-4 accent-[rgb(var(--c-secondary))]" />
                    </td>
                  ))}
                  <td className="table-cell text-right">
                    <button type="button" className="btn-ghost px-2.5 py-1.5 text-xs" disabled={pending}
                      onClick={() => start(async () => setTest({ ...(await testWhatsappAction(g.jid)), jid: g.jid }))}>
                      <Send className="h-3.5 w-3.5" /> Enviar teste
                    </button>
                    {test.jid === g.jid && (test.error || test.message) && (
                      <p className={cn("mt-1 text-xs", test.error ? "text-red-700" : "text-emerald-700")}>{test.error ?? test.message}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <input type="hidden" name="groups" value={JSON.stringify(groups.map(({ size: _s, ...g }) => g))} />
      <div><SubmitButton className="btn-primary px-6">Salvar grupos</SubmitButton></div>
    </form>
  );
}

export function ResendButton({ offerId, platformId, label = "Reenviar" }: { offerId?: number | null; platformId?: number | null; label?: string }) {
  const [pending, start] = useTransition();
  const [r, setR] = useState<ActionState>({});
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className="btn-ghost px-2.5 py-1.5 text-xs" disabled={pending || r.ok}
        onClick={() => start(async () => setR(offerId ? await resendAction(offerId) : await resendCouponsAction(platformId!)))}>
        <RefreshCw className="h-3.5 w-3.5" /> {r.ok ? "Na fila" : label}
      </button>
      {r.error && <span className="text-xs text-red-700">{r.error}</span>}
    </span>
  );
}
