"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, House, LayoutGrid, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFavorites } from "@/lib/client/favorites";

const items = [
  { href: "/", label: "Início", icon: House, match: (p: string) => p === "/" },
  { href: "/ofertas", label: "Ofertas", icon: Tag, match: (p: string) => p.startsWith("/ofertas") || p.startsWith("/oferta/") },
  { href: "/categorias", label: "Categorias", icon: LayoutGrid, match: (p: string) => p.startsWith("/categorias") },
  { href: "/favoritos", label: "Favoritos", icon: Heart, match: (p: string) => p.startsWith("/favoritos") },
];

/** Barra inferior fixa no celular */
export function MobileNav() {
  const path = usePathname();
  const favs = useFavorites().length;
  return (
    <nav aria-label="Navegação" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
      <ul className="grid grid-cols-4">
        {items.map(({ href, label, icon: I, match }) => {
          const on = match(path);
          return (
            <li key={href}>
              <Link href={href} className={cn("relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold", on ? "text-ink" : "text-ink-faint")}>
                <span className={cn("grid h-8 w-12 place-items-center rounded-full transition", on && "bg-primary/25")}>
                  <I className="h-5 w-5" strokeWidth={on ? 2.5 : 2} />
                </span>
                {label}
                {href === "/favoritos" && favs > 0 && (
                  <span className="absolute right-[22%] top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-fg">{favs}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
