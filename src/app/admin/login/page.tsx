import { redirect } from "next/navigation";
import { AuthShell } from "@/components/admin/AuthShell";
import { LoginForm } from "@/components/admin/AuthForms";
import { getCurrentUser } from "@/lib/auth";
import { registrationOpen } from "@/server/auth-helpers";

export const metadata = { title: "Entrar", robots: { index: false } };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/admin");
  const canRegister = await registrationOpen();
  return (
    <AuthShell title="Entrar no painel" subtitle="Depois da senha, pediremos o código do Google Authenticator.">
      <LoginForm />
      {canRegister && (
        <p className="mt-5 text-center text-sm text-ink-muted">
          Primeiro acesso? <a href="/admin/register" className="font-semibold text-secondary underline">Criar conta</a>
        </p>
      )}
    </AuthShell>
  );
}
