import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SectionHeader({ title, href, id }: { title: string; href?: string; id?: string }) {
  return (
    <div id={id} className="mb-4 flex scroll-mt-6 items-end justify-between gap-4 sm:mb-5">
      <h2 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">{title}</h2>
      {href && (
        <Link href={href} className="flex shrink-0 items-center gap-1 text-sm font-semibold text-ink-muted transition hover:text-ink">
          Ver todas <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
