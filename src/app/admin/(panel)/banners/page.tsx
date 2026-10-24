import { ArrowDown, ArrowUp, Copy, Image as ImageIcon, Pause, Pencil, Play, Trash2, Type } from "lucide-react";
import { requirePage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { listAllBanners } from "@/server/queries";
import { deleteBannerAction, duplicateBannerAction, moveBannerAction, toggleBannerAction } from "@/server/actions/banners";
import { PageHeader } from "@/components/admin/PageHeader";
import { IconAction } from "@/components/admin/ui";
import { BannerIntervalForm } from "@/components/admin/BannerIntervalForm";
import { cn, fmtDate } from "@/lib/utils";
import type { Banner } from "@/db/schema";

export const metadata = { title: "Banners" };
export const dynamic = "force-dynamic";

function status(b: Banner, now: Date) {
  if (!b.isActive) return { label: "Pausado", cls: "bg-surface-sunken text-ink-faint" };
  if (b.startsAt && b.startsAt > now) return { label: `Agendado · ${fmtDate(b.startsAt)}`, cls: "bg-blue-50 text-blue-800" };
  if (b.endsAt && b.endsAt <= now) return { label: "Encerrado", cls: "bg-red-50 text-red-800" };
  return { label: b.endsAt ? `No ar · até ${fmtDate(b.endsAt)}` : "No ar", cls: "bg-green-50 text-green-800" };
}

export default async function BannersPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requirePage("banners");
  const [list, settings, sp] = await Promise.all([listAllBanners(), getSettings(), searchParams]);
  const now = new Date();
  const live = list.filter((b) => status(b, now).label.startsWith("No ar")).length;

  return (
    <>
      <PageHeader
        title="Banners"
        subtitle={`Carrossel do topo da home · ${live} no ar agora. A ordem abaixo é a ordem de exibição.`}
        action={<a href="/admin/banners/new" className="btn-primary">+ Novo banner</a>}
      />
      {sp.saved && <p role="status" className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">Banner salvo.</p>}

      <div className="mb-4"><BannerIntervalForm value={settings.bannerIntervalSec} /></div>

      <div className="grid gap-3">
        {list.length === 0 && (
          <div className="card grid place-items-center gap-2 px-6 py-14 text-center">
            <p className="font-bold">Nenhum banner</p>
            <p className="text-sm text-ink-muted">Sem banners, a home começa direto nas ofertas.</p>
            <a href="/admin/banners/new" className="btn-primary mt-2">Criar o primeiro</a>
          </div>
        )}
        {list.map((b, k) => {
          const st = status(b, now);
          return (
            <div key={b.id} className={cn("card flex flex-wrap items-center gap-4 p-3 sm:flex-nowrap sm:p-4", !b.isActive && "opacity-70")}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-sunken text-sm font-bold text-ink-muted">{k + 1}</span>
              <Thumb b={b} bg={settings.secondaryColor} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-bold">
                  {b.kind === "image" ? <ImageIcon className="h-4 w-4 text-ink-faint" /> : <Type className="h-4 w-4 text-ink-faint" />}
                  <span className="truncate">{b.name}</span>
                </p>
                <p className="mt-0.5 truncate text-xs text-ink-faint">{b.kind === "image" ? (b.mobileImagePath ? "Arte computador + celular" : "Arte computador") : [b.headline, b.highlight].filter(Boolean).join(" ")}</p>
                <span className={cn("mt-1.5 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold", st.cls)}>{st.label}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <IconAction action={moveBannerAction.bind(null, b.id, "up")} label="Subir"><ArrowUp className="h-4 w-4" /></IconAction>
                <IconAction action={moveBannerAction.bind(null, b.id, "down")} label="Descer"><ArrowDown className="h-4 w-4" /></IconAction>
                <IconAction action={toggleBannerAction.bind(null, b.id)} label={b.isActive ? "Pausar" : "Ativar"}>
                  {b.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </IconAction>
                <IconAction action={duplicateBannerAction.bind(null, b.id)} label="Duplicar"><Copy className="h-4 w-4" /></IconAction>
                <a href={`/admin/banners/${b.id}`} title="Editar" aria-label="Editar" className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink"><Pencil className="h-4 w-4" /></a>
                <IconAction action={deleteBannerAction.bind(null, b.id)} label="Excluir" danger confirmText={`Excluir o banner "${b.name}"?`}><Trash2 className="h-4 w-4" /></IconAction>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Thumb({ b, bg }: { b: Banner; bg: string }) {
  if (b.kind === "image" && b.imagePath)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={b.imagePath} alt="" className="aspect-[16/5] w-40 shrink-0 rounded-lg object-cover ring-1 ring-line" />;
  return (
    <div className="flex aspect-[16/5] w-40 shrink-0 items-center gap-1 overflow-hidden rounded-lg px-2" style={{ background: b.bgColor ?? bg }}>
      <span className="line-clamp-2 flex-1 text-[9px] font-extrabold leading-tight text-white">{b.headline} <span className="text-primary">{b.highlight}</span></span>
      {b.imagePath && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.imagePath} alt="" className="h-9 w-auto object-contain" />
      )}
    </div>
  );
}
