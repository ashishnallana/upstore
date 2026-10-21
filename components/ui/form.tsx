"use client";

import { useActionState, useTransition, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SubmitButton({
  children,
  className = "btn-primary",
  pendingText,
  ...props
}: { children: ReactNode; className?: string; pendingText?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} {...props} disabled={pending || props.disabled}>
      {pending ? (pendingText ?? "Please wait…") : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state?.error && !state?.ok) return null;
  return (
    <p role="status" className={cn("text-sm", state.error ? "text-red-600" : "text-green-700")}>
      {state.error ?? state.ok}
    </p>
  );
}

/** <form> wired to a Server Action via useActionState, with inline result message. */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {children}
      <FormMessage state={state} />
    </form>
  );
}

/** Button that runs a bound Server Action, optionally after a confirm prompt. */
export function ActionButton({
  action,
  children,
  className = "btn-secondary",
  confirm,
}: {
  action: () => Promise<ActionState | void>;
  children: ReactNode;
  className?: string;
  confirm?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <>
      <button
        type="button"
        disabled={pending}
        className={className}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => setError((await action())?.error));
        }}
      >
        {children}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </>
  );
}
