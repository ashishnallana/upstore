import type { Metadata } from "next";
import { Suspense } from "react";
import { SignupForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Create account" };

export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-bold">Create account</h1>
      <p className="mb-6 mt-1 text-sm text-zinc-600">Join to track orders, save addresses and more.</p>
      <Suspense>
        <SignupForm />
      </Suspense>
    </>
  );
}
