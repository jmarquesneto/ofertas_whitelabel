import { getSettings } from "@/lib/settings";
import { Logo } from "@/components/public/Logo";
import { ShieldCheck } from "lucide-react";

export async function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-secondary px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full bg-primary/[0.08] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 h-[380px] w-[380px] rounded-full bg-primary/[0.05] blur-3xl" />
      <div className="relative w-full max-w-[400px]">
        <div className="mb-6 flex justify-center"><Logo settings={s} dark /></div>
        <div className="rounded-3xl bg-white p-6 shadow-lift sm:p-8">
          <h1 className="text-xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-white/55">
          <ShieldCheck className="h-3.5 w-3.5" /> Acesso protegido com verificação em duas etapas
        </p>
      </div>
    </main>
  );
}
