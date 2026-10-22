import "server-only";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { OrderDocument } from "@/lib/orders/document";

// A4 invoice rendered with pdf-lib's built-in Helvetica (no font files to ship).
// Built-in fonts only cover Latin-1, so text is normalised by `safe()` and money
// is printed with the currency code ("INR 2,499.00") instead of a symbol.
// For other scripts, embed a TTF with @pdf-lib/fontkit.

const A4 = { w: 595.28, h: 841.89 };
const M = 48; // page margin
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.42, 0.42, 0.46);
const LINE = rgb(0.86, 0.86, 0.88);
const BRAND = rgb(0.29, 0.31, 0.83);

/** Map typographic characters to Latin-1 and replace anything else unsupported. */
function safe(text: string) {
  return text
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/₹/g, "Rs.")
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "?");
}

function money(minor: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "code" }).format(minor / 100);
}

function date(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
}

/** Greedy word wrap to a max width. */
function wrap(text: string, font: PDFFont, size: number, max: number) {
  const lines: string[] = [];
  for (const para of safe(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= max) line = next;
      else {
        if (line) lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function renderInvoicePdf({ order, items, seller, customer, paymentRef }: OrderDocument) {
  if (!order.invoice_number) throw new Error("Order has no invoice yet.");
  const { currency, shipping_address: a } = order;
  const locale = seller.locale || "en-IN";
  const fmt = (n: number) => money(n, currency, locale);

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${order.invoice_number}`);
  pdf.setAuthor(seller.legal_name || seller.store_name);
  pdf.setCreationDate(new Date(order.invoiced_at ?? order.created_at));
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage([A4.w, A4.h]);
  let y = A4.h - M;
  const text = (s: string, x: number, size = 10, f = font, color = INK) => page.drawText(safe(s), { x, y, size, font: f, color });
  const right = (s: string, xRight: number, size = 10, f = font, color = INK) =>
    page.drawText(safe(s), { x: xRight - f.widthOfTextAtSize(safe(s), size), y, size, font: f, color });
  const rule = () => page.drawLine({ start: { x: M, y }, end: { x: A4.w - M, y }, thickness: 0.6, color: LINE });

  // ── Header: seller (left), invoice meta (right)
  text(seller.store_name, M, 20, bold, BRAND);
  right("INVOICE", A4.w - M, 20, bold);
  y -= 22;
  const sellerLines = [
    seller.legal_name && seller.legal_name !== seller.store_name ? seller.legal_name : null,
    ...(seller.address ? wrap(seller.address, font, 9, 260) : []),
    seller.gstin ? `GSTIN: ${seller.gstin}` : null,
    seller.support_email,
  ].filter(Boolean) as string[];
  const meta: [string, string][] = [
    ["Invoice no.", order.invoice_number],
    ["Invoice date", date(order.invoiced_at ?? order.created_at, locale)],
    ["Order no.", `#${order.order_number}`],
    ["Order date", date(order.created_at, locale)],
    ...(paymentRef ? ([["Payment ref.", paymentRef]] as [string, string][]) : []),
  ];
  const top = y;
  for (const l of sellerLines) {
    text(l, M, 9, font, MUTED);
    y -= 13;
  }
  const leftBottom = y;
  y = top;
  for (const [k, v] of meta) {
    right(k, A4.w - M - 110, 9, font, MUTED);
    right(v, A4.w - M, 9, bold);
    y -= 13;
  }
  y = Math.min(leftBottom, y) - 18;
  rule();
  y -= 22;

  // ── Bill to / Ship to
  text("BILL TO", M, 8, bold, MUTED);
  text("SHIP TO", A4.w / 2, 8, bold, MUTED);
  y -= 14;
  const addressLines = [a.full_name, a.line1, a.line2, `${a.city}, ${a.state} ${a.postal_code}`, a.country, `Phone: ${a.phone}`].filter(
    Boolean,
  ) as string[];
  const billLines = [customer.name || a.full_name, customer.email].filter(Boolean) as string[];
  const blockTop = y;
  for (const l of billLines) {
    text(l, M, 10);
    y -= 13;
  }
  const billBottom = y;
  y = blockTop;
  for (const l of addressLines) {
    text(l, A4.w / 2, 10);
    y -= 13;
  }
  y = Math.min(billBottom, y) - 16;

  // ── Items table
  const col = { item: M, qty: A4.w - M - 210, price: A4.w - M - 100, amount: A4.w - M };
  const header = () => {
    page.drawRectangle({ x: M, y: y - 6, width: A4.w - 2 * M, height: 20, color: rgb(0.96, 0.96, 0.98) });
    text("Item", col.item + 6, 9, bold);
    right("Qty", col.qty, 9, bold);
    right("Unit price", col.price, 9, bold);
    right("Amount", col.amount - 6, 9, bold);
    y -= 24;
  };
  header();
  for (const it of items) {
    const name = wrap(it.variant_title ? `${it.product_name} (${it.variant_title})` : it.product_name, font, 10, col.qty - col.item - 60);
    if (y - name.length * 13 < M + 140) {
      page = pdf.addPage([A4.w, A4.h]);
      y = A4.h - M;
      header();
    }
    right(String(it.quantity), col.qty, 10);
    right(fmt(it.unit_price), col.price, 10);
    right(fmt(it.line_total), col.amount - 6, 10);
    for (const l of name) {
      text(l, col.item + 6, 10);
      y -= 13;
    }
    y -= 5;
    rule();
    y -= 14;
  }

  // ── Totals
  if (y < M + 150) {
    page = pdf.addPage([A4.w, A4.h]);
    y = A4.h - M;
  }
  const totals: [string, string, boolean?][] = [
    ["Subtotal", fmt(order.subtotal)],
    ...(order.discount > 0 ? ([[`Discount${order.coupon_code ? ` (${order.coupon_code})` : ""}`, `- ${fmt(order.discount)}`]] as [string, string][]) : []),
    ["Shipping", order.shipping ? fmt(order.shipping) : "Free"],
    ["Total", fmt(order.total), true],
  ];
  for (const [k, v, strong] of totals) {
    right(k, col.price, strong ? 11 : 10, strong ? bold : font, strong ? INK : MUTED);
    right(v, col.amount - 6, strong ? 11 : 10, strong ? bold : font);
    y -= strong ? 18 : 15;
  }
  right(order.status === "cancelled" ? "CANCELLED" : "PAID", col.amount - 6, 10, bold, order.status === "cancelled" ? rgb(0.75, 0.1, 0.1) : rgb(0.1, 0.5, 0.25));

  // ── Footer
  y = M + 30;
  for (const l of wrap(seller.invoice_notes ?? "", font, 8, A4.w - 2 * M)) {
    text(l, M, 8, font, MUTED);
    y -= 11;
  }
  text("This is a computer-generated invoice and does not require a signature.", M, 8, font, MUTED);

  return pdf.save();
}

export function invoiceFilename(invoiceNumber: string) {
  return `${invoiceNumber.replace(/[^A-Za-z0-9_-]/g, "_")}.pdf`;
}
