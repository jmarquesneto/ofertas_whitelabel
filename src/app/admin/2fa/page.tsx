import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { AuthShell } from "@/components/admin/AuthShell";
import { TotpForm } from "@/components/admin/AuthForms";
import { PRE_COOKIE, verifyToken, type PreClaims } from "@/lib/session";
import { getOrCreateTotpSetup } from "@/server/auth-helpers";

export const metadata = { title: "Verificação em duas etapas", robots: { index: false } };

export default async function TwoFactorPage() {
  const pre = await verifyToken<PreClaims>((await cookies()).get(PRE_COOKIE)?.value);
  if (!pre) redirect("/admin/login");

  if (pre.stage === "totp")
    return (
      <AuthShell title="Verificação em duas etapas" subtitle="Abra o Google Authenticator e digite o código atual.">
        <TotpForm cta="Entrar" allowBackup />
      </AuthShell>
    );

  // stage === "setup": primeira vez → mostra o QR Code
  const setup = await getOrCreateTotpSetup(Number(pre.sub));
  if (!setup) redirect("/admin/login");
  const qr = await QRCode.toDataURL(setup.uri, { margin: 1, width: 220 });
  const pretty = setup.secret.match(/.{1,4}/g)?.join(" ");

  return (
    <AuthShell title="Ative o Google Authenticator" subtitle="Obrigatório para acessar o painel.">
      <p className="mb-3 text-sm text-ink-muted">
        1. No app Google Authenticator (ou Authy, 1Password…), toque em <b className="text-ink">+</b> e escaneie:
      </p>
      <div className="mb-4 grid place-items-center rounded-xl border border-line bg-white p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR Code para o aplicativo autenticador" width={220} height={220} />
      </div>
      <details className="mb-5 text-sm">
        <summary className="cursor-pointer text-ink-muted">Não consegue escanear? Digite a chave</summary>
        <code className="mt-2 block break-all rounded-lg bg-surface-sunken px-3 py-2 font-mono text-xs">{pretty}</code>
        <span className="hint mt-1 block">Conta: {setup.email} · Tipo: baseado em tempo</span>
      </details>
      <p className="mb-3 text-sm text-ink-muted">2. Digite o código que aparece no app:</p>
      <TotpForm cta="Ativar e entrar" />
    </AuthShell>
  );
}
