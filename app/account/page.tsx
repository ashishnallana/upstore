import type { Metadata } from "next";
import { ImageField } from "@/components/image-upload";
import { PageTitle } from "@/components/ui/display";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { updateProfile } from "@/lib/actions/account";
import { getProfile, requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "My account" };

export default async function ProfilePage({ searchParams }: PageProps<"/account">) {
  const user = await requireUser();
  const [profile, sp] = await Promise.all([getProfile(), searchParams]);

  return (
    <>
      <PageTitle>Profile</PageTitle>
      {sp.password === "updated" && <p className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">Your password was updated.</p>}
      <div className="card max-w-xl p-6">
        <ActionForm action={updateProfile} className="space-y-4">
          <ImageField name="avatar_url" bucket="avatars" folder={user.id} defaultUrl={profile?.avatar_url} round />
          <label className="block">
            <span className="label">Email</span>
            <input value={user.email ?? ""} disabled className="input bg-zinc-50 text-zinc-500" />
          </label>
          <label className="block">
            <span className="label">Full name</span>
            <input name="full_name" defaultValue={profile?.full_name ?? ""} className="input" autoComplete="name" />
          </label>
          <label className="block">
            <span className="label">Phone</span>
            <input name="phone" type="tel" defaultValue={profile?.phone ?? ""} className="input" autoComplete="tel" />
          </label>
          <SubmitButton>Save changes</SubmitButton>
        </ActionForm>
        {profile && <p className="mt-6 text-xs text-zinc-500">Member since {formatDate(profile.created_at)}</p>}
      </div>
    </>
  );
}
