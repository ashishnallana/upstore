import "server-only";
import type { OrderDocument } from "@/lib/orders/document";
import { formatMoney } from "@/lib/utils";

// Transactional email templates. Table layout + inline styles: what email
// clients actually render. Every value from the database goes through esc().

export type OrderEmailKind = "paid" | "admin_new_order" | "shipped" | "delivered" | "cancelled";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const BRAND = "#4f46e5";

const esc = (s: string | number | null | undefined) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(storeName: string, preheader: string, body: string, footer: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(storeName)}</title></head>
<body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="padding:20px 28px;border-bottom:1px solid #e4e4e7;font-size:20px;font-weight:700;color:${BRAND}">${esc(storeName)}</td></tr>
<tr><td style="padding:28px">${body}</td></tr>
<tr><td style="padding:18px 28px;background:#fafafa;font-size:12px;color:#71717a;line-height:1.6">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<a href="${esc(href)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px">${esc(label)}</a>`;

function itemsTable({ order, items, seller }: OrderDocument) {
  const fmt = (n: number) => esc(formatMoney(n, order.currency, seller.locale));
  const rows = items
    .map(
      (i) => `<tr>
  <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;font-size:14px">${esc(i.product_name)}${
    i.variant_title ? `<br><span style="color:#71717a;font-size:12px">${esc(i.variant_title)}</span>` : ""
  }</td>
  <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;font-size:14px;text-align:center;color:#71717a">× ${i.quantity}</td>
  <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;font-size:14px;text-align:right">${fmt(i.line_total)}</td></tr>`,
    )
    .join("");
  const line = (label: string, value: string, strong = false) =>
    `<tr><td colspan="2" style="padding:4px 0;font-size:${strong ? 15 : 13}px;color:${strong ? "#18181b" : "#71717a"};${strong ? "font-weight:700" : ""}">${esc(label)}</td><td style="padding:4px 0;text-align:right;font-size:${strong ? 15 : 13}px;${strong ? "font-weight:700" : ""}">${value}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0">${rows}
${line("Subtotal", fmt(order.subtotal))}
${order.discount > 0 ? line(`Discount${order.coupon_code ? ` (${order.coupon_code})` : ""}`, `−${fmt(order.discount)}`) : ""}
${line("Shipping", order.shipping ? fmt(order.shipping) : "Free")}
${line("Total", fmt(order.total), true)}</table>`;
}

function addressBlock({ order }: OrderDocument) {
  const a = order.shipping_address;
  return `<p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:.04em">Shipping to</p>
<p style="margin:0;font-size:14px;line-height:1.6">${esc(a.full_name)}<br>${esc(a.line1)}${a.line2 ? `, ${esc(a.line2)}` : ""}<br>${esc(a.city)}, ${esc(a.state)} ${esc(a.postal_code)}</p>`;
}

function textItems({ order, items, seller }: OrderDocument) {
  const fmt = (n: number) => formatMoney(n, order.currency, seller.locale);
  return [
    ...items.map((i) => `- ${i.product_name}${i.variant_title ? ` (${i.variant_title})` : ""} x${i.quantity}: ${fmt(i.line_total)}`),
    `Total: ${fmt(order.total)}`,
  ].join("\n");
}

function footer(doc: OrderDocument) {
  const s = doc.seller;
  return [
    esc(s.legal_name || s.store_name),
    s.address ? esc(s.address).replace(/\n/g, ", ") : "",
    s.gstin ? `GSTIN ${esc(s.gstin)}` : "",
    s.support_email ? `Questions? Reply to this email or write to <a href="mailto:${esc(s.support_email)}" style="color:#71717a">${esc(s.support_email)}</a>.` : "",
  ]
    .filter(Boolean)
    .join("<br>");
}

export function renderOrderEmail(kind: OrderEmailKind, doc: OrderDocument, site: string, note?: string | null): RenderedEmail {
  const { order, seller, customer } = doc;
  const name = esc((customer.name || order.shipping_address.full_name).split(" ")[0]);
  const orderUrl = `${site}/account/orders/${order.id}`;
  const store = seller.store_name;
  const total = formatMoney(order.total, order.currency, seller.locale);
  const p = (html: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6">${html}</p>`;
  const h = (t: string) => `<h1 style="margin:0 0 14px;font-size:22px">${esc(t)}</h1>`;

  switch (kind) {
    case "paid":
      return {
        subject: `Order #${order.order_number} confirmed: thank you!`,
        html: layout(
          store,
          `We've received your payment of ${total}.`,
          `${h("Thanks for your order!")}${p(`Hi ${name}, we've received your payment and your order <strong>#${order.order_number}</strong> is confirmed. Your invoice <strong>${esc(order.invoice_number)}</strong> is attached.`)}
${itemsTable(doc)}${addressBlock(doc)}<p style="margin:24px 0 0">${button(orderUrl, "View your order")}</p>`,
          footer(doc),
        ),
        text: `Thanks for your order!\n\nOrder #${order.order_number} is confirmed. Invoice ${order.invoice_number} is attached.\n\n${textItems(doc)}\n\nView your order: ${orderUrl}`,
      };

    case "admin_new_order":
      return {
        subject: `New order #${order.order_number}: ${total}`,
        html: layout(
          store,
          `${customer.name ?? "A customer"} paid ${total}.`,
          `${h(`New paid order #${order.order_number}`)}${p(`${esc(customer.name)} (${esc(customer.email)}) paid <strong>${esc(total)}</strong>.`)}
${itemsTable(doc)}${addressBlock(doc)}<p style="margin:24px 0 0">${button(`${site}/admin/orders/${order.id}`, "Open in admin")}</p>`,
          "Sent to the store admin address (MAIL_ADMIN_TO).",
        ),
        text: `New paid order #${order.order_number} from ${customer.name} <${customer.email}>.\n\n${textItems(doc)}\n\n${site}/admin/orders/${order.id}`,
      };

    case "shipped":
      return {
        subject: `Order #${order.order_number} has shipped`,
        html: layout(
          store,
          "Your order is on its way.",
          `${h("Your order is on its way")}${p(`Hi ${name}, good news: order <strong>#${order.order_number}</strong> has shipped.`)}${
            note ? p(`<strong>Shipping details:</strong> ${esc(note)}`) : ""
          }${addressBlock(doc)}<p style="margin:24px 0 0">${button(orderUrl, "Track your order")}</p>`,
          footer(doc),
        ),
        text: `Order #${order.order_number} has shipped.${note ? `\nShipping details: ${note}` : ""}\n\n${orderUrl}`,
      };

    case "delivered": {
      const reviewUrl = doc.items.find((i) => i.product_slug) ? `${site}/p/${doc.items.find((i) => i.product_slug)!.product_slug}#reviews` : orderUrl;
      return {
        subject: `Order #${order.order_number} was delivered`,
        html: layout(
          store,
          "Your order was delivered. How did we do?",
          `${h("Delivered!")}${p(`Hi ${name}, order <strong>#${order.order_number}</strong> has been delivered. We hope you love it.`)}${p(
            "Got a minute? A short review helps other shoppers decide.",
          )}<p style="margin:24px 0 0">${button(reviewUrl, "Write a review")}</p>`,
          footer(doc),
        ),
        text: `Order #${order.order_number} was delivered. Leave a review: ${reviewUrl}`,
      };
    }

    case "cancelled": {
      const wasPaid = Boolean(order.invoice_number);
      return {
        subject: `Order #${order.order_number} was cancelled`,
        html: layout(
          store,
          "Your order was cancelled.",
          `${h("Your order was cancelled")}${p(`Hi ${name}, order <strong>#${order.order_number}</strong> has been cancelled.`)}${
            wasPaid ? p(`Your payment of <strong>${esc(total)}</strong> will be refunded to the original payment method.`) : ""
          }${note ? p(`Note: ${esc(note)}`) : ""}<p style="margin:24px 0 0">${button(orderUrl, "View order")}</p>`,
          footer(doc),
        ),
        text: `Order #${order.order_number} was cancelled.${wasPaid ? ` Your payment of ${total} will be refunded.` : ""}\n\n${orderUrl}`,
      };
    }
  }
}

export function renderTestEmail(storeName: string): RenderedEmail {
  return {
    subject: `Test email from ${storeName}`,
    html: layout(storeName, "Email is working.", `<h1 style="margin:0 0 14px;font-size:22px">It works!</h1><p style="margin:0;font-size:15px">Your store can send email. Order confirmations, invoices and shipping updates will go out from this address.</p>`, "Sent from Admin → Settings."),
    text: "It works! Your store can send email.",
  };
}
