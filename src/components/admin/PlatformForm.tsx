"use client";
import { useActionState } from "react";
import type { ActionState } from "@/lib/utils";
import { FormMessage, SubmitButton } from "./ui";
import { ImageInput } from "./ImageInput";

type Initial = { name: string; logoPath: string | null; isActive: boolean; sortOrder: number };

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
