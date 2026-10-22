-- Invoices + transactional email log. Run after 0001_init.sql.

-- ───────────────────────── Seller details (shown on invoices & emails) ─────────────────────────
alter table public.store_settings
  add column legal_name text,
  add column address text,
  add column gstin text,
  add column support_email text,
  add column invoice_prefix text not null default 'INV-',
  add column invoice_notes text default 'Prices are inclusive of all applicable taxes.';

-- ───────────────────────── Invoice numbers ─────────────────────────
-- Sequential and gap-free in normal operation (a number is only taken when an
-- order first leaves "pending" for a non-cancelled status, inside that update).
create sequence public.invoice_number_seq start 1;

alter table public.orders
  add column invoice_number text unique,
  add column invoiced_at timestamptz;

create or replace function public.assign_invoice_number() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.invoice_number is null and old.status = 'pending' and new.status not in ('pending', 'cancelled') then
    new.invoice_number := coalesce((select invoice_prefix from public.store_settings where id), 'INV-')
      || lpad(nextval('public.invoice_number_seq')::text, 6, '0');
    new.invoiced_at := now();
  end if;
  return new;
end $$;

create trigger orders_invoice_number before update of status on public.orders
  for each row execute function public.assign_invoice_number();

-- Orders already past payment when this migration runs get numbers too, in date order.
do $$
declare
  r record;
begin
  for r in
    select id, updated_at from public.orders
    where invoice_number is null and status in ('paid', 'processing', 'shipped', 'delivered')
    order by created_at
  loop
    update public.orders set
      invoice_number = coalesce((select invoice_prefix from public.store_settings where id), 'INV-')
        || lpad(nextval('public.invoice_number_seq')::text, 6, '0'),
      invoiced_at = r.updated_at
    where id = r.id;
  end loop;
end $$;

-- ───────────────────────── Email log ─────────────────────────
-- One row per (order, kind): the unique key is what stops duplicate emails when
-- webhooks are retried or several paths settle the same order.
create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders on delete cascade,
  kind text not null,
  to_email text not null,
  subject text,
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed', 'skipped')),
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (order_id, kind)
);
create index on public.email_log (created_at desc);

alter table public.email_log enable row level security;
create policy "email log admin read" on public.email_log for select using (public.is_admin());
-- Writes happen only server-side with the service role.

revoke execute on function public.assign_invoice_number() from public, anon, authenticated;
