"use client";
import { useActionState, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import type { SiteSettings } from "@/db/schema";
import { updateSettingsAction } from "@/server/actions/settings";
import { FormMessage, SubmitButton } from "./ui";
import { ImageInput } from "./ImageInput";
import { onColor } from "@/lib/color";
import { ICONS, Icon } from "@/components/Icon";

const HEX = /^#[0-9A-Fa-f]{6}$/;
const fileCls = "input file:mr-3 file:rounded-md file:border-0 file:bg-surface-sunken file:px-3 file:py-1 file:text-sm";

function ColorField({ name, label, hint, value, onChange }: { name: string; label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <label className="label" htmlFor={name}>{label}</label>
      <div className="flex gap-2">
        <input type="color" aria-label={`${label} (seletor)`} value={HEX.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-[42px] w-14 cursor-pointer rounded-lg border border-line bg-white p-1" />
        <input id={name} name={name} value={value} onChange={(e) => onChange(e.target.value)}
          className="input font-mono uppercase" pattern="#[0-9A-Fa-f]{6}" maxLength={7} required />
      </div>
      <span className="hint">{hint}</span>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <fieldset className="card grid gap-4 p-5 sm:p-6">
      <legend className="contents">
        <span className="block">
          <span className="block font-bold">{title}</span>
          {desc && <span className="mt-0.5 block text-sm text-ink-muted">{desc}</span>}
        </span>
      </legend>
      {children}
    </fieldset>
  );
}

export function SettingsForm({ settings }: { settings: SiteSettings }) {
  const [state, action] = useActionState(updateSettingsAction, {});
  const [name, setName] = useState(settings.siteName);
  const [primary, setPrimary] = useState(settings.primaryColor);
  const [secondary, setSecondary] = useState(settings.secondaryColor);
  const [heroTitle, setHeroTitle] = useState(settings.heroTitle);
  const [heroHighlight, setHeroHighlight] = useState(settings.heroHighlight);
  const [heroSubtitle, setHeroSubtitle] = useState(settings.heroSubtitle);
  const badges = [0, 1, 2].map((i) => settings.heroBadges?.[i] ?? { icon: "tag", label: "" });
  const [badgeState, setBadgeState] = useState(badges);
  const fg = (hex: string) => (HEX.test(hex) ? `rgb(${onColor(hex)})` : "#fff");
  const P = HEX.test(primary) ? primary : "#FFC107";
  const S = HEX.test(secondary) ? secondary : "#111827";

  return (
    <form action={action} className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div className="grid gap-5">
        <FormMessage state={state} />

        <Section title="Identidade" desc="Nome, logo e ícone da aba do navegador.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field">
              <label className="label" htmlFor="siteName">Nome do site</label>
              <input className="input" id="siteName" name="siteName" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
            </div>
            <div className="field">
              <label className="label" htmlFor="tagline">Slogan <span className="font-normal text-ink-faint">(opcional)</span></label>
              <input className="input" id="tagline" name="tagline" defaultValue={settings.tagline ?? ""} maxLength={160} placeholder="Seu destino para boas ofertas!" />
            </div>
            <div className="field">
              <label className="label" htmlFor="logo">Logo</label>
              <ImageInput className={fileCls} id="logo" name="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
              <span className="hint">PNG ou SVG com fundo transparente, que funcione sobre fundo escuro.</span>
              {settings.logoPath && <label className="flex items-center gap-2 text-xs text-ink-muted"><input type="checkbox" name="removeLogo" /> Remover logo atual</label>}
            </div>
            <div className="field">
              <label className="label" htmlFor="favicon">Favicon</label>
              <ImageInput className={fileCls} id="favicon" name="favicon" accept="image/png,image/x-icon,image/svg+xml,image/vnd.microsoft.icon" />
              <span className="hint">Quadrado, 512×512 PNG ou .ico.</span>
              {settings.faviconPath && <label className="flex items-center gap-2 text-xs text-ink-muted"><input type="checkbox" name="removeFavicon" /> Remover favicon atual</label>}
            </div>
          </div>
        </Section>

        <Section title="Cores" desc="O texto sobre cada cor (branco ou escuro) é escolhido sozinho para manter a leitura.">
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField name="primaryColor" label="Primária" hint="Botões de compra, destaques e descontos." value={primary} onChange={setPrimary} />
            <ColorField name="secondaryColor" label="Secundária" hint="Cabeçalho, hero, rodapé e filtros ativos." value={secondary} onChange={setSecondary} />
          </div>
        </Section>

        <Section title="Destaque da home (hero)" desc="O primeiro bloco que o visitante vê.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field">
              <label className="label" htmlFor="heroTitle">Título</label>
              <input className="input" id="heroTitle" name="heroTitle" value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} required maxLength={120} />
            </div>
            <div className="field">
              <label className="label" htmlFor="heroHighlight">Trecho destacado <span className="font-normal text-ink-faint">(na cor primária)</span></label>
              <input className="input" id="heroHighlight" name="heroHighlight" value={heroHighlight} onChange={(e) => setHeroHighlight(e.target.value)} maxLength={80} />
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="heroSubtitle">Subtítulo</label>
            <textarea className="input min-h-[72px]" id="heroSubtitle" name="heroSubtitle" value={heroSubtitle} onChange={(e) => setHeroSubtitle(e.target.value)} maxLength={240} />
          </div>
          <div className="field">
            <label className="label" htmlFor="heroImage">Imagem / mascote</label>
            <ImageInput className={fileCls} id="heroImage" name="heroImage" accept="image/png,image/webp,image/svg+xml,image/jpeg" />
            <span className="hint">PNG com fundo transparente, de preferência quadrado (até 800×800). Também aparece na faixa de afiliados.</span>
            {settings.heroImagePath && <label className="flex items-center gap-2 text-xs text-ink-muted"><input type="checkbox" name="removeHeroImage" /> Remover imagem atual</label>}
          </div>
          <div className="field">
            <span className="label">Selos ao lado do hero <span className="font-normal text-ink-faint">(deixe o texto vazio para esconder)</span></span>
            <div className="grid gap-2">
              {badgeState.map((b, i) => (
                <div key={i} className="flex gap-2">
                  <select name={`badgeIcon${i}`} value={b.icon} aria-label={`Ícone do selo ${i + 1}`}
                    onChange={(e) => setBadgeState((s) => s.map((x, j) => (j === i ? { ...x, icon: e.target.value } : x)))}
                    className="input w-40 shrink-0">
                    {Object.entries(ICONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-lg bg-surface-sunken"><Icon name={b.icon} className="h-5 w-5" /></span>
                  <input name={`badgeLabel${i}`} value={b.label} maxLength={40} aria-label={`Texto do selo ${i + 1}`} placeholder="Ex.: Lojas verificadas"
                    onChange={(e) => setBadgeState((s) => s.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                    className="input" />
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Faixa de afiliados" desc="Bloco de transparência no fim da home, explicando como o site ganha comissão.">
          <div className="field">
            <label className="label" htmlFor="affiliateTitle">Título</label>
            <input className="input" id="affiliateTitle" name="affiliateTitle" defaultValue={settings.affiliateTitle} required maxLength={120} />
          </div>
          <div className="field">
            <label className="label" htmlFor="affiliateText">Texto</label>
            <textarea className="input min-h-[90px]" id="affiliateText" name="affiliateText" defaultValue={settings.affiliateText} required maxLength={600} />
          </div>
        </Section>

        <Section title="Rodapé · Aviso legal">
          <textarea className="input min-h-[110px]" name="footerText" aria-label="Aviso legal" defaultValue={settings.footerText} required maxLength={2000} />
        </Section>

        <div><SubmitButton className="btn-primary px-6">Salvar aparência</SubmitButton></div>
      </div>

      {/* Prévia ao vivo */}
      <aside className="xl:sticky xl:top-8 xl:self-start">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-faint">Prévia</p>
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <div className="space-y-3 p-4" style={{ background: S, color: fg(S) }}>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg text-sm font-extrabold" style={{ background: P, color: fg(P) }}>{name.charAt(0) || "?"}</span>
              <span className="text-sm font-extrabold">{name || "Nome do site"}</span>
            </div>
            <div className="flex h-8 items-center justify-between rounded-full bg-white pl-3 pr-1 text-[11px] text-gray-400">
              O que você está procurando?
              <span className="grid h-6 w-6 place-items-center rounded-full" style={{ background: P, color: fg(P) }}><Search className="h-3 w-3" /></span>
            </div>
            <div className="pt-2">
              <p className="text-lg font-extrabold leading-tight">{heroTitle} <span style={{ color: P }}>{heroHighlight}</span></p>
              <p className="mt-1 line-clamp-2 text-[11px] opacity-75">{heroSubtitle}</p>
              <span className="mt-3 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold" style={{ background: P, color: fg(P) }}>Ver ofertas <ArrowRight className="h-3 w-3" /></span>
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              {badgeState.filter((b) => b.label.trim()).map((b, i) => (
                <span key={i} className="flex items-center gap-1.5 text-[10px] font-semibold">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10" style={{ color: P }}><Icon name={b.icon} className="h-3.5 w-3.5" /></span>{b.label}
                </span>
              ))}
            </div>
          </div>
          <div className="p-4">
            <div className="rounded-xl bg-white p-3 shadow-card">
              <div className="aspect-[4/3] rounded-lg bg-surface-sunken" />
              <p className="mt-2 text-xs font-semibold">Fone Bluetooth JBL Tune</p>
              <p className="text-[10px] text-gray-400 line-through">R$ 459,90</p>
              <p className="text-base font-extrabold text-price">R$ 299,90</p>
              <div className="mt-2 rounded-lg py-1.5 text-center text-[11px] font-bold" style={{ background: P, color: fg(P) }}>Ver oferta →</div>
            </div>
          </div>
        </div>
      </aside>
    </form>
  );
}
