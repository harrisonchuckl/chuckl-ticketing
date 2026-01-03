import crypto from "crypto";
import prisma from "./prisma.js";
import { sendMail } from "./mailer.js";

const DEFAULT_TTL_HOURS = Number(process.env.CUSTOMER_EMAIL_VERIFICATION_TTL_HOURS || "24");

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function getPublicBaseUrl(req: any) {
  const envBase =
    process.env.PUBLIC_BASE_URL ||
    process.env.APP_BASE_URL ||
    process.env.BASE_URL ||
    "";

  if (envBase) return envBase.replace(/\/+$/, "");

  const proto = (req.headers["x-forwarded-proto"] || req.protocol || "https").toString();
  const host = (req.headers["x-forwarded-host"] || req.headers.host || "").toString();
  return `${proto}://${host}`.replace(/\/+$/, "");
}

export function hashCustomerVerificationToken(token: string) {
  return sha256(token);
}

export async function issueCustomerEmailVerification({
  customerId,
  email,
  req,
  verifyPath,
  storefrontName,
}: {
  customerId: string;
  email: string;
  req: any;
  verifyPath: string;
  storefrontName?: string | null;
}) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + DEFAULT_TTL_HOURS * 60 * 60 * 1000);

  await prisma.customerAccount.update({
    where: { id: customerId },
    data: {
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: expiresAt,
    },
  });

  const baseUrl = getPublicBaseUrl(req);
  const verifyUrl = `${baseUrl}${verifyPath}?token=${encodeURIComponent(token)}`;
  const brandLabel = storefrontName || "TixAll";

  await sendMail({
    to: email,
    subject: `Verify your ${brandLabel} account email`,
    text:
      `Hi,\n\n` +
      `Please verify your email address to access your tickets and orders.\n\n` +
      `Verify your email: ${verifyUrl}\n\n` +
      `This link expires in ${DEFAULT_TTL_HOURS} hours.`,
    html:
      `<p>Hi,</p>` +
      `<p>Please verify your email address to access your tickets and orders.</p>` +
      `<p><a href="${verifyUrl}">Verify your email</a></p>` +
      `<p>This link expires in ${DEFAULT_TTL_HOURS} hours.</p>`,
  });

  return { verifyUrl, expiresAt };
}
