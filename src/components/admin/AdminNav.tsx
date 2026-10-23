"use client";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Analytics", exact: true },
  { href: "/admin/offers", label: "Ofertas" },
  { href: "/admin/platforms", label: "Plataformas" },
  { href: "/admin/settings", label: "Aparência do site" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col">
      {items.map((i) => {
        const active = i.exact ? path === i.href : path.startsWith(i.href);
        return (
          <a
            key={i.href}
            href={i.href}
            className={cn(
              "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition",
              active ? "bg-secondary text-secondary-fg" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
            )}
            aria-current={active ? "page" : undefined}
          >
            {i.label}
          </a>
        );
      })}
    </nav>
  );
}
