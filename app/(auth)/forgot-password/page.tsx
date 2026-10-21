import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgotForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Reset your password" };

export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-bold">Reset your password</h1>
      <p className="mb-6 mt-1 text-sm text-zinc-600">We&apos;ll email you a link to choose a new password.</p>
      <Suspense>
        <ForgotForm />
      </Suspense>
    </>
  );
}
