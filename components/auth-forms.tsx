"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { forgotPassword, resetPassword, signIn, signInWithGoogle, signUp } from "@/lib/actions/auth";

function useNext() {
  const sp = useSearchParams();
  return { next: sp.get("next") ?? "/account", error: sp.get("error") };
}

function GoogleButton({ next }: { next: string }) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next} />
      <SubmitButton className="btn-secondary w-full">
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
          <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-8Z" />
          <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23Z" />
          <path fill="#FBBC05" d="M5.8 14c-.2-.7-.4-1.3-.4-2s.1-1.4.4-2V7.1H2.1a11 11 0 0 0 0 9.8L5.8 14Z" />
          <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1L5.8 10C6.7 7.3 9.1 5.4 12 5.4Z" />
        </svg>
        Continue with Google
      </SubmitButton>
    </form>
  );
}

function Divider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-zinc-400">
      <span className="h-px flex-1 bg-zinc-200" /> or <span className="h-px flex-1 bg-zinc-200" />
    </div>
  );
}

export function LoginForm() {
  const { next, error } = useNext();
  const [state, action] = useActionState(signIn, error ? { error } : undefined);
  return (
    <>
      <GoogleButton next={next} />
      <Divider />
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <label className="block">
          <span className="label">Email</span>
          <input name="email" type="email" required autoComplete="email" className="input" />
        </label>
        <label className="block">
          <span className="flex justify-between">
            <span className="label">Password</span>
            <Link href="/forgot-password" className="text-sm text-brand-600 hover:underline">
              Forgot?
            </Link>
          </span>
          <input name="password" type="password" required autoComplete="current-password" className="input" />
        </label>
        <FormMessage state={state} />
        <SubmitButton className="btn-primary w-full">Sign in</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-600">
        New here?{" "}
        <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-medium text-brand-600 hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}

export function SignupForm() {
  const { next } = useNext();
  const [state, action] = useActionState(signUp, undefined);
  return (
    <>
      <GoogleButton next={next} />
      <Divider />
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <label className="block">
          <span className="label">Full name</span>
          <input name="full_name" required autoComplete="name" className="input" />
        </label>
        <label className="block">
          <span className="label">Email</span>
          <input name="email" type="email" required autoComplete="email" className="input" />
        </label>
        <label className="block">
          <span className="label">Password</span>
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
        </label>
        <FormMessage state={state} />
        <SubmitButton className="btn-primary w-full">Create account</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-600">
        Already have an account?{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}

export function ForgotForm() {
  const [state, action] = useActionState(forgotPassword, undefined);
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="label">Email</span>
        <input name="email" type="email" required autoComplete="email" className="input" />
      </label>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full">Send reset link</SubmitButton>
    </form>
  );
}

export function ResetForm() {
  const [state, action] = useActionState(resetPassword, undefined);
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="label">New password</span>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </label>
      <label className="block">
        <span className="label">Confirm password</span>
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </label>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full">Update password</SubmitButton>
    </form>
  );
}
