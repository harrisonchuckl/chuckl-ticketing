// backend/src/lib/mailer.ts
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

export async function sendMail(args: SendMailArgs): Promise<void> {
  const SMTP_HOST = env("SMTP_HOST");
  const SMTP_PORT = Number(env("SMTP_PORT") || "587");
  const SMTP_USER = env("SMTP_USER");
  const SMTP_PASS = env("SMTP_PASS");
  const MAIL_FROM = env("MAIL_FROM") || SMTP_USER;

  // If SMTP isn’t configured, don’t crash the app or leak info.
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
    });

    await transporter.sendMail({
      from: MAIL_FROM,
      to: args.to,
      subject: args.subject,
      text: args.text,
      html: args.html,
    });
  } catch (err) {
    // Crucial: never take the server down because email failed.
    console.error("[mailer] send failed (nodemailer missing or SMTP error)", err);
  }
}
