import Link from "next/link";
import { Icon } from "@/components/Icon";
import type { CategoryNode } from "@/server/queries";

export function CategoryCircles({ tree }: { tree: CategoryNode[] }) {
  return (
    <ul className="-mx-4 flex gap-3 overflow-x-auto scrollbar-none px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-4 sm:overflow-visible sm:px-0 md:grid-cols-6 lg:grid-cols-8">
      {tree.map((c) => (
        <li key={c.id} className="shrink-0">
          <Link href={`/ofertas?cat=${c.slug}`} className="group flex w-20 flex-col items-center gap-2 text-center sm:w-auto">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-surface-raised text-ink shadow-card ring-1 ring-line/70 transition group-hover:-translate-y-0.5 group-hover:bg-primary group-hover:text-primary-fg sm:h-[72px] sm:w-[72px]">
              <Icon name={c.icon} className="h-7 w-7" />
            </span>
            <span className="text-xs font-semibold leading-tight text-ink sm:text-[13px]">{c.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
