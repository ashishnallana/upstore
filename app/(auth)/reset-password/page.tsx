import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Choose a new password" };

export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      <p className="mb-6 mt-1 text-sm text-zinc-600">Enter a new password for your account.</p>
      <Suspense>
        <ResetForm />
      </Suspense>
    </>
  );
}
