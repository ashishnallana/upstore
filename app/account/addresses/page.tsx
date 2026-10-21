import type { Metadata } from "next";
import { AddressFields, AddressText } from "@/components/address-fields";
import { PageTitle } from "@/components/ui/display";
import { ActionButton, ActionForm, SubmitButton } from "@/components/ui/form";
import { deleteAddress, saveAddress, setDefaultAddress } from "@/lib/actions/account";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Address } from "@/lib/types";

export const metadata: Metadata = { title: "Addresses" };

export default async function AddressesPage() {
  await requireUser("/account/addresses");
  const supabase = await createClient();
  const { data } = await supabase.from("addresses").select("*").order("is_default", { ascending: false }).order("created_at");
  const addresses = (data ?? []) as Address[];

  return (
    <>
      <PageTitle>Addresses</PageTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        {addresses.map((a) => (
          <div key={a.id} className="card p-5">
            <div className="mb-2 flex items-center gap-2">
              <p className="font-medium">{a.label || "Address"}</p>
              {a.is_default && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">Default</span>}
            </div>
            <AddressText a={a} />
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {!a.is_default && (
                <ActionButton action={setDefaultAddress.bind(null, a.id)} className="btn-ghost px-2 text-sm">
                  Make default
                </ActionButton>
              )}
              <ActionButton action={deleteAddress.bind(null, a.id)} className="btn-ghost px-2 text-sm text-red-600" confirm="Delete this address?">
                Delete
              </ActionButton>
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-brand-600">Edit</summary>
              <ActionForm action={saveAddress} className="mt-4 space-y-4">
                <AddressFields address={a} />
                <SubmitButton>Save</SubmitButton>
              </ActionForm>
            </details>
          </div>
        ))}
      </div>

      <details className="card mt-6 p-5" open={!addresses.length}>
        <summary className="cursor-pointer font-medium">Add a new address</summary>
        <ActionForm action={saveAddress} className="mt-4 space-y-4">
          <AddressFields />
          <SubmitButton>Add address</SubmitButton>
        </ActionForm>
      </details>
    </>
  );
}
