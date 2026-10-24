"use client";
import { useActionState, useState } from "react";
import { Check, Copy, Download, KeyRound, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { changePasswordAction, generateBackupCodesAction, logoutOthersAction, reconfigure2faAction, updateProfileAction } from "@/server/actions/profile";
import type { ActionState } from "@/lib/utils";
import { FormMessage, SubmitButton } from "./ui";

export function ProfileDataForm({ name, email }: { name: string; email: string }) {
  const [state, action] = useActionState(updateProfileAction, {});
  const [mail, setMail] = useState(email);
  const changed = mail.trim().toLowerCase() !== email.toLowerCase();
  return (
    <form action={action} className="card grid gap-4 p-5 sm:p-6">
      <h2 className="font-bold">Seus dados</h2>
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field">
          <label className="label" htmlFor="pf-name">Nome</label>
          <input className="input" id="pf-name" name="name" defaultValue={name} required maxLength={120} />
        </div>
        <div className="field">
          <label className="label" htmlFor="pf-email">E-mail (login)</label>
          <input className="input" id="pf-email" name="email" type="email" value={mail} onChange={(e) => setMail(e.target.value)} required maxLength={190} />
        </div>
      </div>
      {changed && (
        <div className="field max-w-sm">
          <label className="label" htmlFor="pf-cur">Senha atual <span className="font-normal text-ink-faint">(para trocar o e-mail)</span></label>
          <input className="input" id="pf-cur" name="currentPassword" type="password" autoComplete="current-password" required />
        </div>
      )}
      <div><SubmitButton className="btn-primary px-6">Salvar dados</SubmitButton></div>
    </form>
  );
}

export function PasswordForm({ forced }: { forced: boolean }) {
  const [state, action] = useActionState(changePasswordAction, {});
  return (
    <form action={action} id="senha" className={`card grid scroll-mt-6 gap-4 p-5 sm:p-6 ${forced && !state.ok ? "order-first ring-2 ring-primary" : ""}`}>
      <div>
        <h2 className="flex items-center gap-2 font-bold"><KeyRound className="h-5 w-5" /> Trocar senha</h2>
        {forced && !state.ok && <p className="mt-1 text-sm font-semibold text-amber-900">Sua senha foi redefinida por um administrador. Crie uma nova para continuar usando o painel.</p>}
      </div>
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="field">
          <label className="label" htmlFor="pw-cur">{forced ? "Senha temporária" : "Senha atual"}</label>
          <input className="input" id="pw-cur" name="current" type="password" autoComplete="current-password" required />
        </div>
        <div className="field">
          <label className="label" htmlFor="pw-new">Nova senha</label>
          <input className="input" id="pw-new" name="password" type="password" minLength={10} autoComplete="new-password" required />
          <span className="hint">Mínimo de 10 caracteres.</span>
        </div>
        <div className="field">
          <label className="label" htmlFor="pw-conf">Confirmar nova senha</label>
          <input className="input" id="pw-conf" name="confirm" type="password" autoComplete="new-password" required />
        </div>
      </div>
      <div><SubmitButton className="btn-primary px-6" pendingText="Salvando…">Salvar nova senha</SubmitButton></div>
    </form>
  );
}

export function BackupCodesCard({ remaining, siteName, email, notice }: { remaining: number; siteName: string; email: string; notice?: string }) {
  const [state, action] = useActionState(generateBackupCodesAction, {} as ActionState & { codes?: string[] });
  const [copied, setCopied] = useState(false);
  const codes = state.codes;
  const text = codes ? `Códigos de recuperação — ${siteName}\nConta: ${email}\nCada código funciona uma única vez.\n\n${codes.join("\n")}\n` : "";
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "codigos-recuperacao.txt" });
    a.click(); URL.revokeObjectURL(url);
  };
  return (
    <section id="recuperacao" className="card grid scroll-mt-6 gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-bold"><ShieldCheck className="h-5 w-5" /> Códigos de recuperação do 2FA</h2>
          <p className="mt-1 max-w-xl text-sm text-ink-muted">Se perder o celular, entre com um destes códigos no lugar do Google Authenticator. Cada um vale uma vez. Guarde num gerenciador de senhas ou impresso.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${remaining > 2 ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900"}`}>
          {remaining} de 10 disponíveis
        </span>
      </div>
      {notice && !codes && <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{notice}</p>}
      {state.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>}

      {codes ? (
        <div className="grid gap-3">
          <p className="text-sm font-semibold text-amber-900">Anote agora: estes códigos não aparecem de novo. Os anteriores deixaram de valer.</p>
          <ol className="grid grid-cols-2 gap-2 rounded-xl bg-surface p-4 font-mono text-sm font-bold sm:grid-cols-5">
            {codes.map((c) => <li key={c} className="rounded-lg bg-white px-3 py-2 text-center ring-1 ring-line">{c}</li>)}
          </ol>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={download} className="btn-primary"><Download className="h-4 w-4" /> Baixar .txt</button>
            <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(text); } catch {} setCopied(true); }} className="btn-ghost">
              {copied ? <><Check className="h-4 w-4" /> Copiado</> : <><Copy className="h-4 w-4" /> Copiar</>}
            </button>
          </div>
        </div>
      ) : (
        <form action={action} className="flex flex-wrap items-end gap-3">
          <div className="field">
            <label className="label" htmlFor="bc-cur">Confirme sua senha</label>
            <input className="input w-64" id="bc-cur" name="current" type="password" autoComplete="current-password" required />
          </div>
          <SubmitButton className="btn-primary" pendingText="Gerando…">{remaining > 0 ? "Gerar novos códigos" : "Gerar códigos"}</SubmitButton>
        </form>
      )}
    </section>
  );
}

export function SessionsCard() {
  const [state, action] = useActionState(logoutOthersAction, {});
  return (
    <form action={action} className="card flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
      <div>
        <h2 className="flex items-center gap-2 font-bold"><LogOut className="h-5 w-5" /> Aparelhos conectados</h2>
        <p className="mt-1 text-sm text-ink-muted">Esqueceu o painel aberto em outro computador? Desconecte todos, menos este.</p>
        {state.ok && <p role="status" className="mt-2 text-sm font-semibold text-green-700">{state.message}</p>}
      </div>
      <SubmitButton className="btn-ghost" pendingText="…">Sair dos outros aparelhos</SubmitButton>
    </form>
  );
}

export function Reconfigure2faCard() {
  const [state, action] = useActionState(reconfigure2faAction, {});
  const [open, setOpen] = useState(false);
  return (
    <section className="card grid gap-3 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-bold"><Smartphone className="h-5 w-5" /> Trocou de celular?</h2>
          <p className="mt-1 text-sm text-ink-muted">Reconfigure o Google Authenticator no aparelho novo. O antigo deixa de funcionar e os códigos de recuperação são apagados.</p>
        </div>
        {!open && <button type="button" onClick={() => setOpen(true)} className="btn-ghost">Reconfigurar Authenticator</button>}
      </div>
      {open && (
        <form action={action} className="flex flex-wrap items-end gap-3">
          {state.error && <p role="alert" className="w-full text-sm text-red-700">{state.error}</p>}
          <div className="field">
            <label className="label" htmlFor="r2-cur">Confirme sua senha</label>
            <input className="input w-64" id="r2-cur" name="current" type="password" autoComplete="current-password" required />
          </div>
          <SubmitButton className="btn-primary" pendingText="…">Continuar para o QR Code</SubmitButton>
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancelar</button>
        </form>
      )}
    </section>
  );
}
