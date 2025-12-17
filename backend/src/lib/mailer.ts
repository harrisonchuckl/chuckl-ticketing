// backend/src/lib/mailer.ts
import { Resend } from "resend";

type SendMailArgs = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

function env(name: string) {
  const v = process.env[name];
  return typeof v === "string" ? v : "";
}

function isProd() {
  return process.env.NODE_ENV === "production";
}

function normaliseFrom() {
  // Resend requires a verified sender.
  // Example: "TicketIn <hello@chuckl.co.uk>"
  const from = env("MAIL_FROM");
  const fromName = env("MAIL_FROM_NAME");

  if (from) return from;
  if (fromName && env("SMTP_USER")) return `${fromName} <${env("SMTP_USER")}>`;
  if (env("SMTP_USER")) return env("SMTP_USER");

  // Safe fallback (still may fail on Resend if not verified)
  return "TicketIn <hello@chuckl.co.uk>";
}

export async function sendMail(args: SendMailArgs): Promise<void> {
  const RESEND_API_KEY = env("RESEND_API_KEY");
  const MAIL_FROM = normaliseFrom();
  const REPLY_TO = env("MAIL_REPLY_TO");

  console.log("[mailer] sendMail called", {
    to: args.to,
    subject: args.subject,
    hasResendKey: Boolean(RESEND_API_KEY),
    nodeEnv: process.env.NODE_ENV,
    from: MAIL_FROM,
    replyTo: REPLY_TO || null,
    hasHtml: Boolean(args.html),
    hasText: Boolean(args.text),
  });

  // Prefer Resend if configured (recommended for Railway/prod)
  if (RESEND_API_KEY) {
    try {
      const resend = new Resend(RESEND_API_KEY);

           const result = await resend.emails.send({
        from: MAIL_FROM,
        to: [args.to],
        subject: args.subject,
        html: args.html ?? (args.text ? `<pre>${escapeHtml(args.text)}</pre>` : "<p></p>"),
        text: args.text,
        replyTo: REPLY_TO || undefined,
      });

      console.log("[mailer] resend result", result);
      return;
    } catch (err) {
      console.error("[mailer] send failed (resend)", err);
      return;
    }
  }

  // In production, if Resend isn't configured, don't hang on SMTP attempts
  // (this prevents your “Sending…” UX issues)
  if (isProd()) {
    console.warn("[mailer] RESEND_API_KEY not configured; skipping email send", {
      to: args.to,
      subject: args.subject,
    });
    return;
  }

  // Dev/local SMTP fallback
  const SMTP_HOST = env("SMTP_HOST");
  const SMTP_PORT = Number(env("SMTP_PORT") || "587");
  const SMTP_USER = env("SMTP_USER");
  const SMTP_PASS = env("SMTP_PASS");

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn("[mailer] SMTP not configured; skipping email send", {
      to: args.to,
      subject: args.subject,
    });
    return;
  }

  try {
    const mod: any = await import("nodemailer");
    const nodemailer: any = mod?.default ?? mod;
    const secure = SMTP_PORT === 465;

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      // keep timeouts short in dev so it never “hangs”
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    });

    await transporter.sendMail({
      from: MAIL_FROM || SMTP_USER,
      to: args.to,
      subject: args.subject,
      text: args.text,
      html: args.html,
      replyTo: REPLY_TO || undefined,
    });
  } catch (err) {
    console.error("[mailer] send failed (nodemailer)", err);
  }
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
