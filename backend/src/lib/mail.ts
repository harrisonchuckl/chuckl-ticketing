// backend/src/lib/mail.ts
import nodemailer from 'nodemailer';
import { Resend } from 'resend';

const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@example.com';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:4000';

function haveResend() {
  return !!process.env.RESEND_API_KEY;
}

async function sendWithResend(to: string, subject: string, html: string) {
  const resend = new Resend(process.env.RESEND_API_KEY as string);
  const r = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html
  });
  return r?.id || 'resend:ok';
}

async function sendWithSmtp(to: string, subject: string, html: string) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || 'false') === 'true';

  if (!host || !user || !pass) {
    throw new Error('SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS.');
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });

  const info = await transporter.sendMail({ from: FROM_EMAIL, to, subject, html });
  return info.messageId || 'smtp:ok';
}

// Generic helper
export async function sendMail(to: string, subject: string, html: string) {
  if (haveResend()) return sendWithResend(to, subject, html);
  return sendWithSmtp(to, subject, html);
}

// Specific template for password reset
export async function sendPasswordResetEmail(to: string, resetLink: string) {
  const subject = 'Reset your password';
  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; line-height:1.5;">
    <h2>Password reset</h2>
    <p>We received a request to reset your password. Click the button below to set a new password.</p>
    <p><a href="${resetLink}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;">Reset password</a></p>
    <p>If the button doesn’t work, copy and paste this link into your browser:</p>
    <p><a href="${resetLink}">${resetLink}</a></p>
    <p style="color:#6b7280;font-size:13px;">If you did not request this, you can safely ignore this email.</p>
  </div>`;
  return sendMail(to, subject, html);
}

// Utility to build links (used by auth routes)
export function buildPublicUrl(path: string) {
  const base = PUBLIC_BASE_URL.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}
