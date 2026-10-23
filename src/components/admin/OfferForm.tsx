"use client";
import { useActionState, useState } from "react";
import { ArrowRight, Star } from "lucide-react";
import { discountPct, fmtBRL, type ActionState } from "@/lib/utils";
import { FormMessage, SubmitButton } from "./ui";
import { ImageInput } from "./ImageInput";

// Mesma regra do servidor (lib/slug.ts) — aqui só para pré-visualizar a URL
const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

/** "1.849,90" → 1849.9 (só para a prévia) */
const toNum = (v: string) => {
  const raw = v.replace(/R\$|\s/g, "");
  if (!raw) return null;
  const n = Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);
  return Number.isFinite(n) ? n : null;
};
const fromDb = (v: string | null | undefined) => (v ? Number(v).toFixed(2).replace(".", ",") : "");

type Initial = {
  platformId: number; categoryId: number | null; title: string; description: string | null; affiliateUrl: string;
  coupon: string | null; imagePath: string | null; slug: string; isActive: boolean; isFeatured: boolean;
  price: string | null; originalPrice: string | null; expiresAt: Date;
};
type Cat = { id: number; name: string; parentId: number | null };

export function OfferForm({
  action, platforms, categories, initial, siteUrl, defaultHours,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  platforms: { id: number; name: string }[];
  categories: Cat[];
  initial?: Initial;
  siteUrl: string;
  defaultHours: number;
}) {
  const [state, formAction] = useActionState(action, {});
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [price, setPrice] = useState(fromDb(initial?.price));
  const [original, setOriginal] = useState(fromDb(initial?.originalPrice));
  const [coupon, setCoupon] = useState(initial?.coupon ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imagePath?.startsWith("http") ? initial.imagePath : "");
  const isEdit = Boolean(initial);
  const previewSlug = slug ? slugify(slug) : slugify(title) || "sua-oferta";
  const pct = discountPct(toNum(price), toNum(original));
  const roots = categories.filter((c) => !c.parentId);

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="grid gap-5">
        <FormMessage state={state} />

        <fieldset className="card grid gap-4 p-5 sm:p-6">
          <legend className="contents"><h2 className="font-bold">Produto</h2></legend>
          <div className="field">
            <label className="label" htmlFor="title">Título</label>
            <input className="input" id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} placeholder="Fone Bluetooth JBL Tune 520BT" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field">
              <label className="label" htmlFor="platformId">Plataforma</label>
              <select className="input" id="platformId" name="platformId" defaultValue={initial?.platformId ?? ""} required>
                <option value="" disabled>Selecione…</option>
                {platforms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="categoryId">Categoria</label>
              <select className="input" id="categoryId" name="categoryId" defaultValue={initial?.categoryId ?? ""}>
                <option value="">Sem categoria</option>
                {roots.map((r) => {
                  const subs = categories.filter((c) => c.parentId === r.id);
                  return (
                    <optgroup key={r.id} label={r.name}>
                      <option value={r.id}>{r.name} (geral)</option>
                      {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </optgroup>
                  );
                })}
              </select>
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="description">Descrição <span className="font-normal text-ink-faint">(opcional)</span></label>
            <textarea className="input min-h-[84px]" id="description" name="description" defaultValue={initial?.description ?? ""} maxLength={2000} placeholder="Frete grátis, 12x sem juros, cor preta…" />
          </div>
        </fieldset>

        <fieldset className="card grid gap-4 p-5 sm:p-6">
          <legend className="contents"><h2 className="font-bold">Preço</h2></legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="field">
              <label className="label" htmlFor="originalPrice">De <span className="font-normal text-ink-faint">(opcional)</span></label>
              <input className="input" id="originalPrice" name="originalPrice" inputMode="decimal" value={original} onChange={(e) => setOriginal(e.target.value)} placeholder="2.999,90" />
            </div>
            <div className="field">
              <label className="label" htmlFor="price">Por</label>
              <input className="input" id="price" name="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="1.849,90" />
            </div>
            <div className="field">
              <span className="label">Desconto</span>
              <span className="flex h-[42px] items-center rounded-lg bg-surface-sunken px-3 text-sm font-bold">
                {pct ? <span className="rounded bg-primary px-1.5 py-0.5 text-primary-fg">-{pct}%</span> : <span className="font-normal text-ink-faint">calculado sozinho</span>}
              </span>
            </div>
          </div>
        </fieldset>

        <fieldset className="card grid gap-4 p-5 sm:p-6">
          <legend className="contents"><h2 className="font-bold">Link e cupom</h2></legend>
          <div className="field">
            <label className="label" htmlFor="affiliateUrl">Link de afiliado</label>
            <input className="input font-mono text-xs" id="affiliateUrl" name="affiliateUrl" type="url" defaultValue={initial?.affiliateUrl} required placeholder="https://s.shopee.com.br/…" />
            <span className="hint">O visitante nunca vê este link: ele passa pelo endereço curto abaixo, que conta o clique.</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field">
              <label className="label" htmlFor="slug">Endereço curto</label>
              <input className="input" id="slug" name="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="gerado a partir do título" maxLength={110} />
              <span className="hint break-all font-mono">{siteUrl}/{previewSlug}</span>
            </div>
            <div className="field">
              <label className="label" htmlFor="coupon">Cupom <span className="font-normal text-ink-faint">(opcional)</span></label>
              <input className="input font-mono uppercase" id="coupon" name="coupon" value={coupon} onChange={(e) => setCoupon(e.target.value)} maxLength={60} placeholder="CUPOM10" />
            </div>
          </div>
        </fieldset>

        <fieldset className="card grid gap-4 p-5 sm:p-6">
          <legend className="contents"><h2 className="font-bold">Imagem</h2></legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field">
              <label className="label" htmlFor="image">Enviar arquivo</label>
              <ImageInput id="image" name="image" accept="image/png,image/jpeg,image/webp,image/gif" />
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

        <fieldset className="card grid gap-4 p-5 sm:p-6">
          <legend className="contents"><h2 className="font-bold">Publicação</h2></legend>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <div className="field">
              <label className="label" htmlFor="hours">{isEdit ? "Renovar validade por (horas)" : "Validade (horas)"}</label>
              <input className="input" id="hours" name="hours" type="number" min={1} max={720} defaultValue={isEdit ? "" : defaultHours} placeholder={isEdit ? "em branco = manter" : String(defaultHours)} />
              {isEdit && initial && <span className="hint">Expira em {new Date(initial.expiresAt).toLocaleString("pt-BR")}</span>}
            </div>
            <label className="flex h-[42px] items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold">
              <input type="checkbox" name="isFeatured" defaultChecked={initial?.isFeatured ?? false} className="h-4 w-4 accent-[rgb(var(--c-secondary))]" />
              <Star className="h-4 w-4" /> Destaque na home
            </label>
            <label className="flex h-[42px] items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold">
              <input type="checkbox" name="isActive" defaultChecked={initial?.isActive ?? true} className="h-4 w-4 accent-[rgb(var(--c-secondary))]" />
              Publicada
            </label>
          </div>
        </fieldset>

        <div className="flex gap-2">
          <SubmitButton className="btn-primary px-6">{isEdit ? "Salvar alterações" : "Publicar oferta"}</SubmitButton>
          <a href="/admin/offers" className="btn-ghost">Cancelar</a>
        </div>
      </div>

      {/* Prévia do card como aparece na vitrine */}
      <aside className="lg:sticky lg:top-8 lg:self-start">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-faint">Como aparece na vitrine</p>
        <div className="relative rounded-card border border-line/70 bg-white p-4 shadow-card">
          {pct && <span className="absolute left-4 top-4 z-10 rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-extrabold text-primary-fg">-{pct}%</span>}
          <div className="grid aspect-square place-items-center overflow-hidden rounded-xl bg-white">
            {imageUrl || initial?.imagePath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl || initial?.imagePath || ""} alt="" className="h-full w-full object-contain p-4" />
            ) : (
              <span className="text-xs text-ink-faint">sem imagem</span>
            )}
          </div>
          <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm font-semibold">{title || "Título da oferta"}</p>
          <div className="mt-2">
            {pct && <p className="text-xs text-ink-faint line-through">{fmtBRL(toNum(original))}</p>}
            <p className="text-xl font-extrabold text-price">{fmtBRL(toNum(price)) ?? "Ver preço na loja"}</p>
          </div>
          {coupon && <p className="mt-2 rounded-lg border border-dashed border-ink/25 bg-surface-sunken px-2.5 py-1.5 font-mono text-xs font-bold uppercase">{coupon}</p>}
          <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-[13px] font-bold text-primary-fg">
            Ver oferta <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </aside>
    </form>
  );
}
