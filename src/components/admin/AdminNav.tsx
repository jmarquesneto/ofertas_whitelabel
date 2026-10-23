"use client";
import { usePathname } from "next/navigation";
import { BarChart3, GalleryHorizontal, Layers, Palette, Store, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Analytics", icon: BarChart3, exact: true },
  { href: "/admin/offers", label: "Ofertas", icon: Tag },
  { href: "/admin/banners", label: "Banners", icon: GalleryHorizontal },
  { href: "/admin/categories", label: "Categorias", icon: Layers },
  { href: "/admin/platforms", label: "Plataformas", icon: Store },
  { href: "/admin/settings", label: "Aparência", icon: Palette },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto scrollbar-none lg:flex-col">
      {items.map(({ href, label, icon: I, exact }) => {
        const active = exact ? path === href : path.startsWith(href);
        return (
          <a
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition",
              active ? "bg-primary text-primary-fg shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            <I className="h-[18px] w-[18px]" strokeWidth={2.2} />
            {label}
          </a>
        );
      })}
    </nav>
  );
}
