"use client";
import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/utils";
import { FormMessage, SubmitButton } from "./ui";

// Mesma regra do servidor (lib/slug.ts) — aqui só para pré-visualizar a URL
const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

type Initial = {
  platformId: number; title: string; description: string | null; affiliateUrl: string;
  coupon: string | null; imagePath: string | null; slug: string; isActive: boolean; expiresAt: Date;
};

export function OfferForm({
  action, platforms, initial, siteUrl, defaultHours,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  platforms: { id: number; name: string }[];
  initial?: Initial;
  siteUrl: string;
  defaultHours: number;
}) {
  const [state, formAction] = useActionState(action, {});
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imagePath?.startsWith("http") ? initial.imagePath : "");
  const isEdit = Boolean(initial);
  const previewSlug = slug ? slugify(slug) : slugify(title) || "sua-oferta";

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="grid gap-6">
        <FormMessage state={state} />

        <fieldset className="card grid gap-4 p-5">
          <h2 className="font-semibold">Produto</h2>
          <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
            <div className="field">
              <label className="label" htmlFor="platformId">Plataforma</label>
              <select className="input" id="platformId" name="platformId" defaultValue={initial?.platformId ?? ""} required>
                <option value="" disabled>Selecione…</option>
                {platforms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="title">Título</label>
              <input className="input" id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} placeholder="Fone Bluetooth JBL Tune 520BT" />
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="description">Descrição <span className="font-normal text-ink-faint">(opcional)</span></label>
            <textarea className="input min-h-[84px]" id="description" name="description" defaultValue={initial?.description ?? ""} maxLength={2000} placeholder="De R$ 299 por R$ 189 · frete grátis" />
          </div>
        </fieldset>

        <fieldset className="card grid gap-4 p-5">
          <h2 className="font-semibold">Link e cupom</h2>
          <div className="field">
            <label className="label" htmlFor="affiliateUrl">Link bruto de afiliado</label>
            <input className="input font-mono text-xs" id="affiliateUrl" name="affiliateUrl" type="url" defaultValue={initial?.affiliateUrl} required placeholder="https://s.shopee.com.br/…" />
            <span className="hint">O visitante nunca vê este link: ele acessa o endereço curto abaixo e é redirecionado.</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field">
              <label className="label" htmlFor="slug">Endereço curto</label>
              <input className="input" id="slug" name="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="gerado automaticamente" maxLength={110} />
              <span className="hint break-all font-mono">{siteUrl}/{previewSlug}</span>
            </div>
            <div className="field">
              <label className="label" htmlFor="coupon">Cupom <span className="font-normal text-ink-faint">(opcional)</span></label>
              <input className="input font-mono uppercase" id="coupon" name="coupon" defaultValue={initial?.coupon ?? ""} maxLength={60} placeholder="CUPOM10" />
            </div>
          </div>
        </fieldset>

        <fieldset className="card grid gap-4 p-5">
          <h2 className="font-semibold">Imagem</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field">
              <label className="label" htmlFor="image">Enviar arquivo</label>
              <input className="input" id="image" name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
            </div>
            <div className="field">
              <label className="label" htmlFor="imageUrl">…ou URL da imagem</label>
              <input className="input" id="imageUrl" name="imageUrl" type="url" value={imageUrl ?? ""} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…/produto.jpg" />
            </div>
          </div>
          {isEdit && initial?.imagePath && (
            <label className="flex items-center gap-2 text-sm text-ink-muted"><input type="checkbox" name="removeImage" /> Remover imagem atual</label>
          )}
        </fieldset>

        <fieldset className="card grid gap-4 p-5">
          <h2 className="font-semibold">Publicação</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field">
              <label className="label" htmlFor="hours">{isEdit ? "Renovar validade por (horas)" : "Validade (horas)"}</label>
              <input className="input" id="hours" name="hours" type="number" min={1} max={720} defaultValue={isEdit ? "" : defaultHours} placeholder={isEdit ? "deixe em branco para manter" : String(defaultHours)} />
              {isEdit && initial && (
                <span className="hint">Expira em {new Date(initial.expiresAt).toLocaleString("pt-BR")}</span>
              )}
            </div>
            <label className="flex items-center gap-2 self-end pb-2.5 text-sm">
              <input type="checkbox" name="isActive" defaultChecked={initial?.isActive ?? true} className="h-4 w-4" />
              Publicada
            </label>
          </div>
        </fieldset>

        <div className="flex gap-2">
          <SubmitButton>{isEdit ? "Salvar alterações" : "Publicar oferta"}</SubmitButton>
          <a href="/admin/offers" className="btn-ghost">Cancelar</a>
        </div>
      </div>

      <aside className="lg:sticky lg:top-8 lg:self-start">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">Como aparece</p>
        <div className="card overflow-hidden">
          <div className="grid aspect-square place-items-center bg-surface-sunken">
            {imageUrl || initial?.imagePath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl || initial?.imagePath || ""} alt="" className="h-full w-full object-contain p-4 mix-blend-multiply" />
            ) : (
              <span className="text-sm text-ink-faint">sem imagem</span>
            )}
          </div>
          <div className="space-y-3 p-4">
            <p className="line-clamp-2 text-[15px] font-semibold">{title || "Título da oferta"}</p>
            <div className="btn-primary w-full">Ver oferta na loja</div>
          </div>
        </div>
      </aside>
    </form>
  );
}
