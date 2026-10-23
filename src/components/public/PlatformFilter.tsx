import { PlatformBadge } from "./PlatformBadge";
import { cn } from "@/lib/utils";

type P = { id: number; name: string; slug: string; logoPath: string | null; n: number };

export function PlatformFilter({ platforms, active, q }: { platforms: P[]; active?: string; q?: string }) {
  const href = (slug?: string) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (slug) sp.set("p", slug);
    const s = sp.toString();
    return s ? `/?${s}` : "/";
  };
  const chip = "inline-flex shrink-0 items-center whitespace-nowrap gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition";
  const on = "border-secondary bg-secondary text-secondary-fg";
  const off = "border-line bg-surface-raised text-ink hover:border-ink-faint";

  return (
    <nav aria-label="Filtrar por plataforma" className="-mx-4 overflow-x-auto px-4 pb-1">
      <ul className="flex gap-2">
        <li>
          <a href={href()} className={cn(chip, !active ? on : off)} aria-current={!active ? "page" : undefined}>
            Todas
          </a>
        </li>
        {platforms.map((p) => (
          <li key={p.id}>
            <a href={href(p.slug)} className={cn(chip, active === p.slug ? on : off)} aria-current={active === p.slug ? "page" : undefined}>
              <PlatformBadge name={p.name} logo={p.logoPath} size="sm" />
              {p.name}
              <span className="text-xs opacity-70">{p.n}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
