import { getSettings } from "@/lib/settings";

export async function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <main className="grid min-h-screen place-items-center bg-surface-sunken px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          {s.logoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.logoPath} alt="" className="h-9 w-auto" />
          ) : (
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary font-extrabold text-primary-fg">{s.siteName.charAt(0)}</span>
          )}
          <span className="text-sm font-semibold text-ink-muted">{s.siteName} · Painel</span>
        </div>
        <div className="card p-6 shadow-sm">
          <h1 className="text-xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
