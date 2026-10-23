import { cn } from "@/lib/utils";

/** Logo da plataforma; sem logo, mostra as iniciais */
export function PlatformBadge({
  name, logo, size = "md", className,
}: { name: string; logo: string | null; size?: "xs" | "sm" | "md"; className?: string }) {
  const dim = { xs: "h-4 w-4 text-[7px]", sm: "h-5 w-5 text-[9px]", md: "h-7 w-7 text-[10px]" }[size];
  if (logo)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logo} alt="" className={cn(dim, "shrink-0 rounded bg-white object-contain", className)} />
    );
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span className={cn(dim, "inline-grid shrink-0 place-items-center rounded bg-ink font-bold text-white", className)} aria-hidden>
      {initials}
    </span>
  );
}
