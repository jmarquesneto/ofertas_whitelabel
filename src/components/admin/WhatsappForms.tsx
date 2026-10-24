"use client";
import { useActionState, useState, useTransition } from "react";
import { RefreshCw, Send, Wifi } from "lucide-react";
import { checkConnectionAction, resendAction, saveWhatsappAction, testWhatsappAction } from "@/server/actions/whatsapp";
import { cn, type ActionState } from "@/lib/utils";
import { Switch } from "./BotForms";
import { FormMessage, SubmitButton } from "./ui";

type Initial = {
  enabled: boolean; baseUrl: string; hasKey: boolean; instance: string; groupJid: string; minGapSeconds: number; sendImage: boolean;
};

export function WhatsappForm({ initial }: { initial: Initial }) {
  const [state, action] = useActionState(saveWhatsappAction, {});
  const [enabled, setEnabled] = useState(initial.enabled);
  const [group, setGroup] = useState(initial.groupJid);
  const [groups, setGroups] = useState<{ id: string; subject: string; size?: number }[] | null>(null);
  const [conn, setConn] = useState<ActionState>({});
  const [test, setTest] = useState<ActionState>({});
  const [pending, start] = useTransition();

  return (
    <form action={action} className="grid gap-5">
      <FormMessage state={state} />
      <section className="card grid gap-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-bold">Enviar ofertas ao grupo</h2>
            <p className="hint mt-0.5">Ligado, as ofertas publicadas (suas, aprovadas ou do robô no modo direto) entram na fila de envio.</p>
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
            <label className="label" htmlFor="groupJid">Grupo</label>
            {groups ? (
              <select className="input" id="groupJid" name="groupJid" value={group} onChange={(e) => setGroup(e.target.value)}>
                <option value="">Escolha…</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.subject}{g.size ? ` (${g.size})` : ""}</option>)}
              </select>
            ) : (
              <input className="input font-mono text-xs" id="groupJid" name="groupJid" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="120363…@g.us" />
            )}
            <span className="hint">Salve a chave e a instância, depois use “Verificar conexão” para listar os grupos.</span>
          </div>
          <div className="field">
            <label className="label" htmlFor="minGapSeconds">Intervalo mínimo entre mensagens (s)</label>
            <input className="input" id="minGapSeconds" name="minGapSeconds" type="number" min={10} max={3600} defaultValue={initial.minGapSeconds} />
            <span className="hint">Protege o número contra bloqueio por excesso de envios.</span>
          </div>
          <label className="flex items-center gap-2 self-end rounded-lg border border-line px-3 py-2.5 text-sm font-semibold">
            <input type="checkbox" name="sendImage" defaultChecked={initial.sendImage} className="h-4 w-4 accent-[rgb(var(--c-secondary))]" />
            Enviar com a foto do produto
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <SubmitButton className="btn-primary px-6">Salvar</SubmitButton>
          <button type="button" className="btn-ghost" disabled={pending}
            onClick={() => start(async () => { const r = await checkConnectionAction(); setConn(r); if (r.groups) setGroups(r.groups); })}>
            <Wifi className="h-4 w-4" /> Verificar conexão
          </button>
          <button type="button" className="btn-ghost" disabled={pending}
            onClick={() => start(async () => setTest(await testWhatsappAction()))}>
            <Send className="h-4 w-4" /> Enviar teste
          </button>
        </div>
        {[conn, test].map((r, i) =>
          r.error || r.message ? (
            <p key={i} className={cn("text-sm", r.error ? "text-red-700" : "text-emerald-700")}>{r.error ?? r.message}</p>
          ) : null,
        )}
      </section>
    </form>
  );
}

export function ResendButton({ offerId, label = "Reenviar" }: { offerId: number; label?: string }) {
  const [pending, start] = useTransition();
  const [r, setR] = useState<ActionState>({});
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className="btn-ghost px-2.5 py-1.5 text-xs" disabled={pending || r.ok}
        onClick={() => start(async () => setR(await resendAction(offerId)))}>
        <RefreshCw className="h-3.5 w-3.5" /> {r.ok ? "Na fila" : label}
      </button>
      {r.error && <span className="text-xs text-red-700">{r.error}</span>}
    </span>
  );
}
