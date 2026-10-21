"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { str } from "@/lib/utils";

export async function updateProfile(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: str(form, "full_name") || null,
      phone: str(form, "phone") || null,
      avatar_url: str(form, "avatar_url") || null,
    })
    .eq("id", user.id);
  if (error) return { error: error.message };
  refresh();
  return { ok: "Profile saved" };
}

export async function saveAddress(_: ActionState, form: FormData): Promise<ActionState> {
  await requireUser();
  const address = {
    label: str(form, "label") || null,
    full_name: str(form, "full_name"),
    phone: str(form, "phone"),
    line1: str(form, "line1"),
    line2: str(form, "line2") || null,
    city: str(form, "city"),
    state: str(form, "state"),
    postal_code: str(form, "postal_code"),
    country: str(form, "country") || "India",
    // Unchecking never clears the default; picking another address does.
    ...(form.get("is_default") === "on" && { is_default: true }),
  };
  if (!address.full_name || !address.phone || !address.line1 || !address.city || !address.state || !address.postal_code) {
    return { error: "Please fill in all required fields." };
  }
  const id = str(form, "id");
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("addresses").update(address).eq("id", id)
    : await supabase.from("addresses").insert(address);
  if (error) return { error: error.message };
  refresh();
  return { ok: "Address saved" };
}

export async function deleteAddress(id: string) {
  await requireUser();
  const supabase = await createClient();
  await supabase.from("addresses").delete().eq("id", id);
  refresh();
}

export async function setDefaultAddress(id: string) {
  await requireUser();
  const supabase = await createClient();
  await supabase.from("addresses").update({ is_default: true }).eq("id", id);
  refresh();
}
