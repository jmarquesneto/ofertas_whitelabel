"use client";
import { useFormStatus } from "react-dom";
import { cn, type ActionState } from "@/lib/utils";

export function SubmitButton({ children, className = "btn-primary", pendingText = "Salvando…" }: {
  children: React.ReactNode; className?: string; pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state.error)
    return (
      <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        {state.error}
      </p>
    );
  if (state.ok && state.message)
    return (
      <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        {state.message}
      </p>
    );
  return null;
}

/** Botão que dispara uma Server Action simples (excluir, renovar…) com confirmação opcional */
export function ActionButton({ action, children, className = "btn-ghost", confirmText }: {
  action: () => Promise<unknown>; children: React.ReactNode; className?: string; confirmText?: string;
}) {
  return (
    <form
      action={async () => { await action(); }}
      onSubmit={(e) => { if (confirmText && !window.confirm(confirmText)) e.preventDefault(); }}
    >
      <SubmitButton className={className} pendingText="…">{children}</SubmitButton>
    </form>
  );
}

/** Botão de ícone que dispara uma Server Action (listagens do painel) */
export function IconAction({ action, children, label, danger, confirmText }: {
  action: () => Promise<unknown>; children: React.ReactNode; label: string; danger?: boolean; confirmText?: string;
}) {
  return (
    <form
      action={async () => { await action(); }}
      onSubmit={(e) => { if (confirmText && !window.confirm(confirmText)) e.preventDefault(); }}
    >
      <IconSubmit label={label} danger={danger}>{children}</IconSubmit>
    </form>
  );
}

function IconSubmit({ children, label, danger }: { children: React.ReactNode; label: string; danger?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit" title={label} aria-label={label} disabled={pending}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-lg transition disabled:opacity-40",
        danger ? "text-red-600 hover:bg-red-50" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
