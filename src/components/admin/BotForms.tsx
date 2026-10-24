"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { CheckCircle2, ClipboardPaste, ExternalLink, FlaskConical, LogIn, Monitor, Play, ShieldCheck, Zap } from "lucide-react";
import type { BotSources } from "@/db/schema";
import { NICHES } from "@/lib/niches";
import { cn, type ActionState } from "@/lib/utils";
import {
  mlCookiesAction, mlLoginAction, runCycleAction, saveBotGeneralAction, saveNichesAction, saveSourceAction,
  testSourceAction, toggleSourceAction, type TestResult,
} from "@/server/actions/bot";
import { FormMessage, SubmitButton } from "./ui";

type Src = keyof BotSources;

/* ------------------------------ interruptor ------------------------------ */
export function Switch({ checked, onChange, disabled, label }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string;
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50",
        checked ? "bg-emerald-500" : "bg-ink/20")}>
      <span className={cn("inline-block h-5 w-5 rounded-full bg-white shadow transition", checked ? "translate-x-6" : "translate-x-1")} />
    </button>
  );
}

/* ------------------------------ ciclo agora ------------------------------ */
export function RunCycleButton({ disabled }: { disabled?: boolean }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionState>({});
  return (
    <div className="grid justify-items-end gap-2">
      <button type="button" className="btn-secondary" disabled={pending || disabled}
        onClick={() => start(async () => setState(await runCycleAction()))}>
        <Play className="h-4 w-4" /> {pending ? "Iniciando…" : "Rodar um ciclo agora"}
      </button>
      {(state.error || state.message) && (
        <p className={cn("max-w-sm text-right text-xs", state.error ? "text-red-700" : "text-emerald-700")}>{state.error ?? state.message}</p>
      )}
    </div>
  );
}

/* ------------------------------ geral ------------------------------ */
type General = {
  enabled: boolean; mode: "review" | "direct"; intervalMinutes: number; maxPerCycle: number; spacingSeconds: number;
  noRepeatDays: number; activeFrom: string; activeTo: string; minDiscount: number; maxDiscount: number;
  minPrice: string | null; maxPrice: string | null; blockedWords: string[];
};

const fromDb = (v: string | null) => (v ? Number(v).toFixed(2).replace(".", ",") : "");

export function GeneralForm({ initial }: { initial: General }) {
  const [state, action] = useActionState(saveBotGeneralAction, {});
  const [mode, setMode] = useState(initial.mode);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [allDay, setAllDay] = useState(initial.activeFrom === "00:00" && initial.activeTo === "24:00");

  return (
    <form action={action} className="grid gap-5">
      <FormMessage state={state} />

      <section className="card grid gap-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-bold">Robô ligado</h2>
            <p className="hint mt-0.5">Desligado, o coletor continua de pé (para importar links), mas não busca ofertas sozinho.</p>
          </div>
          <input type="hidden" name="enabled" value={enabled ? "on" : ""} />
          <Switch checked={enabled} onChange={setEnabled} label="Robô ligado" />
        </div>

        <fieldset className="grid gap-2">
          <legend className="label mb-1.5">Quando o robô achar uma oferta…</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ["review", ShieldCheck, "Esteira de aprovação", "Vai para Aprovação. Você revisa, edita se quiser e aprova; só então vai ao site e ao WhatsApp."],
              ["direct", Zap, "Publicar direto", "Vai direto para o site e para a fila do WhatsApp, sem passar por você."],
            ] as const).map(([key, I, title, desc]) => (
              <label key={key} className={cn("flex cursor-pointer gap-3 rounded-xl border-2 p-4 transition",
                mode === key ? "border-secondary bg-secondary/5" : "border-line hover:border-ink/30")}>
                <input type="radio" name="mode" value={key} checked={mode === key} onChange={() => setMode(key)} className="sr-only" />
                <I className={cn("mt-0.5 h-5 w-5 shrink-0", mode === key ? "text-secondary" : "text-ink-faint")} />
                <span>
                  <span className="block text-sm font-bold">{title}</span>
                  <span className="mt-0.5 block text-xs text-ink-muted">{desc}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="card grid gap-4 p-5 sm:p-6">
        <h2 className="font-bold">Ciclo de pesquisa</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="field">
            <label className="label" htmlFor="intervalMinutes">Buscar a cada (min)</label>
            <input className="input" id="intervalMinutes" name="intervalMinutes" type="number" min={5} max={1440} defaultValue={initial.intervalMinutes} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="maxPerCycle">Ofertas por ciclo</label>
            <input className="input" id="maxPerCycle" name="maxPerCycle" type="number" min={1} max={20} defaultValue={initial.maxPerCycle} required />
            <span className="hint">As melhores, alternando as lojas.</span>
          </div>
          <div className="field">
            <label className="label" htmlFor="spacingSeconds">Pausa entre ofertas (s)</label>
            <input className="input" id="spacingSeconds" name="spacingSeconds" type="number" min={0} max={3600} defaultValue={initial.spacingSeconds} required />
            <span className="hint">Só no modo direto.</span>
          </div>
          <div className="field">
            <label className="label" htmlFor="noRepeatDays">Não repetir produto por (dias)</label>
            <input className="input" id="noRepeatDays" name="noRepeatDays" type="number" min={1} max={90} defaultValue={initial.noRepeatDays} required />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[auto_1fr_1fr] sm:items-end">
          <label className="flex h-[42px] items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold">
            <input type="checkbox" name="allDay" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--c-secondary))]" />
            Buscar 24h
          </label>
          <div className="field">
            <label className="label" htmlFor="activeFrom">Buscar das</label>
            <input className="input" id="activeFrom" name="activeFrom" type="time" disabled={allDay}
              defaultValue={initial.activeTo === "24:00" ? "08:00" : initial.activeFrom} />
          </div>
          <div className="field">
            <label className="label" htmlFor="activeTo">até</label>
            <input className="input" id="activeTo" name="activeTo" type="time" disabled={allDay}
              defaultValue={initial.activeTo === "24:00" ? "23:00" : initial.activeTo} />
          </div>
        </div>
        <p className="hint -mt-2">Fora desse horário o robô não busca (evita mensagens de madrugada no grupo). Horário de Brasília do servidor.</p>
      </section>

      <section className="card grid gap-4 p-5 sm:p-6">
        <h2 className="font-bold">Filtros</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="field">
            <label className="label" htmlFor="minDiscount">Desconto mínimo (%)</label>
            <input className="input" id="minDiscount" name="minDiscount" type="number" min={0} max={99} defaultValue={initial.minDiscount} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="maxDiscount">Desconto máximo (%)</label>
            <input className="input" id="maxDiscount" name="maxDiscount" type="number" min={1} max={100} defaultValue={initial.maxDiscount} required />
            <span className="hint">Descontos absurdos costumam ser preço maquiado.</span>
          </div>
          <div className="field">
            <label className="label" htmlFor="minPrice">Preço mínimo (R$)</label>
            <input className="input" id="minPrice" name="minPrice" inputMode="decimal" defaultValue={fromDb(initial.minPrice)} placeholder="sem limite" />
          </div>
          <div className="field">
            <label className="label" htmlFor="maxPrice">Preço máximo (R$)</label>
            <input className="input" id="maxPrice" name="maxPrice" inputMode="decimal" defaultValue={fromDb(initial.maxPrice)} placeholder="sem limite" />
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="blockedWords">Palavras bloqueadas</label>
          <textarea className="input min-h-[84px]" id="blockedWords" name="blockedWords" defaultValue={initial.blockedWords.join(", ")}
            placeholder="capinha, película, adesivo" />
          <span className="hint">Separe por vírgula. Ofertas com essas palavras no título são ignoradas.</span>
        </div>
      </section>

      <div><SubmitButton className="btn-primary px-6">Salvar configurações</SubmitButton></div>
    </form>
  );
}

/* ------------------------------ lojas ------------------------------ */
const SOURCE_META: Record<Src, { name: string; dot: string; how: string }> = {
  mercadolivre: { name: "Mercado Livre", dot: "bg-yellow-400", how: "Lê a página de ofertas do ML e gera o link pelo Linkbuilder, com a sua conta logada." },
  amazon: { name: "Amazon", dot: "bg-orange-500", how: "Usa a Creators API quando sua conta tiver acesso; até lá, lê as páginas de busca. Link com a sua tag." },
  shopee: { name: "Shopee", dot: "bg-orange-600", how: "Open API oficial de afiliados: o link já vem com a sua comissão." },
};

type SourceStatus = { ok: boolean; msg: string; at: string } | undefined;

function TestPanel({ src }: { src: Src }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<(ActionState & { result?: TestResult }) | null>(null);
  return (
    <div className="grid gap-2">
      <button type="button" className="btn-ghost justify-self-start" disabled={pending}
        onClick={() => start(async () => setRes(await testSourceAction(src)))}>
        <FlaskConical className="h-4 w-4" /> {pending ? "Testando… (pode levar 1 min)" : "Testar busca"}
      </button>
      {res?.error && <p className="text-sm text-red-700">{res.error}</p>}
      {res?.result && (
        <div className="rounded-lg bg-surface-sunken p-3 text-xs">
          <p className="mb-1.5 font-semibold">{res.result.total} oferta(s) encontradas. As 5 com mais desconto:</p>
          <ul className="grid gap-1">
            {res.result.ofertas.slice(0, 5).map((o, i) => (
              <li key={i} className="flex gap-2">
                <span className="w-10 shrink-0 font-bold text-emerald-700">-{o.desconto ?? 0}%</span>
                <span className="truncate">{o.titulo}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SourceShell({ src, enabled, status, children }: {
  src: Src; enabled: boolean; status: SourceStatus; children: React.ReactNode;
}) {
  const meta = SOURCE_META[src];
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <section className={cn("card grid gap-4 p-5 sm:p-6", !on && "bg-surface")}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-bold"><span className={cn("h-2.5 w-2.5 rounded-full", meta.dot)} />{meta.name}</h3>
          <p className="hint mt-0.5">{meta.how}</p>
          {status && on && (
            <p className={cn("mt-1.5 text-xs font-medium", status.ok ? "text-emerald-700" : "text-red-700")}>
              {status.ok ? "✓" : "⚠"} {status.msg} · {new Date(status.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
            </p>
          )}
          {err && <p className="mt-1 text-xs text-red-700">{err}</p>}
        </div>
        <Switch checked={on} disabled={pending} label={`Integração ${meta.name}`}
          onChange={(v) => { setOn(v); setErr(null); start(async () => { const r = await toggleSourceAction(src, v); if (r.error) { setOn(!v); setErr(r.error); } }); }} />
      </div>
      {children}
    </section>
  );
}

function SecretField({ id, label, isSet, hint }: { id: string; label: string; isSet: boolean; hint?: string }) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>{label}</label>
      <input className="input font-mono text-xs" id={id} name={id} type="password" autoComplete="new-password"
        placeholder={isSet ? "•••••••• (salvo; deixe em branco para manter)" : ""} />
      {isSet ? (
        <label className="flex items-center gap-1.5 text-xs text-ink-muted"><input type="checkbox" name="clearSecret" /> apagar o segredo salvo</label>
      ) : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

function useSourceForm(src: Src) {
  return useActionState(saveSourceAction.bind(null, src), {});
}

export function MercadoLivreCard({ cfg, status, session, loginOpen, novncUrl, novncPort }: {
  cfg: BotSources["mercadolivre"]; status: SourceStatus; session?: boolean; loginOpen?: boolean; novncUrl: string; novncPort: number;
}) {
  const [state, action] = useSourceForm("mercadolivre");
  const [pending, start] = useTransition();
  const [login, setLogin] = useState<ActionState & { session?: boolean; open?: boolean; pwd?: string }>({ open: loginOpen, session });
  // O noVNC roda no coletor, numa porta própria do servidor. NOVNC_URL no compose
  // (ex.: http://192.168.0.10:6080) ou, sem ela, o mesmo endereço do painel na porta NOVNC_PORT.
  const [base, setBase] = useState(novncUrl);
  useEffect(() => { if (!novncUrl) setBase(`http://${window.location.hostname}:${novncPort}`); }, [novncUrl, novncPort]);
  const vncLink = (pwd?: string) => `${base.replace(/\/$/, "")}/vnc.html?autoconnect=1&resize=scale&password=${encodeURIComponent(pwd ?? "")}`;
  const [tab, setTab] = useState<"cookies" | "vnc">("cookies");
  const [cookieState, cookieAction] = useActionState(async (prev: ActionState, f: FormData) => {
    const r = await mlCookiesAction(prev, f);
    if (r.session !== undefined) setLogin((l) => ({ ...l, session: r.session }));
    return r;
  }, {});
  const open = () => start(async () => {
    const r = await mlLoginAction("iniciar");
    setLogin((l) => ({ ...r, open: !r.error, pwd: r.vncPassword, session: l.session }));
    if (!r.error) window.open(vncLink(r.vncPassword), "_blank");
  });

  return (
    <SourceShell src="mercadolivre" enabled={cfg.enabled} status={status}>
      <form action={action} className="grid gap-4">
        <FormMessage state={state} />
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <div className="field">
            <label className="label" htmlFor="etiqueta">Etiqueta em uso</label>
            <input className="input" id="etiqueta" name="etiqueta" defaultValue={cfg.etiqueta} placeholder="ex.: marquesofertas" />
            <span className="hint">Aparece no <a className="underline" href="https://www.mercadolivre.com.br/afiliados/linkbuilder" target="_blank" rel="noreferrer">Linkbuilder</a> do painel de afiliados.</span>
          </div>
          <div className="field">
            <label className="label" htmlFor="ml-paginas">Páginas por categoria</label>
            <input className="input" id="ml-paginas" name="paginas" type="number" min={1} max={5} defaultValue={cfg.paginas} />
          </div>
        </div>
        <div><SubmitButton className="btn-primary">Salvar</SubmitButton></div>
      </form>

      <div className="grid gap-3 rounded-xl border border-dashed border-line p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold">Login no Mercado Livre</p>
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold",
            login.session ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>
            {login.session ? "Sessão salva" : "Sem sessão"}
          </span>
        </div>
        <p className="hint">
          O link de afiliado do ML só sai com a sua conta logada. Faça o login uma vez; quando expirar, o status desta loja avisa e você repete.
        </p>

        <div className="flex gap-1 rounded-lg bg-surface-sunken p-1 text-sm font-semibold">
          {([["cookies", ClipboardPaste, "Pelo seu navegador"], ["vnc", Monitor, "Chrome do robô"]] as const).map(([k, I, label]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 transition",
                tab === k ? "bg-surface-raised shadow-sm" : "text-ink-muted hover:text-ink")}>
              <I className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {tab === "cookies" ? (
          <form action={cookieAction} className="grid gap-3">
            <ol className="grid list-decimal gap-1.5 pl-5 text-sm">
              <li>
                No seu Chrome (computador), instale a extensão{" "}
                <a className="font-semibold underline" target="_blank" rel="noreferrer"
                  href="https://chromewebstore.google.com/search/Cookie-Editor">Cookie-Editor</a>.
              </li>
              <li>
                Abra o{" "}
                <a className="font-semibold underline" target="_blank" rel="noreferrer" href="https://www.mercadolivre.com.br/afiliados/linkbuilder">Linkbuilder</a>{" "}
                e entre na sua conta.
              </li>
              <li>Com a página do Linkbuilder aberta, clique na extensão → <b>Export</b> → <b>JSON</b> (copia os cookies).</li>
              <li>Cole abaixo e clique em <b>Importar sessão</b>.</li>
            </ol>
            <textarea name="cookies" required className="input min-h-[90px] font-mono text-xs" placeholder='[{"domain":".mercadolivre.com.br","name":"ssid", …}]' />
            <p className="hint">Os cookies dão acesso à sua conta: só cole aqui, no seu painel. Não saia da conta no navegador, senão a sessão do robô cai junto.</p>
            <div><SubmitButton className="btn-primary" pendingText="Importando e conferindo…">Importar sessão</SubmitButton></div>
            {(cookieState.error || cookieState.message) && (
              <p className={cn("text-sm", cookieState.error ? "text-red-700" : "text-emerald-700")}>{cookieState.error ?? cookieState.message}</p>
            )}
          </form>
        ) : (
          <>
            <p className="hint">O Chrome do robô abre numa nova aba em {base || "…"} (precisa estar na mesma rede do servidor).</p>
            {!login.open ? (
              <button type="button" className="btn-ghost justify-self-start" disabled={pending} onClick={open}>
                <LogIn className="h-4 w-4" /> {pending ? "Abrindo o Chrome…" : "Abrir o Chrome do robô"}
              </button>
            ) : (
              <ol className="grid list-decimal gap-2 pl-5 text-sm">
                <li>
                  {login.pwd ? (
                    <a href={vncLink(login.pwd)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold underline">
                      Abrir o Chrome do coletor <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <button type="button" className="font-semibold underline" onClick={open}>Abrir o Chrome do coletor</button>
                  )}{" "}
                  (nova aba). Se a aba não abriu, clique no link.
                </li>
                <li>Entre na sua conta do Mercado Livre (senha, código etc.) até o Linkbuilder carregar logado.</li>
                <li>
                  Volte aqui e clique em{" "}
                  <button type="button" className="btn-primary ml-1 py-1.5" disabled={pending}
                    onClick={() => start(async () => { const r = await mlLoginAction("parar"); setLogin({ ...r, open: false, session: r.session }); })}>
                    <CheckCircle2 className="h-4 w-4" /> {pending ? "Conferindo…" : "Concluir login"}
                  </button>
                </li>
              </ol>
            )}
            {(login.error || login.message) && (
              <p className={cn("text-sm", login.error ? "text-red-700" : "text-emerald-700")}>{login.error ?? login.message}</p>
            )}
          </>
        )}
      </div>
      <TestPanel src="mercadolivre" />
    </SourceShell>
  );
}

export function AmazonCard({ cfg, status }: { cfg: BotSources["amazon"]; status: SourceStatus }) {
  const [state, action] = useSourceForm("amazon");
  return (
    <SourceShell src="amazon" enabled={cfg.enabled} status={status}>
      <form action={action} className="grid gap-4">
        <FormMessage state={state} />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="field">
            <label className="label" htmlFor="tag">Tag de associado</label>
            <input className="input" id="tag" name="tag" defaultValue={cfg.tag} placeholder="seunome-20" />
          </div>
          <div className="field">
            <label className="label" htmlFor="credentialId">Credential ID <span className="font-normal text-ink-faint">(opcional)</span></label>
            <input className="input font-mono text-xs" id="credentialId" name="credentialId" defaultValue={cfg.credentialId} />
          </div>
          <SecretField id="credentialSecret" label="Credential Secret" isSet={Boolean(cfg.credentialSecretEnc)} hint="Associates Central › Ferramentas › Creators API" />
        </div>
        <div className="grid gap-4 sm:grid-cols-[140px_160px_1fr]">
          <div className="field">
            <label className="label" htmlFor="az-paginas">Páginas</label>
            <input className="input" id="az-paginas" name="paginas" type="number" min={1} max={5} defaultValue={cfg.paginas} />
          </div>
          <div className="field">
            <label className="label" htmlFor="requisicoesPorCiclo">Buscas por ciclo</label>
            <input className="input" id="requisicoesPorCiclo" name="requisicoesPorCiclo" type="number" min={0} max={30} defaultValue={cfg.requisicoesPorCiclo} />
            <span className="hint">0 = todas de uma vez</span>
          </div>
          <div className="field">
            <label className="label" htmlFor="az-buscas">Termos extras <span className="font-normal text-ink-faint">(opcional)</span></label>
            <input className="input" id="az-buscas" name="buscas" defaultValue={cfg.buscas.join(", ")} placeholder="echo dot, air fryer" />
          </div>
        </div>
        <div><SubmitButton className="btn-primary">Salvar</SubmitButton></div>
      </form>
      <TestPanel src="amazon" />
    </SourceShell>
  );
}

export function ShopeeCard({ cfg, status }: { cfg: BotSources["shopee"]; status: SourceStatus }) {
  const [state, action] = useSourceForm("shopee");
  return (
    <SourceShell src="shopee" enabled={cfg.enabled} status={status}>
      <form action={action} className="grid gap-4">
        <FormMessage state={state} />
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_140px]">
          <div className="field">
            <label className="label" htmlFor="appId">App ID</label>
            <input className="input font-mono text-xs" id="appId" name="appId" defaultValue={cfg.appId} />
            <span className="hint">Painel de afiliados Shopee › Open API</span>
          </div>
          <SecretField id="appSecret" label="Secret" isSet={Boolean(cfg.appSecretEnc)} />
          <div className="field">
            <label className="label" htmlFor="limite">Produtos por ciclo</label>
            <input className="input" id="limite" name="limite" type="number" min={5} max={100} defaultValue={cfg.limite} />
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="sp-buscas">Palavras-chave extras <span className="font-normal text-ink-faint">(opcional)</span></label>
          <input className="input" id="sp-buscas" name="buscas" defaultValue={cfg.buscas.join(", ")} placeholder="fone bluetooth, tênis" />
          <span className="hint">Sem nichos e sem palavras, pega as ofertas em destaque da Shopee.</span>
        </div>
        <div><SubmitButton className="btn-primary">Salvar</SubmitButton></div>
      </form>
      <TestPanel src="shopee" />
    </SourceShell>
  );
}

/* ------------------------------ nichos ------------------------------ */
export function NichesForm({ selected }: { selected: string[] }) {
  const [state, action] = useActionState(saveNichesAction, {});
  const [sel, setSel] = useState(new Set(selected));
  const toggle = (k: string) => setSel((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  return (
    <form action={action} className="card grid gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">Nichos</h2>
          <p className="hint mt-0.5">Marque os assuntos do seu grupo. Nenhum marcado = ofertas de todas as categorias.</p>
        </div>
        {sel.size > 0 && <button type="button" className="text-xs font-semibold underline" onClick={() => setSel(new Set())}>Limpar</button>}
      </div>
      <FormMessage state={state} />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2">
        {NICHES.map((n) => (
          <label key={n.key} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border-2 px-3.5 py-3 text-sm font-semibold transition",
            sel.has(n.key) ? "border-secondary bg-secondary/5" : "border-line hover:border-ink/30")}>
            <input type="checkbox" name="niche" value={n.key} checked={sel.has(n.key)} onChange={() => toggle(n.key)} className="h-4 w-4 accent-[rgb(var(--c-secondary))]" />
            <span className="text-lg leading-none">{n.emoji}</span> {n.name}
          </label>
        ))}
      </div>
      <div><SubmitButton className="btn-primary">Salvar nichos</SubmitButton></div>
    </form>
  );
}
