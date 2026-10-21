import type { Metadata } from "next";
import Form from "next/form";
import { Pagination } from "@/components/store/product-grid";
import { Badge, PageTitle } from "@/components/ui/display";
import { ActionButton } from "@/components/ui/form";
import { setUserRole } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Customers" };
const PER_PAGE = 50;

export default async function AdminCustomers({ searchParams }: PageProps<"/admin/customers">) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().replace(/[%_,()]/g, "") : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("*,orders(count)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
  const { data, count } = await query;
  const users = (data ?? []) as (Profile & { orders: { count: number }[] })[];

  return (
    <>
      <PageTitle>Customers</PageTitle>
      <Form action="" className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search name or email" className="input max-w-xs" />
        <button className="btn-secondary">Search</button>
      </Form>
      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Orders</th>
              <th>Joined</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.full_name || "—"}</td>
                <td className="text-zinc-600">{u.email}</td>
                <td>{u.orders[0]?.count ?? 0}</td>
                <td className="text-zinc-500">{formatDate(u.created_at)}</td>
                <td className="flex items-center gap-2">
                  <Badge className={u.role === "admin" ? "bg-brand-50 text-brand-700" : "bg-zinc-100 text-zinc-600"}>{u.role}</Badge>
                  {u.id !== me.id && (
                    <ActionButton
                      action={setUserRole.bind(null, u.id, u.role === "admin" ? "customer" : "admin")}
                      className="text-xs text-brand-600 hover:underline"
                      confirm={u.role === "admin" ? "Remove admin access?" : "Grant full admin access to this user?"}
                    >
                      {u.role === "admin" ? "Make customer" : "Make admin"}
                    </ActionButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={count ?? 0} perPage={PER_PAGE} params={{ q }} />
    </>
  );
}
