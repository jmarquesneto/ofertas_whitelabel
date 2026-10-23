"use client";
import { useActionState } from "react";
import type { ActionState } from "@/lib/utils";

/** Exclusão com confirmação; mostra o erro se a plataforma ainda tiver ofertas */
export function DeletePlatformButton({ action, name }: { action: () => Promise<ActionState>; name: string }) {
  const [state, run, pending] = useActionState(async () => action(), {} as ActionState);
  return (
    <form
      action={run}
      onSubmit={(e) => { if (!window.confirm(`Excluir a plataforma "${name}"?`)) e.preventDefault(); }}
      className="relative"
    >
      <button className="btn-danger px-3 py-1.5 text-xs" disabled={pending}>{pending ? "…" : "Excluir"}</button>
      {state.error && (
        <p role="alert" className="absolute right-0 top-full z-10 mt-1 w-64 rounded-lg border border-red-200 bg-white p-2 text-xs text-red-800 shadow">
          {state.error}
        </p>
      )}
    </form>
  );
}
