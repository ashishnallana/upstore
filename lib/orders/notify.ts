import "server-only";
import { after } from "next/server";
import { mailConfigured, sendMail } from "@/lib/email/mailer";
import { renderOrderEmail, type OrderEmailKind } from "@/lib/email/templates";
import { invoiceFilename, renderInvoicePdf } from "@/lib/invoice/pdf";
import { loadOrderDocument, type OrderDocument } from "@/lib/orders/document";
import { adminClient } from "@/lib/supabase/admin";

export type OrderEvent = "paid" | "shipped" | "delivered" | "cancelled";

const site = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

/**
 * Send the emails for an order event after the response is sent, so checkout,
 * webhooks and admin actions never wait on SMTP. Failures are logged in
 * email_log (Admin → order page) and can be resent from there.
 */
export function queueOrderEmails(orderId: string, event: OrderEvent) {
  after(() =>
    sendOrderEmails(orderId, event).catch((err) => console.error(`[email] ${event} for order ${orderId} failed:`, err)),
  );
}

export async function sendOrderEmails(orderId: string, event: OrderEvent) {
  const doc = await loadOrderDocument(orderId);
  if (!doc) return;
  await deliver(event, doc, doc.customer.email);
  if (event === "paid" && process.env.MAIL_ADMIN_TO) await deliver("admin_new_order", doc, process.env.MAIL_ADMIN_TO);
}

/** Admin "resend": forget the previous attempt and send again. */
export async function resendOrderEmail(orderId: string, kind: OrderEmailKind) {
  await adminClient().from("email_log").delete().eq("order_id", orderId).eq("kind", kind);
  const doc = await loadOrderDocument(orderId);
  if (!doc) throw new Error("Order not found");
  await deliver(kind, doc, kind === "admin_new_order" ? process.env.MAIL_ADMIN_TO : doc.customer.email);
}

async function deliver(kind: OrderEmailKind, doc: OrderDocument, to: string | null | undefined) {
  if (!to) return;
  const db = adminClient();
  const { order } = doc;

  // Shipping / cancellation notes the admin typed when changing the status.
  let note: string | null = null;
  if (kind === "shipped" || kind === "cancelled") {
    const { data } = await db
      .from("order_events")
      .select("note")
      .eq("order_id", order.id)
      .eq("status", kind)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    note = data?.note ?? null;
  }

  const email = renderOrderEmail(kind, doc, site(), note);
  const configured = mailConfigured();

  // Claim (order, kind) first: the unique key makes this the only sender.
  const { data: claim, error } = await db
    .from("email_log")
    .insert({
      order_id: order.id,
      kind,
      to_email: to,
      subject: email.subject,
      status: configured ? "sending" : "skipped",
      error: configured ? null : "SMTP is not configured (SMTP_USER / SMTP_PASS)",
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return; // already sent or in flight
    throw new Error(error.message);
  }
  if (!configured) {
    console.info(`[email] skipped "${email.subject}" to ${to}: SMTP not configured`);
    return;
  }

  try {
    const attachInvoice = kind === "paid" && order.invoice_number;
    await sendMail({
      to,
      replyTo: doc.seller.support_email ?? undefined,
      ...email,
      attachments: attachInvoice
        ? [{ filename: invoiceFilename(order.invoice_number!), content: await renderInvoicePdf(doc), contentType: "application/pdf" }]
        : undefined,
    });
    await db.from("email_log").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", claim.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.from("email_log").update({ status: "failed", error: message.slice(0, 500) }).eq("id", claim.id);
    throw err;
  }
}
