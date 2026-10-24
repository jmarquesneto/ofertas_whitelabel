"use client";
import { useActionState, useState, useTransition } from "react";
import { Check, Copy, KeyRound, Lock, LockOpen, ShieldOff, Wand2 } from "lucide-react";
import { changeRoleAction, createUserAction, reset2faAction, resetPasswordAction, savePermissionsAction, toggleBlockAction } from "@/server/actions/users";
import { ADMIN_ONLY, PAGES, ROLES } from "@/lib/permissions";
import { cn, type ActionState } from "@/lib/utils";
import { FormMessage, SubmitButton } from "./ui";

const genPassword = () => {
  const a = "abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const r = new Uint32Array(14); crypto.getRandomValues(r);
  return Array.from(r, (n) => a[n % a.length]).join("");
};

export function CreateUserForm() {
  const [state, action] = useActionState(createUserAction, {});
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);
  return (
    <form action={action} className="card grid gap-4 p-5 sm:p-6" key={state.ok ? state.message : "f"}>
      <div>
        <h2 className="font-bold">Novo usuário</h2>
        <p className="text-sm text-ink-muted">No primeiro acesso a pessoa ativa o Google Authenticator e cria a própria senha.</p>
      </div>
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="field">
          <label className="label" htmlFor="nu-name">Nome</label>
          <input className="input" id="nu-name" name="name" required maxLength={120} />
        </div>
        <div className="field">
          <label className="label" htmlFor="nu-email">E-mail</label>
          <input className="input" id="nu-email" name="email" type="email" required maxLength={190} />
        </div>
        <div className="field">
          <label className="label" htmlFor="nu-password">Senha inicial</label>
          <div className="relative">
            <input className="input pr-20 font-mono" id="nu-password" name="password" type={show ? "text" : "password"} minLength={10} required value={pwd} onChange={(e) => setPwd(e.target.value)} />
            <button type="button" title="Gerar senha forte" aria-label="Gerar senha forte" onClick={() => { setPwd(genPassword()); setShow(true); }}
              className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"><Wand2 className="h-4 w-4" /></button>
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-10 top-1.5 h-8 rounded-md px-1.5 text-[11px] font-semibold text-ink-muted hover:text-ink">{show ? "ocultar" : "ver"}</button>
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="nu-role">Grupo</label>
          <select className="input" id="nu-role" name="role" defaultValue="poster">
            {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </div>
      </div>
      <div><SubmitButton className="btn-primary px-6" pendingText="Criando…">Criar usuário</SubmitButton></div>
    </form>
  );
}

/** Troca de grupo direto na linha da tabela */
export function RoleSelect({ id, role, disabled }: { id: number; role: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [value, setValue] = useState(role);
  return (
    <div>
      <select aria-label="Grupo" value={value} disabled={disabled || pending}
        onChange={(e) => {
          const next = e.target.value; const prev = value; setValue(next); setErr(null);
          start(async () => { const r = await changeRoleAction(id, next); if (r.error) { setErr(r.error); setValue(prev); } });
        }}
        className="input h-9 w-40 py-1.5 text-sm disabled:opacity-60">
        {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
      </select>
      {err && <p role="alert" className="mt-1 max-w-[12rem] text-xs text-red-700">{err}</p>}
    </div>
  );
}

/** Ações da linha: resetar senha (mostra a temporária), bloquear, resetar 2FA */
export function UserActions({ id, name, blocked, has2fa }: { id: number; name: string; blocked: boolean; has2fa: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(resetPasswordAction.bind(null, id), {} as ActionState);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const run = (fn: () => Promise<ActionState>, confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    setErr(null);
    start(async () => { const r = await fn(); if (r.error) setErr(r.error); });
  };
  const btn = "flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold transition hover:bg-surface-sunken disabled:opacity-50";
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-1.5">
        <button type="button" className={btn} onClick={() => setOpen((o) => !o)}><KeyRound className="h-3.5 w-3.5" /> Resetar senha</button>
        {has2fa && (
          <button type="button" disabled={pending} className={btn}
            onClick={() => run(() => reset2faAction(id), `Resetar o 2FA de ${name}? No próximo login ela terá que escanear um novo QR Code.`)}>
            <ShieldOff className="h-3.5 w-3.5" /> Resetar 2FA
          </button>
        )}
        <button type="button" disabled={pending}
          className={cn(btn, blocked ? "border-green-300 text-green-800 hover:bg-green-50" : "border-red-200 text-red-700 hover:bg-red-50")}
          onClick={() => run(() => toggleBlockAction(id), blocked ? `Desbloquear ${name}?` : `Bloquear ${name}? A pessoa é desconectada na hora e não consegue mais entrar.`)}>
          {blocked ? <><LockOpen className="h-3.5 w-3.5" /> Desbloquear</> : <><Lock className="h-3.5 w-3.5" /> Bloquear</>}
        </button>
      </div>
      {err && <p role="alert" className="text-xs text-red-700">{err}</p>}
      {open && (
        <form action={action} className="w-full max-w-sm rounded-xl border border-line bg-surface p-3 text-left">
          {state.ok ? (
            <div className="grid gap-2">
              <p className="text-xs text-ink-muted">Senha temporária de <b>{name}</b>. Envie por um canal seguro: ela será obrigada a trocar no próximo login.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-white px-3 py-2 font-mono text-sm font-bold ring-1 ring-line">{state.message}</code>
                <button type="button" className={btn} onClick={async () => { try { await navigator.clipboard.writeText(state.message ?? ""); } catch {} setCopied(true); }}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              {state.error && <p role="alert" className="text-xs text-red-700">{state.error}</p>}
              <label className="text-xs font-semibold" htmlFor={`np-${id}`}>Nova senha (vazio = gerar uma automaticamente)</label>
              <input id={`np-${id}`} name="newPassword" className="input h-9 py-1.5 font-mono text-sm" minLength={10} placeholder="gerar automaticamente" />
              <SubmitButton className="btn-primary py-2 text-xs" pendingText="Resetando…">Resetar e desconectar</SubmitButton>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

/** Matriz de permissões: o que cada grupo pode ver */
export function PermissionsMatrix({ granted }: { granted: Record<string, string[]> }) {
  const [state, action] = useActionState(savePermissionsAction, {});
  return (
    <form action={action} className="card overflow-hidden">
      <div className="p-5 pb-3 sm:p-6 sm:pb-3">
        <h2 className="font-bold">Permissões dos grupos</h2>
        <p className="text-sm text-ink-muted">Marque as páginas do painel que cada grupo pode acessar. Administrador sempre vê tudo; Usuários é exclusiva dele.</p>
      </div>
      <div className="px-5 sm:px-6"><FormMessage state={state} /></div>
      <div className="overflow-x-auto">
        <table className="mt-2 w-full min-w-[520px]">
          <thead className="bg-surface">
            <tr>
              <th className="table-head">Página</th>
              {ROLES.map((r) => <th key={r.key} className="table-head text-center">{r.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {PAGES.map((p) => {
              const locked = ADMIN_ONLY.includes(p.key);
              return (
                <tr key={p.key}>
                  <td className="table-cell font-semibold">{p.label}{locked && <span className="ml-2 text-xs font-normal text-ink-faint">só administrador</span>}</td>
                  {ROLES.map((r) => (
                    <td key={r.key} className="table-cell text-center">
                      {r.key === "admin" || locked ? (
                        <input type="checkbox" checked={r.key === "admin"} disabled aria-label={`${r.label} · ${p.label}`} className="h-4 w-4 opacity-60" />
                      ) : (
                        <input type="checkbox" name={`perm:${r.key}:${p.key}`} defaultChecked={granted[r.key]?.includes(p.key)} aria-label={`${r.label} · ${p.label}`} className="h-4 w-4 accent-[rgb(var(--c-secondary))]" />
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="p-5 sm:p-6"><SubmitButton className="btn-primary px-6">Salvar permissões</SubmitButton></div>
    </form>
  );
}
