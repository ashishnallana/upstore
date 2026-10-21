-- Demo catalog. Safe to run once after 0001_init.sql. Prices are minor units (₹1 = 100).

insert into public.categories (name, slug, description, sort_order) values
  ('Electronics', 'electronics', 'Phones, laptops, audio and more', 1),
  ('Fashion', 'fashion', 'Clothing and footwear', 2),
  ('Home & Kitchen', 'home-kitchen', 'Everything for your home', 3);

insert into public.categories (parent_id, name, slug, sort_order)
select c.id, x.name, x.slug, x.ord
from (values
  ('electronics', 'Phones', 'phones', 1),
  ('electronics', 'Laptops', 'laptops', 2),
  ('electronics', 'Audio', 'audio', 3),
  ('fashion', 'Men', 'men', 1),
  ('fashion', 'Women', 'women', 2),
  ('fashion', 'Shoes', 'shoes', 3),
  ('home-kitchen', 'Kitchen', 'kitchen', 1),
  ('home-kitchen', 'Decor', 'decor', 2)
) as x(parent, name, slug, ord)
join public.categories c on c.slug = x.parent;

-- Products: (category slug, name, slug, brand, description, featured, options)
insert into public.products (category_id, name, slug, brand, description, is_featured, options)
select c.id, x.name, x.slug, x.brand, x.descr, x.featured, x.opts::jsonb
from (values
  ('phones', 'Nova X1 Smartphone', 'nova-x1', 'Nova', 'A 6.5" AMOLED phone with all-day battery and a 50MP camera.', true,
    '[{"name":"Storage","values":["128 GB","256 GB"]},{"name":"Color","values":["Black","Blue"]}]'),
  ('phones', 'Pixelite Mini', 'pixelite-mini', 'Pixelite', 'Compact phone that fits in any pocket.', false, '[]'),
  ('laptops', 'AirBook 14', 'airbook-14', 'Aero', 'Featherweight 14" laptop with 18 hours of battery.', true,
    '[{"name":"Memory","values":["16 GB","32 GB"]}]'),
  ('audio', 'Pulse ANC Headphones', 'pulse-anc', 'Pulse', 'Over-ear wireless headphones with active noise cancelling.', true, '[]'),
  ('audio', 'Pulse Buds', 'pulse-buds', 'Pulse', 'True wireless earbuds with a pocketable case.', false, '[]'),
  ('men', 'Classic Oxford Shirt', 'classic-oxford-shirt', 'Thread & Co', '100% cotton oxford shirt, regular fit.', true,
    '[{"name":"Size","values":["S","M","L","XL"]},{"name":"Color","values":["White","Sky"]}]'),
  ('women', 'Linen Summer Dress', 'linen-summer-dress', 'Thread & Co', 'Breathable linen midi dress.', true,
    '[{"name":"Size","values":["XS","S","M","L"]}]'),
  ('shoes', 'Runner Pro Sneakers', 'runner-pro', 'Stride', 'Lightweight running shoes with responsive foam.', false,
    '[{"name":"Size","values":["7","8","9","10"]}]'),
  ('kitchen', 'Cast Iron Skillet 10"', 'cast-iron-skillet', 'Hearth', 'Pre-seasoned cast iron pan for perfect searing.', true, '[]'),
  ('kitchen', 'Pour-over Coffee Set', 'pour-over-set', 'Brewly', 'Glass dripper, carafe and 100 filters.', false, '[]'),
  ('decor', 'Ceramic Vase Trio', 'ceramic-vase-trio', 'Hearth', 'Set of three hand-glazed vases.', false, '[]'),
  ('decor', 'Woven Throw Blanket', 'woven-throw', 'Loom', 'Soft cotton throw, 130 x 170 cm.', false,
    '[{"name":"Color","values":["Sand","Charcoal"]}]')
) as x(cat, name, slug, brand, descr, featured, opts)
join public.categories c on c.slug = x.cat;

-- Variants: cartesian product of each product's option values; price from a base table.
with base(slug, price, compare_at) as (values
  ('nova-x1', 2499900, 2799900), ('pixelite-mini', 1599900, null), ('airbook-14', 8999900, 9499900),
  ('pulse-anc', 1299900, 1599900), ('pulse-buds', 499900, null), ('classic-oxford-shirt', 179900, 229900),
  ('linen-summer-dress', 249900, null), ('runner-pro', 399900, 459900), ('cast-iron-skillet', 189900, null),
  ('pour-over-set', 149900, 179900), ('ceramic-vase-trio', 119900, null), ('woven-throw', 219900, null)
),
combos as (
  select p.id as product_id, p.options, b.price, b.compare_at, '{}'::jsonb as vals
  from public.products p join base b on b.slug = p.slug
  where jsonb_array_length(p.options) = 0
  union all
  select p.id, p.options, b.price, b.compare_at, jsonb_build_object(o1->>'name', v1)
  from public.products p join base b on b.slug = p.slug
  cross join lateral jsonb_array_elements(p.options) with ordinality as t1(o1, n1)
  cross join lateral jsonb_array_elements_text(o1->'values') as v1
  where jsonb_array_length(p.options) = 1
  union all
  select p.id, p.options, b.price, b.compare_at, jsonb_build_object(p.options->0->>'name', v1, p.options->1->>'name', v2)
  from public.products p join base b on b.slug = p.slug
  cross join lateral jsonb_array_elements_text(p.options->0->'values') as v1
  cross join lateral jsonb_array_elements_text(p.options->1->'values') as v2
  where jsonb_array_length(p.options) = 2
)
insert into public.product_variants (product_id, title, option_values, price, compare_at_price, stock, position)
select product_id,
       coalesce((select string_agg(vals->>(o->>'name'), ' / ' order by n) from jsonb_array_elements(options) with ordinality t(o, n)), 'Default'),
       vals,
       -- Higher-tier options cost a bit more.
       price + case when vals::text ~ '(256 GB|32 GB)' then 500000 else 0 end,
       compare_at,
       10 + (random() * 40)::int,
       row_number() over (partition by product_id)
from combos;

insert into public.product_images (product_id, url, alt, sort_order)
select p.id, 'https://picsum.photos/seed/' || p.slug || '-' || n || '/800/800', p.name, n
from public.products p cross join generate_series(0, 2) n;

insert into public.coupons (code, description, discount_type, value, min_order, max_discount, usage_limit, per_user_limit)
values
  ('WELCOME10', '10% off your first order (max ₹500)', 'percent', 10, 99900, 50000, null, 1),
  ('FLAT200', '₹200 off orders above ₹1,999', 'fixed', 20000, 199900, null, 1000, 3);
