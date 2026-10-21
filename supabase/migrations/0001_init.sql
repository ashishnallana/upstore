-- UpStore schema. Money is stored as integer minor units (amount * 100) in the
-- store currency. All writes that matter (orders, payments, coupons, stock)
-- go through SECURITY DEFINER functions; tables are protected by RLS.

-- ───────────────────────── Enums ─────────────────────────
create type public.user_role as enum ('customer', 'admin');
create type public.order_status as enum ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');
create type public.discount_type as enum ('percent', 'fixed');

-- ───────────────────────── Helpers ─────────────────────────
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ───────────────────────── Store settings (singleton) ─────────────────────────
create table public.store_settings (
  id boolean primary key default true check (id),
  store_name text not null default 'UpStore',
  currency char(3) not null default 'INR',
  locale text not null default 'en-IN',
  shipping_fee integer not null default 4900 check (shipping_fee >= 0),
  free_shipping_threshold integer not null default 49900 check (free_shipping_threshold >= 0),
  updated_at timestamptz not null default now()
);
insert into public.store_settings default values;
create trigger store_settings_updated before update on public.store_settings
  for each row execute function public.set_updated_at();

-- ───────────────────────── Profiles ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text,
  phone text,
  avatar_url text,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── Addresses ─────────────────────────
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  label text,
  full_name text not null,
  phone text not null,
  line1 text not null,
  line2 text,
  city text not null,
  state text not null,
  postal_code text not null,
  country text not null default 'India',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.addresses (user_id);
create unique index addresses_one_default on public.addresses (user_id) where is_default;

-- Keep exactly one default address per user.
create or replace function public.address_single_default() returns trigger
language plpgsql as $$
begin
  if new.is_default then
    update public.addresses set is_default = false
      where user_id = new.user_id and id <> new.id and is_default;
  elsif not exists (select 1 from public.addresses where user_id = new.user_id and id <> new.id) then
    new.is_default = true;
  end if;
  return new;
end $$;
create trigger addresses_default before insert or update of is_default on public.addresses
  for each row execute function public.address_single_default();

-- ───────────────────────── Catalog ─────────────────────────
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories on delete restrict,
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);
create index on public.categories (parent_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  brand text,
  -- Option definitions, e.g. [{"name":"Size","values":["S","M"]}]. Empty = single default variant.
  options jsonb not null default '[]'::jsonb,
  -- Denormalized from variants / reviews by triggers, for fast listing pages.
  price integer not null default 0,
  compare_at_price integer,
  in_stock boolean not null default false,
  rating_avg numeric(3, 2) not null default 0,
  rating_count integer not null default 0,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(brand, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.products (category_id) where is_active;
create index on public.products (is_featured) where is_active and is_featured;
create index on public.products using gin (search);
create trigger products_updated before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products on delete cascade,
  url text not null,
  alt text,
  sort_order integer not null default 0
);
create index on public.product_images (product_id, sort_order);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products on delete cascade,
  title text not null default 'Default',
  -- e.g. {"Size":"M","Color":"Red"}; {} for the default variant.
  option_values jsonb not null default '{}'::jsonb,
  sku text unique,
  price integer not null check (price >= 0),
  compare_at_price integer check (compare_at_price is null or compare_at_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  position integer not null default 0
);
create index on public.product_variants (product_id, position);

-- Mirror cheapest active variant's price + stock flag onto the product row.
create or replace function public.sync_product_from_variants() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  pid uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p set
    price = coalesce(v.price, 0),
    compare_at_price = v.compare_at_price,
    in_stock = coalesce(v.any_stock, false)
  from (
    select
      (array_agg(price order by price))[1] as price,
      (array_agg(compare_at_price order by price))[1] as compare_at_price,
      bool_or(stock > 0) as any_stock
    from public.product_variants
    where product_id = pid and is_active
  ) v
  where p.id = pid;
  return null;
end $$;
create trigger variants_sync after insert or update or delete on public.product_variants
  for each row execute function public.sync_product_from_variants();

-- ───────────────────────── Wishlist & cart ─────────────────────────
create table public.wishlists (
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  product_id uuid not null references public.products on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  variant_id uuid not null references public.product_variants on delete cascade,
  quantity integer not null check (quantity between 1 and 99),
  created_at timestamptz not null default now(),
  unique (user_id, variant_id)
);

-- ───────────────────────── Coupons ─────────────────────────
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  description text,
  discount_type public.discount_type not null,
  -- percent: 1..100, fixed: minor units
  value integer not null check (value > 0),
  min_order integer not null default 0,
  max_discount integer,
  usage_limit integer,
  per_user_limit integer not null default 1,
  used_count integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (discount_type <> 'percent' or value <= 100)
);

-- ───────────────────────── Orders & payments ─────────────────────────
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity (start with 1001) unique,
  user_id uuid not null references public.profiles on delete restrict,
  status public.order_status not null default 'pending',
  currency char(3) not null,
  subtotal integer not null,
  discount integer not null default 0,
  shipping integer not null default 0,
  total integer not null,
  coupon_code text,
  shipping_address jsonb not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.orders (user_id, created_at desc);
create index on public.orders (status, created_at desc);
create trigger orders_updated before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders on delete cascade,
  product_id uuid references public.products on delete set null,
  variant_id uuid references public.product_variants on delete set null,
  product_name text not null,
  product_slug text,
  variant_title text,
  image_url text,
  unit_price integer not null,
  quantity integer not null,
  line_total integer not null
);
create index on public.order_items (order_id);
create index on public.order_items (product_id);

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders on delete cascade,
  status public.order_status not null,
  note text,
  created_at timestamptz not null default now()
);
create index on public.order_events (order_id, created_at);

create or replace function public.log_order_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_events (order_id, status) values (new.id, new.status);
  end if;
  return null;
end $$;
create trigger orders_status_log after insert or update of status on public.orders
  for each row execute function public.log_order_status();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders on delete cascade,
  provider text not null,
  provider_ref text,
  amount integer not null,
  currency char(3) not null,
  status public.payment_status not null default 'pending',
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.payments (order_id);
create trigger payments_updated before update on public.payments
  for each row execute function public.set_updated_at();

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  order_id uuid not null references public.orders on delete cascade,
  created_at timestamptz not null default now()
);
create index on public.coupon_redemptions (coupon_id, user_id);

-- ───────────────────────── Reviews ─────────────────────────
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  author_name text,
  rating smallint not null check (rating between 1 and 5),
  title text,
  body text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);
create index on public.reviews (product_id, created_at desc) where is_published;

create or replace function public.has_purchased(p_product uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.product_id = p_product and o.user_id = auth.uid() and o.status = 'delivered'
  );
$$;

create or replace function public.review_author() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select coalesce(nullif(split_part(full_name, ' ', 1), ''), 'Customer')
    into new.author_name from public.profiles where id = new.user_id;
  return new;
end $$;
create trigger reviews_author before insert on public.reviews
  for each row execute function public.review_author();

-- Only admins can change moderation state.
create or replace function public.review_moderation_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.is_published = true;
  elsif new.is_published is distinct from old.is_published and not public.is_admin() then
    new.is_published = old.is_published;
  end if;
  return new;
end $$;
create trigger reviews_moderation before insert or update on public.reviews
  for each row execute function public.review_moderation_guard();

create or replace function public.sync_product_rating() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  pid uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p set
    rating_avg = coalesce(r.avg, 0),
    rating_count = r.cnt
  from (
    select round(avg(rating)::numeric, 2) as avg, count(*)::int as cnt
    from public.reviews where product_id = pid and is_published
  ) r
  where p.id = pid;
  return null;
end $$;
create trigger reviews_rating after insert or update or delete on public.reviews
  for each row execute function public.sync_product_rating();

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.store_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.wishlists enable row level security;
alter table public.cart_items enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.payments enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.reviews enable row level security;

create policy "settings readable" on public.store_settings for select using (true);
create policy "settings admin" on public.store_settings for update using (public.is_admin());

create policy "profile self read" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profile self update" on public.profiles for update using (id = auth.uid());
-- Users may only edit these columns; role/email change through admin_set_role / auth.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

create policy "addresses own" on public.addresses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "categories read" on public.categories for select using (is_active or public.is_admin());
create policy "categories admin" on public.categories for all using (public.is_admin()) with check (public.is_admin());

create policy "products read" on public.products for select using (is_active or public.is_admin());
create policy "products admin" on public.products for all using (public.is_admin()) with check (public.is_admin());

create policy "images read" on public.product_images for select using (true);
create policy "images admin" on public.product_images for all using (public.is_admin()) with check (public.is_admin());

create policy "variants read" on public.product_variants for select using (true);
create policy "variants admin" on public.product_variants for all using (public.is_admin()) with check (public.is_admin());

create policy "wishlist own" on public.wishlists for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "cart own" on public.cart_items for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "coupons admin" on public.coupons for all using (public.is_admin()) with check (public.is_admin());

create policy "orders read" on public.orders for select using (user_id = auth.uid() or public.is_admin());

create policy "order items read" on public.order_items for select using (
  public.is_admin() or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
);
create policy "order events read" on public.order_events for select using (
  public.is_admin() or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
);
create policy "payments read" on public.payments for select using (
  public.is_admin() or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
);
create policy "redemptions admin" on public.coupon_redemptions for select using (public.is_admin());

create policy "reviews read" on public.reviews for select using (is_published or user_id = auth.uid() or public.is_admin());
create policy "reviews insert" on public.reviews for insert
  with check (user_id = auth.uid() and public.has_purchased(product_id));
create policy "reviews update own" on public.reviews for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reviews delete" on public.reviews for delete using (user_id = auth.uid() or public.is_admin());
create policy "reviews admin" on public.reviews for update using (public.is_admin());
-- Users can't forge author names; is_published is guarded by review_moderation_guard.
revoke update on public.reviews from anon, authenticated;
grant update (rating, title, body, is_published) on public.reviews to authenticated;

-- ───────────────────────── Business functions ─────────────────────────

-- Discount for a coupon against a subtotal. Raises a readable error if invalid.
create or replace function public.coupon_discount(p_code text, p_subtotal integer, p_user uuid)
returns table (coupon_id uuid, code text, discount integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  c public.coupons;
  d integer;
begin
  select * into c from public.coupons where public.coupons.code = upper(trim(p_code));
  if not found or not c.is_active then raise exception 'Invalid coupon code'; end if;
  if c.starts_at is not null and now() < c.starts_at then raise exception 'Coupon is not active yet'; end if;
  if c.ends_at is not null and now() > c.ends_at then raise exception 'Coupon has expired'; end if;
  if c.usage_limit is not null and c.used_count >= c.usage_limit then raise exception 'Coupon usage limit reached'; end if;
  if p_subtotal < c.min_order then raise exception 'Order does not meet the coupon minimum'; end if;
  if (select count(*) from public.coupon_redemptions r where r.coupon_id = c.id and r.user_id = p_user) >= c.per_user_limit then
    raise exception 'You have already used this coupon';
  end if;

  d := case when c.discount_type = 'percent' then (p_subtotal * c.value) / 100 else c.value end;
  if c.max_discount is not null then d := least(d, c.max_discount); end if;
  d := least(d, p_subtotal);
  return query select c.id, c.code, d;
end $$;

-- Preview for checkout UI (current user).
create or replace function public.preview_coupon(p_code text, p_subtotal integer)
returns integer language sql stable security definer set search_path = '' as $$
  select discount from public.coupon_discount(p_code, p_subtotal, auth.uid());
$$;

-- Atomically turn the current user's cart into a pending order.
create or replace function public.place_order(p_address_id uuid, p_coupon_code text default null, p_notes text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  addr public.addresses;
  s public.store_settings;
  v_subtotal integer := 0;
  v_discount integer := 0;
  v_shipping integer := 0;
  v_coupon_id uuid;
  v_coupon_code text;
  v_order_id uuid;
  r record;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select * into addr from public.addresses where id = p_address_id and user_id = uid;
  if not found then raise exception 'Address not found'; end if;

  select * into s from public.store_settings where id;

  -- Lock variants so concurrent checkouts can't oversell.
  for r in
    select c.quantity, v.id as variant_id, v.price, v.stock, v.is_active as v_active, v.title as variant_title,
           p.id as product_id, p.name, p.slug, p.is_active as p_active
    from public.cart_items c
    join public.product_variants v on v.id = c.variant_id
    join public.products p on p.id = v.product_id
    where c.user_id = uid
    order by v.id
    for update of v
  loop
    if not (r.v_active and r.p_active) then raise exception '% is no longer available', r.name; end if;
    if r.stock < r.quantity then raise exception 'Only % left of %', r.stock, r.name; end if;
    v_subtotal := v_subtotal + r.price * r.quantity;
  end loop;

  if v_subtotal = 0 then raise exception 'Your cart is empty'; end if;

  if p_coupon_code is not null and trim(p_coupon_code) <> '' then
    perform 1 from public.coupons where code = upper(trim(p_coupon_code)) for update;
    select cd.coupon_id, cd.code, cd.discount into v_coupon_id, v_coupon_code, v_discount
      from public.coupon_discount(p_coupon_code, v_subtotal, uid) cd;
  end if;

  v_shipping := case when v_subtotal - v_discount >= s.free_shipping_threshold then 0 else s.shipping_fee end;

  insert into public.orders (user_id, currency, subtotal, discount, shipping, total, coupon_code, shipping_address, notes)
  values (
    uid, s.currency, v_subtotal, v_discount, v_shipping, v_subtotal - v_discount + v_shipping, v_coupon_code,
    jsonb_build_object(
      'full_name', addr.full_name, 'phone', addr.phone, 'line1', addr.line1, 'line2', addr.line2,
      'city', addr.city, 'state', addr.state, 'postal_code', addr.postal_code, 'country', addr.country
    ),
    nullif(trim(p_notes), '')
  )
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, variant_id, product_name, product_slug, variant_title, image_url, unit_price, quantity, line_total)
  select v_order_id, p.id, v.id, p.name, p.slug, nullif(v.title, 'Default'),
         (select url from public.product_images i where i.product_id = p.id order by sort_order limit 1),
         v.price, c.quantity, v.price * c.quantity
  from public.cart_items c
  join public.product_variants v on v.id = c.variant_id
  join public.products p on p.id = v.product_id
  where c.user_id = uid;

  update public.product_variants v set stock = v.stock - c.quantity
  from public.cart_items c where c.variant_id = v.id and c.user_id = uid;

  if v_coupon_id is not null then
    insert into public.coupon_redemptions (coupon_id, user_id, order_id) values (v_coupon_id, uid, v_order_id);
    update public.coupons set used_count = used_count + 1 where id = v_coupon_id;
  end if;

  delete from public.cart_items where user_id = uid;
  return v_order_id;
end $$;

-- Return stock and coupon usage for an order being cancelled.
create or replace function public.release_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.product_variants v set stock = v.stock + oi.quantity
  from public.order_items oi where oi.order_id = p_order_id and oi.variant_id = v.id;

  update public.coupons c set used_count = greatest(c.used_count - 1, 0)
  from public.coupon_redemptions r where r.order_id = p_order_id and r.coupon_id = c.id;
  delete from public.coupon_redemptions where order_id = p_order_id;

  update public.payments set status = 'refunded'
    where order_id = p_order_id and status = 'succeeded';
end $$;

-- Customer cancels their own order before it is processed.
create or replace function public.cancel_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id and user_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status not in ('pending', 'paid') then raise exception 'This order can no longer be cancelled'; end if;
  perform public.release_order(o.id);
  update public.orders set status = 'cancelled' where id = o.id;
end $$;

-- Admin moves an order through its lifecycle.
create or replace function public.admin_update_order_status(p_order_id uuid, p_status public.order_status, p_note text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status = 'cancelled' then raise exception 'Cancelled orders cannot change status'; end if;
  if p_status = 'cancelled' then perform public.release_order(o.id); end if;
  update public.orders set status = p_status where id = o.id;
  if nullif(trim(p_note), '') is not null then
    update public.order_events set note = trim(p_note)
      where id = (select max(id) from public.order_events where order_id = o.id);
  end if;
end $$;

-- Payment results. Only callable with the service role (i.e. from the server
-- after verifying with the payment provider), never directly by browsers.
create or replace function public.record_payment(
  p_order_id uuid, p_provider text, p_ref text, p_success boolean, p_raw jsonb default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status <> 'pending' then raise exception 'Order is not awaiting payment'; end if;

  insert into public.payments (order_id, provider, provider_ref, amount, currency, status, raw)
  values (o.id, p_provider, p_ref, o.total, o.currency, case when p_success then 'succeeded' else 'failed' end::public.payment_status, p_raw);

  if p_success then
    update public.orders set status = 'paid' where id = o.id;
  end if;
end $$;

create or replace function public.admin_set_role(p_user uuid, p_role public.user_role) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  if p_user = auth.uid() then raise exception 'You cannot change your own role'; end if;
  update public.profiles set role = p_role where id = p_user;
end $$;

create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  return jsonb_build_object(
    'revenue', (select coalesce(sum(total), 0) from public.orders where status in ('paid', 'processing', 'shipped', 'delivered')),
    'revenue_30d', (select coalesce(sum(total), 0) from public.orders
                    where status in ('paid', 'processing', 'shipped', 'delivered') and created_at > now() - interval '30 days'),
    'orders', (select count(*) from public.orders),
    'to_fulfil', (select count(*) from public.orders where status in ('paid', 'processing')),
    'customers', (select count(*) from public.profiles where role = 'customer'),
    'products', (select count(*) from public.products),
    'low_stock', coalesce((
      select jsonb_agg(x) from (
        select v.id, v.product_id, p.name, v.title, v.stock
        from public.product_variants v join public.products p on p.id = v.product_id
        where v.is_active and v.stock <= 5 order by v.stock limit 10
      ) x
    ), '[]'::jsonb)
  );
end $$;

-- Lock down function execution.
revoke execute on all functions in schema public from public, anon;
grant execute on function public.is_admin(), public.has_purchased(uuid) to anon, authenticated;
grant execute on function
  public.preview_coupon(text, integer),
  public.place_order(uuid, text, text),
  public.cancel_order(uuid),
  public.admin_update_order_status(uuid, public.order_status, text),
  public.admin_set_role(uuid, public.user_role),
  public.admin_stats()
to authenticated;
revoke execute on function public.record_payment(uuid, text, text, boolean, jsonb) from authenticated;
revoke execute on function public.release_order(uuid) from authenticated;
revoke execute on function public.coupon_discount(text, integer, uuid) from authenticated;
grant execute on function public.record_payment(uuid, text, text, boolean, jsonb) to service_role;

-- ───────────────────────── Storage ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('products', 'products', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "products bucket admin write" on storage.objects for insert to authenticated
  with check (bucket_id = 'products' and public.is_admin());
create policy "products bucket admin update" on storage.objects for update to authenticated
  using (bucket_id = 'products' and public.is_admin());
create policy "products bucket admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'products' and public.is_admin());

create policy "avatars own write" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars own update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
