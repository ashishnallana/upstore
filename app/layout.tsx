import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { Header } from "@/components/store/header";
import { site } from "@/site.config";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: site.name, template: `%s | ${site.name}` },
  description: site.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-dvh flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="mt-16 border-t border-zinc-200 py-10 text-sm text-zinc-500">
          <div className="container-x flex flex-wrap items-center justify-between gap-4">
            <p>{site.footer.tagline}</p>
            <nav className="flex gap-4">
              {site.footer.links.map((l) => (
                <Link key={l.href} href={l.href} className="hover:text-zinc-900">
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
