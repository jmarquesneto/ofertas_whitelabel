import { cn } from "@/lib/utils";

/** Logo da plataforma; sem logo, mostra as iniciais */
export function PlatformBadge({
  name, logo, size = "md", className,
}: { name: string; logo: string | null; size?: "sm" | "md"; className?: string }) {
  const dim = size === "sm" ? "h-5 w-5 text-[9px]" : "h-7 w-7 text-[10px]";
  if (logo)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logo} alt={name} className={cn(dim, "rounded-md bg-white object-contain", className)} />
    );
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span className={cn(dim, "inline-grid place-items-center rounded-md bg-ink font-bold text-white", className)} aria-label={name}>
      {initials}
    </span>
  );
}
