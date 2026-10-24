import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ExternalLink, LogOut, ShieldAlert } from "lucide-react";
import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { backupCodes, offers } from "@/db/schema";
import { allowedPages, requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { roleLabel } from "@/lib/permissions";
import { logoutAction } from "@/server/actions/auth";
import { AdminNav } from "@/components/admin/AdminNav";

export const metadata = { robots: { index: false, follow: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const [user, s] = await Promise.all([requireUser(), getSettings()]);
  const path = (await headers()).get("x-pathname") ?? "";

  // Senha resetada pelo administrador: só libera o painel depois de criar uma nova
  if (user.mustChangePassword && !path.startsWith("/admin/perfil")) redirect("/admin/perfil?trocar-senha=1");

  const [pages, [{ n: codesLeft }], [{ n: pending }]] = await Promise.all([
    allowedPages(user.role),
    db.select({ n: count() }).from(backupCodes).where(and(eq(backupCodes.userId, user.id), isNull(backupCodes.usedAt))),
    db.select({ n: count() }).from(offers).where(eq(offers.reviewStatus, "pending")),
  ]);

  return (
    <div className="min-h-screen bg-surface lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="bg-secondary p-4 text-secondary-fg lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:self-start lg:p-5">
        <a href="/admin" className="mb-4 block lg:mb-8">
          {s.logoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.logoPath} alt={s.siteName} className="h-10 w-auto max-w-[180px] object-contain" />
          ) : (
            <span className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-sm font-extrabold text-primary-fg">{s.siteName.charAt(0)}</span>
              <span className="truncate text-sm font-extrabold">{s.siteName}</span>
            </span>
          )}
          <span className="mt-1.5 block text-xs text-white/55">Painel administrativo</span>
        </a>
        <AdminNav allowed={pages} badges={{ approval: pending }} />
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-4 lg:mt-auto lg:block">
          <a href="/admin/perfil" className="flex min-w-0 items-center gap-2.5 rounded-xl p-1.5 transition hover:bg-white/10">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-bold">{user.name.charAt(0).toUpperCase()}</span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold">{user.name}</span>
              <span className="block truncate text-xs text-white/55">{roleLabel(user.role)} · Meu perfil</span>
            </span>
          </a>
          <div className="flex gap-2 lg:mt-3">
            <a href="/" target="_blank" className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/15">
              <ExternalLink className="h-3.5 w-3.5" /> Ver site
            </a>
            <form action={logoutAction}>
              <button className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/15">
                <LogOut className="h-3.5 w-3.5" /> Sair
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        {codesLeft === 0 && !path.startsWith("/admin/perfil") && (
          <a href="/admin/perfil#recuperacao" className="mb-5 flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span><b>Gere seus códigos de recuperação.</b> Sem eles, se perder o celular você não consegue entrar no painel.</span>
          </a>
        )}
        {children}
      </main>
    </div>
  );
}
