import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { logoutAction } from "@/server/actions/auth";
import { AdminNav } from "@/components/admin/AdminNav";

export const metadata = { robots: { index: false, follow: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const [user, s] = await Promise.all([requireAdmin(), getSettings()]);
  return (
    <div className="min-h-screen bg-surface lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-line bg-surface-raised p-4 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="mb-4 flex items-center justify-between gap-3 lg:mb-8 lg:block">
          <a href="/admin" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-sm font-extrabold text-primary-fg">
              {s.siteName.charAt(0)}
            </span>
            <span className="text-sm font-bold leading-tight">{s.siteName}<span className="block text-xs font-normal text-ink-muted">Painel</span></span>
          </a>
        </div>
        <AdminNav />
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-4 lg:absolute lg:bottom-4 lg:left-4 lg:right-4 lg:block">
          <p className="truncate text-xs text-ink-muted">{user.email}</p>
          <div className="flex gap-2 lg:mt-3">
            <a href="/" target="_blank" className="btn-ghost px-3 py-1.5 text-xs">Ver site</a>
            <form action={logoutAction}><button className="btn-ghost px-3 py-1.5 text-xs">Sair</button></form>
          </div>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl p-4 sm:p-8">{children}</main>
    </div>
  );
}
