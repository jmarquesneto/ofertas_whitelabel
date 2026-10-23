"use client";
import { useActionState, useState } from "react";
import { ICONS, Icon } from "@/components/Icon";
import { cn, type ActionState } from "@/lib/utils";
import { FormMessage, SubmitButton } from "./ui";

type Initial = { name: string; parentId: number | null; icon: string; sortOrder: number; isActive: boolean };

export function CategoryForm({
  action, roots, initial, selfId,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  roots: { id: number; name: string }[];
  initial?: Initial;
  selfId?: number;
}) {
  const [state, formAction] = useActionState(action, {});
  const [icon, setIcon] = useState(initial?.icon ?? "tag");
  return (
    <form action={formAction} className="card grid max-w-2xl gap-5 p-5 sm:p-6">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field">
          <label className="label" htmlFor="name">Nome</label>
          <input className="input" id="name" name="name" defaultValue={initial?.name} required maxLength={80} placeholder="Eletrônicos" />
        </div>
        <div className="field">
          <label className="label" htmlFor="parentId">Fica dentro de</label>
          <select className="input" id="parentId" name="parentId" defaultValue={initial?.parentId ?? ""}>
            <option value="">— nenhuma (categoria principal)</option>
            {roots.filter((r) => r.id !== selfId).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      </div>

      <fieldset className="field">
        <legend className="label mb-1.5">Ícone</legend>
        <input type="hidden" name="icon" value={icon} />
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-9">
          {Object.entries(ICONS).map(([key, { label }]) => (
            <button key={key} type="button" onClick={() => setIcon(key)} title={label} aria-label={label} aria-pressed={icon === key}
              className={cn("grid aspect-square place-items-center rounded-xl border transition",
                icon === key ? "border-secondary bg-primary text-primary-fg shadow-sm" : "border-line bg-white text-ink-muted hover:border-ink/30 hover:text-ink")}>
              <Icon name={key} className="h-5 w-5" />
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field">
          <label className="label" htmlFor="sortOrder">Ordem</label>
          <input className="input" id="sortOrder" name="sortOrder" type="number" min={0} defaultValue={initial?.sortOrder ?? 0} />
          <span className="hint">Menor aparece primeiro no menu.</span>
        </div>
        <label className="flex h-[42px] items-center gap-2 self-start rounded-lg border border-line px-3 text-sm font-semibold sm:mt-[26px]">
          <input type="checkbox" name="isActive" defaultChecked={initial?.isActive ?? true} className="h-4 w-4" /> Ativa na vitrine
        </label>
      </div>

      <div className="flex gap-2">
        <SubmitButton className="btn-primary px-6">Salvar categoria</SubmitButton>
        <a href="/admin/categories" className="btn-ghost">Cancelar</a>
      </div>
    </form>
  );
}
