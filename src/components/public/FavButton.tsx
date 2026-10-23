"use client";
import { Heart } from "lucide-react";
import { toggleFavorite, useFavorites } from "@/lib/client/favorites";
import { cn } from "@/lib/utils";

export function FavButton({ id, className, size = "md" }: { id: number; className?: string; size?: "md" | "lg" }) {
  const on = useFavorites().includes(id);
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); toggleFavorite(id); }}
      aria-pressed={on}
      aria-label={on ? "Remover dos favoritos" : "Salvar nos favoritos"}
      className={cn(
        "grid place-items-center rounded-full bg-white/95 text-ink shadow-sm ring-1 ring-black/5 transition hover:scale-105",
        size === "lg" ? "h-11 w-11" : "h-9 w-9",
        className,
      )}
    >
      <Heart className={cn(size === "lg" ? "h-5 w-5" : "h-[18px] w-[18px]", on && "fill-red-500 text-red-500")} strokeWidth={2} />
    </button>
  );
}

export function FavCount() {
  const n = useFavorites().length;
  if (!n) return null;
  return (
    <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-fg">
      {n}
    </span>
  );
}
