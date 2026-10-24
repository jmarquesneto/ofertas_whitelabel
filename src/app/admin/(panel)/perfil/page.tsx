import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { roleLabel } from "@/lib/permissions";
import { remainingBackupCodes } from "@/server/backup-codes";
import { PageHeader } from "@/components/admin/PageHeader";
import { BackupCodesCard, PasswordForm, ProfileDataForm, Reconfigure2faCard, SessionsCard } from "@/components/admin/ProfileForms";

export const metadata = { title: "Meu perfil" };
export const dynamic = "force-dynamic";

type SP = { "trocar-senha"?: string; "2fa-ativado"?: string; "usou-codigo"?: string; "sem-acesso"?: string };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<SP> }) {
  const [me, s, sp] = await Promise.all([requireUser(), getSettings(), searchParams]);
  const remaining = await remainingBackupCodes(me.id);
  const notice = sp["2fa-ativado"]
    ? "2FA ativado! Agora gere seus códigos de recuperação: é o único jeito de entrar se você perder o celular."
    : sp["usou-codigo"]
      ? `Você entrou com um código de recuperação (restam ${remaining}). Se trocou de celular, use "Reconfigurar Authenticator" logo abaixo.`
      : remaining === 0
        ? "Você ainda não tem códigos de recuperação."
        : undefined;

  return (
    <>
      <PageHeader title="Meu perfil" subtitle={`${me.email} · ${roleLabel(me.role)}`} />
      {sp["sem-acesso"] && (
        <p className="mb-4 rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink-muted">Seu grupo ainda não tem acesso a nenhuma página do painel. Fale com um administrador.</p>
      )}
      <div className="grid gap-5">
        <ProfileDataForm name={me.name} email={me.email} />
        {/* Mesmo lugar na árvore (não perde a mensagem ao salvar); quando obrigatória, sobe visualmente */}
        <PasswordForm forced={me.mustChangePassword} />
        <BackupCodesCard remaining={remaining} siteName={s.siteName} email={me.email} notice={notice} />
        <Reconfigure2faCard />
        <SessionsCard />
      </div>
    </>
  );
}
