import { AuthShell } from "@/components/admin/AuthShell";
import { RegisterForm } from "@/components/admin/AuthForms";
import { registrationOpen } from "@/server/auth-helpers";

export const metadata = { title: "Criar conta", robots: { index: false } };

export default async function RegisterPage() {
  if (!(await registrationOpen()))
    return (
      <AuthShell title="Cadastro fechado" subtitle="Este painel já tem um administrador. Peça para ele liberar o seu acesso.">
        <a href="/admin/login" className="btn-ghost w-full">Voltar para o login</a>
      </AuthShell>
    );
  return (
    <AuthShell title="Criar conta de administrador" subtitle="A autenticação em dois fatores é obrigatória.">
      <RegisterForm />
      <p className="mt-5 text-center text-sm text-ink-muted">
        Já tem conta? <a href="/admin/login" className="font-semibold text-secondary underline">Entrar</a>
      </p>
    </AuthShell>
  );
}
