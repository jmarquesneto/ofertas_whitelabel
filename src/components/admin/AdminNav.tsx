"use client";
import { usePathname } from "next/navigation";
import { BarChart3, Bot, GalleryHorizontal, Inbox, Layers, MessageCircle, Palette, Store, Tag, Ticket, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PageKey } from "@/lib/permissions";

const items: { key: PageKey; href: string; label: string; icon: typeof Tag; exact?: boolean }[] = [
  { key: "analytics", href: "/admin", label: "Analytics", icon: BarChart3, exact: true },
  { key: "offers", href: "/admin/offers", label: "Ofertas", icon: Tag },
  { key: "approval", href: "/admin/aprovacao", label: "Aprovação", icon: Inbox },
  { key: "coupons", href: "/admin/cupons", label: "Cupons", icon: Ticket },
  { key: "banners", href: "/admin/banners", label: "Banners", icon: GalleryHorizontal },
  { key: "categories", href: "/admin/categories", label: "Categorias", icon: Layers },
  { key: "platforms", href: "/admin/platforms", label: "Plataformas", icon: Store },
  { key: "bot", href: "/admin/robo", label: "Robô", icon: Bot },
  { key: "whatsapp", href: "/admin/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "settings", href: "/admin/settings", label: "Aparência", icon: Palette },
  { key: "users", href: "/admin/users", label: "Usuários", icon: Users },
];

export function AdminNav({ allowed, badges = {} }: { allowed: PageKey[]; badges?: Partial<Record<PageKey, number>> }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto scrollbar-none lg:flex-col">
      {items.filter((i) => allowed.includes(i.key)).map(({ key, href, label, icon: I, exact }) => {
        const active = exact ? path === href : path.startsWith(href);
        return (
          <a key={href} href={href} aria-current={active ? "page" : undefined}
            className={cn("flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition",
              active ? "bg-primary text-primary-fg shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white")}>
            <I className="h-[18px] w-[18px]" strokeWidth={2.2} />
            {label}
            {!!badges[key] && (
              <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[11px] font-extrabold tabular-nums",
                active ? "bg-secondary text-secondary-fg" : "bg-primary text-primary-fg")}>{badges[key]}</span>
            )}
          </a>
        );
      })}
    </nav>
  );
}
