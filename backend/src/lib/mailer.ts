import nodemailer from "nodemailer";

type SendMailArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

function hasSmtpConfigured() {
  return !!(process.env.SMTP_URL || process.env.SMTP_HOST);
}

function makeTransport() {
  if (process.env.SMTP_URL) {
    return nodemailer.createTransport(process.env.SMTP_URL);
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // common rule
    auth: user && pass ? { user, pass } : undefined,
  });
}

export async function sendMail(args: SendMailArgs) {
  if (!hasSmtpConfigured()) {
    // Safe fallback: don’t crash prod if SMTP isn’t set yet
    console.log("[mail] SMTP not configured — would have emailed:", {
      to: args.to,
      subject: args.subject,
      text: args.text,
    });
    return { skipped: true };
  }

  const from = process.env.EMAIL_FROM || "no-reply@chuckl.co.uk";
  const transport = makeTransport();

  return transport.sendMail({
    from,
    to: args.to,
    subject: args.subject,
    text: args.text,
    html: args.html,
  });
}
