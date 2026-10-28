"use client";
import { useActionState } from "react";
import type { ActionState } from "@/lib/utils";
import { FormMessage, SubmitButton } from "./ui";
import { ImageInput } from "./ImageInput";

type Initial = {
  name: string; logoPath: string | null; isActive: boolean; sortOrder: number;
  couponBannerPath: string | null; couponUrl: string | null;
};

export function PlatformForm({
  action, initial,
}: { action: (s: ActionState, f: FormData) => Promise<ActionState>; initial?: Initial }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="card grid max-w-xl gap-4 p-5">
      <FormMessage state={state} />
      <div className="field">
        <label className="label" htmlFor="name">Nome da plataforma</label>
        <input className="input" id="name" name="name" defaultValue={initial?.name} required maxLength={80} placeholder="Shopee" />
      </div>
      <div className="field">
        <label className="label" htmlFor="logo">Logo</label>
        {initial?.logoPath && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={initial.logoPath} alt="Logo atual" className="h-12 w-12 rounded-lg border border-line bg-white object-contain p-1" />
        )}
        <ImageInput id="logo" name="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
        <span className="hint">Quadrado, fundo transparente ou branco. Exibido em 20–28px.</span>
      </div>
      <fieldset className="grid gap-4 rounded-xl border border-dashed border-line p-4">
        <legend className="px-1 text-sm font-bold">Cupons desta loja</legend>
        <div className="field">
          <label className="label" htmlFor="couponBanner">Banner de cupons</label>
          {initial?.couponBannerPath && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={initial.couponBannerPath} alt="Banner atual" className="aspect-[16/9] w-full max-w-sm rounded-lg border border-line bg-white object-cover" />
          )}
          <ImageInput id="couponBanner" name="couponBanner" accept="image/png,image/jpeg,image/webp" />
          <span className="hint">Vai como imagem na mensagem de cupons do WhatsApp e no topo da loja em /cupons. Ideal: 1200×675 (16:9). Sem banner, usa o logo.</span>
          {initial?.couponBannerPath && (
            <label className="flex items-center gap-2 text-sm text-ink-muted"><input type="checkbox" name="removeCouponBanner" /> Remover banner atual</label>
          )}
        </div>
        <div className="field">
          <label className="label" htmlFor="couponUrl">Link de afiliado da loja <span className="font-normal text-ink-faint">(opcional)</span></label>
          <input className="input font-mono text-xs" id="couponUrl" name="couponUrl" type="url" defaultValue={initial?.couponUrl ?? ""} placeholder="https://s.shopee.com.br/…" />
          <span className="hint">Para onde leva o “Teste o cupom através deste link” (página de cupons ou home da loja com o seu link de afiliado). Sem ele, o link vai para /cupons do site.</span>
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field">
          <label className="label" htmlFor="sortOrder">Ordem nos filtros</label>
          <input className="input" id="sortOrder" name="sortOrder" type="number" min={0} defaultValue={initial?.sortOrder ?? 0} />
        </div>
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={initial?.isActive ?? true} className="h-4 w-4 accent-[rgb(var(--c-secondary))]" />
          Ativa (aparece na vitrine)
        </label>
      </div>
      <div className="flex gap-2">
        <SubmitButton>Salvar plataforma</SubmitButton>
        <a href="/admin/platforms" className="btn-ghost">Cancelar</a>
      </div>
    </form>
  );
}
