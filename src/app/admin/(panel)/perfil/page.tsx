import { desc, eq } from "drizzle-orm";
import { Chrome, Download } from "lucide-react";
import { db } from "@/db";
import { apiTokens } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { revokeExtensionAction } from "@/server/actions/profile";
import { ActionButton } from "@/components/admin/ui";
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
  const [remaining, exts] = await Promise.all([
    remainingBackupCodes(me.id),
    db.select().from(apiTokens).where(eq(apiTokens.userId, me.id)).orderBy(desc(apiTokens.createdAt)),
  ]);
  const quando = (d: Date | null) => (d ? d.toLocaleString("pt-BR", { timeZone: "America/Bahia", dateStyle: "short", timeStyle: "short" }) : "nunca");
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
        <section id="extensao" className="card grid gap-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-bold"><Chrome className="h-5 w-5" /> Extensão do Chrome</h2>
              <p className="mt-1 max-w-2xl text-sm text-ink-muted">
                Publique ofertas direto da página do produto no Mercado Livre, Amazon ou Shopee, com o seu link de afiliado.
                Entre na extensão com o seu e-mail, senha e o código do 2FA.
              </p>
            </div>
            <a href="/admin/perfil/extensao" className="btn-primary shrink-0"><Download className="h-4 w-4" /> Baixar extensão</a>
          </div>
          <ol className="grid list-decimal gap-1 pl-5 text-sm text-ink-muted">
            <li>Descompacte o arquivo baixado numa pasta que você não vai apagar.</li>
            <li>No Chrome, abra <code className="rounded bg-surface-sunken px-1">chrome://extensions</code> e ligue o <b>Modo do desenvolvedor</b> (canto superior direito).</li>
            <li>Clique em <b>Carregar sem compactação</b> e escolha a pasta descompactada.</li>
            <li>Fixe o ícone na barra (quebra-cabeça → alfinete), abra um produto e clique nele.</li>
          </ol>
          <div>
            <p className="mb-2 text-sm font-semibold">Extensões conectadas</p>
            {exts.length === 0 ? (
              <p className="rounded-lg bg-surface-sunken px-3 py-2 text-sm text-ink-muted">Nenhuma ainda.</p>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {exts.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-ink-muted">Conectada em {quando(t.createdAt)} · último uso {quando(t.lastUsedAt)}</p>
                    </div>
                    <ActionButton action={revokeExtensionAction.bind(null, t.id)} className="btn-danger px-3 py-1.5 text-xs" confirmText="Desconectar esta extensão?">
                      Desconectar
                    </ActionButton>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-ink-faint">“Sair dos outros aparelhos”, troca de senha e bloqueio também desconectam as extensões.</p>
          </div>
        </section>
      </div>
    </>
  );
}
