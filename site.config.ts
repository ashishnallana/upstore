/**
 * Storefront branding and copy. Edit this file to make the store your own;
 * see CUSTOMIZING.md for colors, fonts, layout and everything else.
 *
 * The store name shown in the header can also be changed at runtime in
 * Admin → Settings (that value wins); `name` here is the fallback and the
 * name used in page titles and metadata.
 */
export const site = {
  name: "UpStore",
  description: "Shop electronics, fashion and home essentials.",

  hero: {
    eyebrow: "New season",
    title: "Everything you need, delivered to your door.",
    subtitle: "Electronics, fashion and home essentials at honest prices. Free shipping on qualifying orders.",
    primary: { label: "Shop all", href: "/search" },
    secondary: { label: "Top rated", href: "/search?sort=rating" },
  },

  home: {
    categoriesTitle: "Shop by category",
    featuredTitle: "Featured",
    newArrivalsTitle: "New arrivals",
  },

  footer: {
    tagline: "Demo store built with Next.js and Supabase.",
    links: [
      { label: "All products", href: "/search" },
      { label: "Orders", href: "/account/orders" },
      { label: "Cart", href: "/cart" },
    ],
  },
} as const;
