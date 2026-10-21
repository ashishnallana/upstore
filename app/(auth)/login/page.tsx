import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="mb-6 mt-1 text-sm text-zinc-600">Welcome back! Sign in to your account.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
