import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

// SMTP transport (Gmail by default: smtp.gmail.com:465 with an App Password).
// When SMTP isn't configured, emails are skipped and logged, never thrown, so
// local development and checkout keep working without credentials.

let transporter: Transporter | undefined;

export function mailConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function transport() {
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: (process.env.SMTP_SECURE ?? "true") !== "false",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    pool: true,
    maxConnections: 2,
  });
  return transporter;
}

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: { filename: string; content: Uint8Array; contentType: string }[];
}

/** Send one email. Gmail rewrites the From address to the authenticated account. */
export async function sendMail(mail: Mail) {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER!;
  await transport().sendMail({
    from,
    to: mail.to,
    replyTo: mail.replyTo,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    attachments: mail.attachments?.map((a) => ({ ...a, content: Buffer.from(a.content) })),
  });
}
