import { ExternalLink, LogOut } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { logoutAction } from "@/server/actions/auth";
import { AdminNav } from "@/components/admin/AdminNav";

export const metadata = { robots: { index: false, follow: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const [user, s] = await Promise.all([requireAdmin(), getSettings()]);
  return (
    <div className="min-h-screen bg-surface lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="bg-secondary p-4 text-secondary-fg lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:p-5">
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
        <AdminNav />
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-4 lg:mt-auto lg:block">
          <p className="truncate text-xs text-white/55">{user.email}</p>
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
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
