"use client";
import { useActionState, useState } from "react";
import { ArrowRight, Image as ImageIcon, Type } from "lucide-react";
import type { Banner } from "@/db/schema";
import { onColor } from "@/lib/color";
import { cn, type ActionState } from "@/lib/utils";
import { FormMessage, SubmitButton } from "./ui";
import { ImageInput } from "./ImageInput";

const HEX = /^#[0-9A-Fa-f]{6}$/;
const fileCls = "input file:mr-3 file:rounded-md file:border-0 file:bg-surface-sunken file:px-3 file:py-1 file:text-sm";

/** Date → "2026-11-27T00:00" no fuso do site, para <input type="datetime-local"> */
function toLocalInput(d: Date | string | null | undefined, tz: string) {
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(d));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

export function BannerForm({
  action, initial, tz, secondary,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  initial?: Banner;
  tz: string;
  secondary: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const [kind, setKind] = useState<"text" | "image">((initial?.kind as "text" | "image") ?? "text");
  const [headline, setHeadline] = useState(initial?.headline ?? "");
  const [highlight, setHighlight] = useState(initial?.highlight ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [cta, setCta] = useState(initial?.ctaLabel ?? (initial ? "" : "Ver ofertas"));
  const [useBg, setUseBg] = useState(Boolean(initial?.bgColor));
  const [bg, setBg] = useState(initial?.bgColor ?? secondary);
  const bgFinal = useBg && HEX.test(bg) ? bg : secondary;

  return (
    <form action={formAction} className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="grid gap-5">
        <FormMessage state={state} />

        <fieldset className="card grid gap-4 p-5 sm:p-6">
          <legend className="contents"><h2 className="font-bold">Tipo de banner</h2></legend>
          <input type="hidden" name="kind" value={kind} />
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ["text", Type, "Texto", "Título, destaque, botão e imagem/mascote. As cores seguem a marca."],
              ["image", ImageIcon, "Imagem pronta", "Uma arte sua (feita no Canva, Photoshop…) com link."],
            ] as const).map(([k, I, t, d]) => (
              <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
                className={cn("flex gap-3 rounded-xl border-2 p-4 text-left transition", kind === k ? "border-secondary bg-primary/10" : "border-line hover:border-ink/30")}>
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg", kind === k ? "bg-primary text-primary-fg" : "bg-surface-sunken")}><I className="h-5 w-5" /></span>
                <span><span className="block font-bold">{t}</span><span className="block text-xs text-ink-muted">{d}</span></span>
              </button>
            ))}
          </div>
          <div className="field">
            <label className="label" htmlFor="name">Nome interno</label>
            <input className="input" id="name" name="name" defaultValue={initial?.name ?? ""} required maxLength={80} placeholder="Ex.: Black Friday 2026" />
            <span className="hint">Só aparece aqui no painel.</span>
          </div>
        </fieldset>

        {kind === "text" ? (
          <fieldset className="card grid gap-4 p-5 sm:p-6">
            <legend className="contents"><h2 className="font-bold">Conteúdo</h2></legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field">
                <label className="label" htmlFor="headline">Título</label>
                <input className="input" id="headline" name="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={120} placeholder="As melhores ofertas," />
              </div>
              <div className="field">
                <label className="label" htmlFor="highlight">Trecho destacado <span className="font-normal text-ink-faint">(cor primária)</span></label>
                <input className="input" id="highlight" name="highlight" value={highlight} onChange={(e) => setHighlight(e.target.value)} maxLength={80} placeholder="todos os dias!" />
              </div>
            </div>
            <div className="field">
              <label className="label" htmlFor="subtitle">Subtítulo</label>
              <textarea className="input min-h-[72px]" id="subtitle" name="subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={240} />
            </div>
            <div className="field">
              <label className="label" htmlFor="image">Imagem / mascote</label>
              <ImageInput className={fileCls} id="image" name="image" accept="image/png,image/webp,image/svg+xml,image/jpeg" />
              <span className="hint">PNG com fundo transparente, até 800×800.</span>
              {initial?.imagePath && <label className="flex items-center gap-2 text-xs text-ink-muted"><input type="checkbox" name="removeImage" /> Remover imagem atual</label>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" name="showBadges" defaultChecked={initial?.showBadges ?? true} className="h-4 w-4" /> Mostrar os selos (definidos em Aparência)
              </label>
              <div className="field">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" name="useBg" checked={useBg} onChange={(e) => setUseBg(e.target.checked)} className="h-4 w-4" /> Cor de fundo própria
                </label>
                {useBg && (
                  <div className="flex gap-2">
                    <input type="color" value={HEX.test(bg) ? bg : "#000000"} onChange={(e) => setBg(e.target.value.toUpperCase())} aria-label="Cor de fundo" className="h-[42px] w-14 cursor-pointer rounded-lg border border-line bg-white p-1" />
                    <input name="bgColor" value={bg} onChange={(e) => setBg(e.target.value)} className="input font-mono uppercase" maxLength={7} />
                  </div>
                )}
              </div>
            </div>
          </fieldset>
        ) : (
          <fieldset className="card grid gap-4 p-5 sm:p-6">
            <legend className="contents"><h2 className="font-bold">Arte</h2></legend>
            <input type="hidden" name="showBadges" value="" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field">
                <label className="label" htmlFor="image">Versão computador</label>
                <ImageInput className={fileCls} id="image" name="image" accept="image/png,image/jpeg,image/webp" />
                <span className="hint"><b>1920×600</b> (proporção 16:5). Deixe textos importantes no centro.</span>
                {initial?.imagePath && initial.kind === "image" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={initial.imagePath} alt="" className="mt-1 aspect-[16/5] w-full rounded-lg object-cover ring-1 ring-line" />
                )}
              </div>
              <div className="field">
                <label className="label" htmlFor="mobileImage">Versão celular <span className="font-normal text-ink-faint">(recomendado)</span></label>
                <ImageInput className={fileCls} id="mobileImage" name="mobileImage" accept="image/png,image/jpeg,image/webp" />
                <span className="hint"><b>1080×1080</b> (quadrada). Sem ela, o celular mostra a versão de computador reduzida.</span>
                {initial?.mobileImagePath && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={initial.mobileImagePath} alt="" className="mt-1 aspect-square w-32 rounded-lg object-cover ring-1 ring-line" />
                    <label className="flex items-center gap-2 text-xs text-ink-muted"><input type="checkbox" name="removeMobileImage" /> Remover versão celular</label>
                  </>
                )}
              </div>
            </div>
            <div className="field">
              <label className="label" htmlFor="headline">Texto alternativo <span className="font-normal text-ink-faint">(acessibilidade/SEO)</span></label>
              <input className="input" id="headline" name="headline" defaultValue={initial?.headline ?? ""} maxLength={120} placeholder="Black Friday: até 70% off em eletrônicos" />
            </div>
          </fieldset>
        )}

        <fieldset className="card grid gap-4 p-5 sm:p-6">
          <legend className="contents"><h2 className="font-bold">Link</h2></legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {kind === "text" && (
              <div className="field">
                <label className="label" htmlFor="ctaLabel">Texto do botão <span className="font-normal text-ink-faint">(vazio = sem botão)</span></label>
                <input className="input" id="ctaLabel" name="ctaLabel" value={cta} onChange={(e) => setCta(e.target.value)} maxLength={40} />
              </div>
            )}
            <div className={cn("field", kind === "image" && "sm:col-span-2")}>
              <label className="label" htmlFor="ctaUrl">{kind === "text" ? "Destino do botão" : "Ao clicar na arte, abrir"}</label>
              <input className="input" id="ctaUrl" name="ctaUrl" defaultValue={initial?.ctaUrl ?? (initial ? "" : "#ofertas")} maxLength={500} placeholder="#ofertas, /ofertas?cat=eletronicos ou https://…" />
              <span className="hint">Use <code>#ofertas</code> para rolar até as ofertas, ou um link do site como <code>/ofertas?cat=moda</code>.</span>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="openNewTab" defaultChecked={initial?.openNewTab ?? false} className="h-4 w-4" /> Abrir em nova aba</label>
        </fieldset>

        <fieldset className="card grid gap-4 p-5 sm:p-6">
          <legend className="contents"><h2 className="font-bold">Publicação</h2></legend>
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="field">
              <label className="label" htmlFor="startsAt">Começa em <span className="font-normal text-ink-faint">(opcional)</span></label>
              <input className="input" id="startsAt" name="startsAt" type="datetime-local" defaultValue={toLocalInput(initial?.startsAt, tz)} />
            </div>
            <div className="field">
              <label className="label" htmlFor="endsAt">Termina em <span className="font-normal text-ink-faint">(opcional)</span></label>
              <input className="input" id="endsAt" name="endsAt" type="datetime-local" defaultValue={toLocalInput(initial?.endsAt, tz)} />
            </div>
            <label className="flex h-[42px] items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold">
              <input type="checkbox" name="isActive" defaultChecked={initial?.isActive ?? true} className="h-4 w-4" /> Ativo
            </label>
          </div>
          <span className="hint">Sem datas, o banner fica no ar enquanto estiver ativo. Horário de {tz.replace("_", " ")}.</span>
        </fieldset>

        <div className="flex gap-2">
          <SubmitButton className="btn-primary px-6">Salvar banner</SubmitButton>
          <a href="/admin/banners" className="btn-ghost">Cancelar</a>
        </div>
      </div>

      <aside className="xl:sticky xl:top-8 xl:self-start">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-faint">Prévia</p>
        {kind === "text" ? (
          <div className="overflow-hidden rounded-2xl p-5 shadow-card" style={{ background: bgFinal, color: `rgb(${onColor(bgFinal)})` }}>
            <p className="text-xl font-extrabold leading-tight">{headline || "Título do banner"} <span className="text-primary">{highlight}</span></p>
            {subtitle && <p className="mt-2 text-xs opacity-75">{subtitle}</p>}
            {cta && <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-primary-fg">{cta} <ArrowRight className="h-3 w-3" /></span>}
            {initial?.imagePath && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={initial.imagePath} alt="" className="ml-auto mt-2 max-h-28 w-auto object-contain" />
            )}
          </div>
        ) : (
          <div className="grid aspect-[16/5] place-items-center rounded-2xl bg-surface-sunken text-xs text-ink-faint ring-1 ring-line">
            {initial?.imagePath && initial.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={initial.imagePath} alt="" className="h-full w-full rounded-2xl object-cover" />
            ) : "A arte aparece aqui depois de salvar"}
          </div>
        )}
      </aside>
    </form>
  );
}
