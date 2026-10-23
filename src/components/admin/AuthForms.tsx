"use client";
import { useActionState } from "react";
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

export function TotpForm({ cta }: { cta: string }) {
  const [state, action] = useActionState(verifyTotpAction, {});
  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <div className="field">
        <label className="label" htmlFor="code">Código de 6 dígitos</label>
        <input
          className="input text-center font-mono text-2xl tracking-[0.5em]"
          id="code" name="code" inputMode="numeric" pattern="[0-9 ]{6,7}" maxLength={7}
          autoComplete="one-time-code" autoFocus required placeholder="000000"
        />
      </div>
      <SubmitButton className="btn-primary w-full py-3" pendingText="Verificando…">{cta}</SubmitButton>
    </form>
  );
}
