"use client";
import { useActionState } from "react";
import { Timer } from "lucide-react";
import { setBannerIntervalAction } from "@/server/actions/banners";
import { SubmitButton } from "./ui";

export function BannerIntervalForm({ value }: { value: number }) {
  const [state, action] = useActionState(setBannerIntervalAction, {});
  return (
    <form action={action} className="card flex flex-wrap items-center gap-3 px-4 py-3">
      <Timer className="h-5 w-5 text-ink-faint" />
      <label htmlFor="interval" className="text-sm font-semibold">Trocar de banner a cada</label>
      <input id="interval" name="interval" type="number" min={3} max={30} defaultValue={value} className="input h-9 w-20 py-1.5 text-center" />
      <span className="text-sm text-ink-muted">segundos</span>
      <SubmitButton className="btn-ghost px-3 py-1.5 text-xs" pendingText="…">Salvar</SubmitButton>
      {state.error && <span role="alert" className="text-xs font-semibold text-red-700">{state.error}</span>}
      {state.ok && <span role="status" className="text-xs font-semibold text-green-700">{state.message}</span>}
    </form>
  );
}
