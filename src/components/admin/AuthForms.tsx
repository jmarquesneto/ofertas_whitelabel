"use client";
import { useActionState, useState } from "react";
import { loginAction, registerAction, verifyTotpAction } from "@/server/actions/auth";
import { FormMessage, SubmitButton } from "./ui";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, {});
  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <div className="field">
        <label className="label" htmlFor="email">E-mail</label>
        <input className="input" id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="field">
        <label className="label" htmlFor="password">Senha</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <SubmitButton className="btn-primary w-full py-3" pendingText="Entrando…">Continuar</SubmitButton>
    </form>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, {});
  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <div className="field">
        <label className="label" htmlFor="name">Nome</label>
        <input className="input" id="name" name="name" autoComplete="name" required />
      </div>
      <div className="field">
        <label className="label" htmlFor="email">E-mail</label>
        <input className="input" id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="field">
        <label className="label" htmlFor="password">Senha</label>
        <input className="input" id="password" name="password" type="password" minLength={10} autoComplete="new-password" required />
        <span className="hint">Mínimo de 10 caracteres.</span>
      </div>
      <div className="field">
        <label className="label" htmlFor="confirm">Confirmar senha</label>
        <input className="input" id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </div>
      <SubmitButton className="btn-primary w-full py-3" pendingText="Criando…">Criar conta e configurar 2FA</SubmitButton>
    </form>
  );
}

export function TotpForm({ cta, allowBackup = false }: { cta: string; allowBackup?: boolean }) {
  const [state, action] = useActionState(verifyTotpAction, {});
  const [backup, setBackup] = useState(false);
  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      {backup ? (
        <div className="field">
          <label className="label" htmlFor="code">Código de recuperação</label>
          <input key="backup" className="input text-center font-mono text-xl uppercase tracking-[0.2em]" id="code" name="code"
            maxLength={9} autoComplete="off" autoFocus required placeholder="XXXX-XXXX" />
          <span className="hint">Um dos 10 códigos que você guardou. Cada código funciona uma única vez.</span>
        </div>
      ) : (
        <div className="field">
          <label className="label" htmlFor="code">Código de 6 dígitos</label>
          <input key="totp"
            className="input text-center font-mono text-2xl tracking-[0.5em]"
            id="code" name="code" inputMode="numeric" pattern="[0-9 ]{6,7}" maxLength={7}
            autoComplete="one-time-code" autoFocus required placeholder="000000"
          />
        </div>
      )}
      <SubmitButton className="btn-primary w-full py-3" pendingText="Verificando…">{cta}</SubmitButton>
      {allowBackup && (
        <button type="button" onClick={() => setBackup((b) => !b)} className="text-center text-sm font-semibold text-ink-muted underline hover:text-ink">
          {backup ? "Voltar para o código do aplicativo" : "Perdi o celular: usar código de recuperação"}
        </button>
      )}
    </form>
  );
}
