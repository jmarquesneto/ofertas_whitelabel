"use client";
import { useActionState, useState } from "react";
import type { SiteSettings } from "@/db/schema";
import { updateSettingsAction } from "@/server/actions/settings";
import { FormMessage, SubmitButton } from "./ui";
import { ImageInput } from "./ImageInput";
import { onColor } from "@/lib/color";

const HEX = /^#[0-9A-Fa-f]{6}$/;

function ColorField({ name, label, value, onChange }: { name: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <label className="label" htmlFor={name}>{label}</label>
      <div className="flex gap-2">
        <input
          type="color" aria-label={`${label} (seletor)`}
          value={HEX.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-[42px] w-14 cursor-pointer rounded-lg border border-line bg-white p-1"
        />
        <input
          id={name} name={name} value={value} onChange={(e) => onChange(e.target.value)}
          className="input font-mono uppercase" pattern="#[0-9A-Fa-f]{6}" maxLength={7} required
        />
      </div>
    </div>
  );
}

export function SettingsForm({ settings }: { settings: SiteSettings }) {
  const [state, action] = useActionState(updateSettingsAction, {});
  const [name, setName] = useState(settings.siteName);
  const [primary, setPrimary] = useState(settings.primaryColor);
  const [secondary, setSecondary] = useState(settings.secondaryColor);
  const fg = (hex: string) => (HEX.test(hex) ? `rgb(${onColor(hex)})` : "#fff");

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="grid gap-6">
        <FormMessage state={state} />

        <fieldset className="card grid gap-4 p-5">
          <legend className="sr-only">Identidade</legend>
          <h2 className="font-semibold">Identidade</h2>
          <div className="field">
            <label className="label" htmlFor="siteName">Nome do site</label>
            <input className="input" id="siteName" name="siteName" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
          </div>
          <div className="field">
            <label className="label" htmlFor="tagline">Slogan <span className="font-normal text-ink-faint">(opcional)</span></label>
            <input className="input" id="tagline" name="tagline" defaultValue={settings.tagline ?? ""} maxLength={160} placeholder="As melhores ofertas de Salvador" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field">
              <label className="label" htmlFor="logo">Logo</label>
              <ImageInput className="input file:mr-3 file:rounded-md file:border-0 file:bg-surface-sunken file:px-3 file:py-1 file:text-sm" id="logo" name="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
              <span className="hint">PNG, SVG ou WEBP com fundo transparente. Altura exibida: 40px.</span>
              {settings.logoPath && (
                <label className="flex items-center gap-2 text-xs text-ink-muted"><input type="checkbox" name="removeLogo" /> Remover logo atual</label>
              )}
            </div>
            <div className="field">
              <label className="label" htmlFor="favicon">Favicon</label>
              <ImageInput className="input file:mr-3 file:rounded-md file:border-0 file:bg-surface-sunken file:px-3 file:py-1 file:text-sm" id="favicon" name="favicon" accept="image/png,image/x-icon,image/svg+xml,image/vnd.microsoft.icon" />
              <span className="hint">Quadrado, 512×512 PNG ou .ico.</span>
              {settings.faviconPath && (
                <label className="flex items-center gap-2 text-xs text-ink-muted"><input type="checkbox" name="removeFavicon" /> Remover favicon atual</label>
              )}
            </div>
          </div>
        </fieldset>

        <fieldset className="card grid gap-4 p-5">
          <legend className="sr-only">Cores</legend>
          <h2 className="font-semibold">Cores globais</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField name="primaryColor" label="Primária (botões de compra, destaques)" value={primary} onChange={setPrimary} />
            <ColorField name="secondaryColor" label="Secundária (busca, filtros, rodapé)" value={secondary} onChange={setSecondary} />
          </div>
          <p className="hint">A cor do texto sobre cada botão (branco ou escuro) é escolhida automaticamente para manter a leitura.</p>
        </fieldset>

        <fieldset className="card grid gap-4 p-5">
          <legend className="sr-only">Rodapé</legend>
          <h2 className="font-semibold">Rodapé · Aviso legal</h2>
          <textarea className="input min-h-[120px]" name="footerText" defaultValue={settings.footerText} required maxLength={2000} />
        </fieldset>

        <div><SubmitButton>Salvar configurações</SubmitButton></div>
      </div>

      {/* Pré-visualização ao vivo antes de salvar */}
      <aside className="lg:sticky lg:top-8 lg:self-start">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">Pré-visualização</p>
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line p-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg font-extrabold" style={{ background: primary, color: fg(primary) }}>{name.charAt(0)}</span>
            <span className="text-sm font-extrabold">{name || "Nome do site"}</span>
          </div>
          <div className="space-y-3 p-4">
            <div className="flex gap-2">
              <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: secondary, color: fg(secondary) }}>Todas</span>
              <span className="rounded-full border border-line px-3 py-1 text-xs">Shopee</span>
            </div>
            <div className="aspect-[4/3] rounded-lg bg-surface-sunken" />
            <p className="text-sm font-semibold">Fone Bluetooth com cancelamento de ruído</p>
            <div className="rounded-lg border border-dashed px-3 py-1.5 font-mono text-xs font-bold" style={{ borderColor: secondary, color: secondary }}>CUPOM10</div>
            <div className="rounded-lg py-2 text-center text-sm font-semibold" style={{ background: primary, color: fg(primary) }}>Ver oferta na loja</div>
          </div>
          <div className="p-3 text-[11px]" style={{ background: secondary, color: fg(secondary) }}>Aviso legal…</div>
        </div>
      </aside>
    </form>
  );
}
