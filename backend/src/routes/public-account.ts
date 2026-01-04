import { Router } from "express";
import prisma from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../utils/security.js";
import {
  clearCustomerCookie,
  readCustomerSession,
  setCustomerCookie,
  signCustomerToken,
} from "../lib/customer-auth.js";
import { ensureMembership, linkPaidGuestOrders, mergeGuestCart } from "../lib/public-customer.js";
import { publicAuthLimiter, requireSameOrigin } from "../lib/public-auth-guards.js";
import { hashCustomerVerificationToken, issueCustomerEmailVerification } from "../lib/customer-email-verification.js";
import { buildConsentBanner } from "../lib/public-consent-banner.js";

const router = Router();

function escHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderAccountPage(
  storefrontSlug: string,
  storefrontName: string,
  consentStyles: string,
  consentBanner: string
) {
  const title = escHtml(`${storefrontName} · Account`);
  const safeName = escHtml(storefrontName);
  const safeSlug = encodeURIComponent(storefrontSlug);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
  <style>
    :root{--bg:#f8fafc;--panel:#fff;--text:#0f172a;--muted:#64748b;--border:#e2e8f0;--brand:#0ea5e9;--brand-dark:#0284c7}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
    a{text-decoration:none;color:inherit}
    .wrap{max-width:1180px;margin:0 auto;padding:32px 24px 48px}
    .layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:32px;align-items:start}
    .card{background:var(--panel);border:1px solid var(--border);border-radius:18px;padding:24px}
    .title{margin:0 0 6px;font-size:1.75rem}
    .muted{color:var(--muted)}
    .lead{margin:0 0 24px;color:var(--muted);max-width:420px}
    .input{width:100%;padding:12px 14px;border-radius:12px;border:1px solid var(--border);margin-bottom:12px;font-size:0.95rem}
    .btn{display:inline-flex;align-items:center;justify-content:center;border-radius:12px;border:1px solid var(--border);padding:12px 16px;background:#fff;color:var(--text);cursor:pointer;font-weight:600}
    .btn.primary{background:var(--brand);color:#fff;border-color:transparent}
    .btn.primary:hover{background:var(--brand-dark)}
    .btn-row{display:flex;gap:10px;flex-wrap:wrap}
    .hidden{display:none}
    .divider{height:1px;background:var(--border);margin:20px 0}
    .promo{background:linear-gradient(180deg,#f8fafc 0%,#fff 100%);border:1px solid var(--border);border-radius:18px;padding:28px}
    .promo h2{margin:0 0 10px;font-size:1.6rem}
    .promo p{margin:0 0 18px;color:var(--muted)}
    .promo-list{list-style:none;margin:0;padding:0;display:grid;gap:14px}
    .promo-list li{display:flex;gap:10px;align-items:flex-start;font-size:0.98rem}
    .promo-list li::before{content:"✓";display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:999px;background:#e0f2fe;color:var(--brand-dark);font-weight:700;font-size:0.85rem;flex-shrink:0;margin-top:2px}
    .promo-foot{margin-top:24px;padding-top:16px;border-top:1px solid var(--border);color:var(--muted);font-size:0.9rem}
    @media (max-width: 900px){
      .layout{grid-template-columns:1fr}
    }
  </style>
  ${consentStyles}
</head>
<body>
  ${consentBanner}
  <div class="wrap">
    <div class="layout">
      <div>
        <h1 class="title">${safeName} account</h1>
        <p class="lead">Sign in or create an account to manage your tickets.</p>

        <div class="card" id="signed-out">
          <h2>Sign in</h2>
          <input class="input" id="loginEmail" type="email" placeholder="Email" autocomplete="email" />
          <input class="input" id="loginPassword" type="password" placeholder="Password" autocomplete="current-password" />
          <div class="btn-row">
            <button class="btn primary" id="loginBtn">Sign in</button>
          </div>

          <div class="divider"></div>

          <h2>Create account</h2>
          <input class="input" id="signupName" type="text" placeholder="Full name" autocomplete="name" />
          <input class="input" id="signupEmail" type="email" placeholder="Email" autocomplete="email" />
          <input class="input" id="signupPassword" type="password" placeholder="Password" autocomplete="new-password" />
          <label style="display:flex;gap:8px;align-items:center;font-size:.9rem;margin-bottom:10px">
            <input type="checkbox" id="signupConsent" />
            I agree to receive updates from ${safeName}.
          </label>
          <div class="btn-row">
            <button class="btn" id="signupBtn">Create account</button>
          </div>
          <p class="muted" id="authMessage"></p>
        </div>

        <div class="card hidden" id="signed-in" style="margin-top:16px">
          <h2>You're signed in</h2>
          <p class="muted" id="welcomeText"></p>
          <div class="btn-row">
            <a class="btn primary" href="/public/${safeSlug}/account/portal">Go to portal</a>
            <button class="btn" id="logoutBtn">Sign out</button>
          </div>
        </div>
      </div>

      <aside class="promo">
        <h2>Events, ticketing, and products—together.</h2>
        <p>Get closer to the venues, shows, and artists you love with a single account.</p>
        <ul class="promo-list">
          <li>Discover upcoming events and the tickets that fit your night.</li>
          <li>Save your details to check out faster when new shows go live.</li>
          <li>Stay in the loop on exclusive merch drops and VIP moments.</li>
        </ul>
        <div class="promo-foot">One account unlocks your next live experience.</div>
      </aside>
    </div>
  </div>

  <script>
    const storefrontSlug = ${JSON.stringify(storefrontSlug)};
    const authMessage = document.getElementById('authMessage');
    const signedOut = document.getElementById('signed-out');
    const signedIn = document.getElementById('signed-in');
    const welcomeText = document.getElementById('welcomeText');

    async function postJSON(url, payload) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload || {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    }

    async function getJSON(url) {
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    }

    async function applySession() {
      try {
        const data = await getJSON('/public/auth/session?storefront=' + encodeURIComponent(storefrontSlug));
        if (!data.ok || !data.customer) return;
        signedOut.classList.add('hidden');
        signedIn.classList.remove('hidden');
        welcomeText.textContent = 'Signed in as ' + data.customer.email;
      } catch {}
    }

    document.getElementById('loginBtn').addEventListener('click', async () => {
      authMessage.textContent = '';
      try {
        await postJSON('/public/' + storefrontSlug + '/account/login', {
          email: document.getElementById('loginEmail').value,
          password: document.getElementById('loginPassword').value,
        });
        location.reload();
      } catch (err) {
        authMessage.textContent = err.message || 'Sign in failed';
      }
    });

    document.getElementById('signupBtn').addEventListener('click', async () => {
      authMessage.textContent = '';
      try {
        const data = await postJSON('/public/' + storefrontSlug + '/account/register', {
          name: document.getElementById('signupName').value,
          email: document.getElementById('signupEmail').value,
          password: document.getElementById('signupPassword').value,
          marketingConsent: document.getElementById('signupConsent').checked,
        });
        if (data.requiresVerification) {
          authMessage.textContent = data.message || 'Check your email to verify your account.';
          return;
        }
        location.reload();
      } catch (err) {
        authMessage.textContent = err.message || 'Signup failed';
      }
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await postJSON('/public/' + storefrontSlug + '/account/logout');
      location.reload();
    });

    applySession();
  </script>
</body>
</html>`;
}

function formatShortDate(input: Date | string | null) {
  if (!input) return "TBD";
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatMoney(amountPence: number | null | undefined) {
  const amount = Number(amountPence || 0) / 100;
  return `£${amount.toFixed(2)}`;
}

function renderPortalPage(
  storefrontSlug: string,
  storefrontName: string,
  customer: { email: string; name: string | null; phone: string | null },
  membershipOptIn: boolean | null,
  orders: Array<{
    id: string;
    amountPence: number;
    status: string;
    createdAt: Date;
    showTitle: string;
    showDate: Date | null;
    venue: { name: string | null; city: string | null } | null;
  }>,
  tickets: Array<{
    id: string;
    showTitle: string;
    showDate: Date | null;
    ticketType: string;
    quantity: number;
    seatRef: string | null;
  }>,
  consentStyles: string,
  consentBanner: string
) {
  const safeSlug = encodeURIComponent(storefrontSlug);
  const safeName = escHtml(storefrontName);
  const safeEmail = escHtml(customer.email);
  const safeCustomerName = escHtml(customer.name || "Not provided");
  const safeCustomerPhone = escHtml(customer.phone || "Not provided");
  const membershipLabel =
    membershipOptIn === null
      ? "Not set"
      : membershipOptIn
      ? "Opted in to organiser updates"
      : "Not opted in";
  const ordersHtml = orders.length
    ? orders
        .map((order) => {
          const venue = order.venue
            ? [order.venue.name, order.venue.city].filter(Boolean).join(" · ")
            : "";
          return `
          <div class="list-item">
            <strong>${escHtml(order.showTitle)}</strong>
            <div class="muted">${escHtml(formatShortDate(order.showDate))}${venue ? ` • ${escHtml(venue)}` : ""}</div>
            <div class="muted" style="margin-top:6px">${escHtml(formatMoney(order.amountPence))} · ${escHtml(
              order.status
            )}</div>
          </div>`;
        })
        .join("")
    : '<span class="muted">No orders yet for this organiser.</span>';
  const ticketsHtml = tickets.length
    ? tickets
        .map((ticket) => {
          const seatLabel = ticket.seatRef ? ` • Seat ${escHtml(ticket.seatRef)}` : "";
          return `
          <div class="list-item">
            <strong>${escHtml(ticket.showTitle)}</strong>
            <div class="muted">${escHtml(formatShortDate(ticket.showDate))} • ${escHtml(
              ticket.ticketType
            )}${seatLabel}</div>
            <div class="muted" style="margin-top:6px">${escHtml(String(ticket.quantity))} ticket${
              ticket.quantity === 1 ? "" : "s"
            }</div>
          </div>`;
        })
        .join("")
    : '<span class="muted">No tickets yet for this organiser.</span>';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${safeName} · Portal</title>
  <style>
    :root{--bg:#f8fafc;--panel:#fff;--text:#0f172a;--muted:#64748b;--border:#e2e8f0;--brand:#0ea5e9}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
    a{text-decoration:none;color:inherit}
    .wrap{max-width:760px;margin:0 auto;padding:24px}
    .card{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:20px}
    .title{margin:0 0 6px;font-size:1.6rem}
    .muted{color:var(--muted)}
    .btn{display:inline-flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid var(--border);padding:10px 14px;background:#fff;color:var(--text);cursor:pointer}
    .btn.primary{background:var(--brand);color:#fff;border-color:transparent}
    .btn-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
    .section{margin-top:18px}
    .list{display:grid;gap:12px}
    .list-item{padding:12px;border:1px solid var(--border);border-radius:12px;background:#fff}
    .input{width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--border);margin-top:10px}
  </style>
  ${consentStyles}
</head>
<body>
  ${consentBanner}
  <div class="wrap">
    <h1 class="title">${safeName} portal</h1>
    <div class="card">
      <p class="muted">Signed in as ${safeEmail}.</p>
      <div class="section">
        <strong>Saved details</strong>
        <div class="muted" style="margin-top:6px">Name: ${safeCustomerName}</div>
        <div class="muted">Phone: ${safeCustomerPhone}</div>
      </div>
      <div class="section">
        <strong>Marketing preference</strong>
        <div class="muted" style="margin-top:6px">${escHtml(membershipLabel)}</div>
      </div>
      <div class="section">
        <strong>Orders</strong>
        <div class="list" style="margin-top:10px">${ordersHtml}</div>
      </div>
      <div class="section">
        <strong>Tickets</strong>
        <div class="list" style="margin-top:10px">${ticketsHtml}</div>
      </div>
      <div class="section">
        <strong>Security</strong>
        <div class="muted" style="margin-top:6px">Change your password.</div>
        <input class="input" id="currentPassword" type="password" placeholder="Current password" autocomplete="current-password" />
        <input class="input" id="newPassword" type="password" placeholder="New password" autocomplete="new-password" />
        <div class="btn-row">
          <button class="btn" id="changePasswordBtn">Update password</button>
        </div>
        <div class="muted" id="passwordMessage" style="margin-top:8px"></div>
      </div>
      <div class="btn-row">
        <a class="btn" href="/public/${safeSlug}/account">Back to account</a>
        <button class="btn primary" id="logoutBtn">Sign out</button>
      </div>
    </div>
  </div>
  <script>
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await fetch('/public/${safeSlug}/account/logout', { method: 'POST', credentials: 'include' });
      location.href = '/public/${safeSlug}/account';
    });

    document.getElementById('changePasswordBtn').addEventListener('click', async () => {
      const message = document.getElementById('passwordMessage');
      message.textContent = '';
      try {
        const res = await fetch('/public/${safeSlug}/account/portal/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            currentPassword: document.getElementById('currentPassword').value,
            newPassword: document.getElementById('newPassword').value,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Password update failed');
        message.textContent = 'Password updated.';
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
      } catch (err) {
        message.textContent = err.message || 'Password update failed';
      }
    });
  </script>
</body>
</html>`;
}

router.get("/:organiserSlug/account", async (req, res) => {
  const organiserSlug = String(req.params.organiserSlug || "").trim();
  const organiser = await prisma.user.findUnique({
    where: { storefrontSlug: organiserSlug },
    select: { companyName: true, name: true, storefrontSlug: true },
  });

  if (!organiser) return res.status(404).send("Not found");
  const storefrontName = organiser.companyName || organiser.name || organiser.storefrontSlug || organiserSlug;
  const consent = buildConsentBanner(req);
  res
    .type("html")
    .send(renderAccountPage(organiserSlug, storefrontName, consent.styles, consent.banner));
});

router.get("/:organiserSlug/account/portal", async (req, res) => {
  const organiserSlug = String(req.params.organiserSlug || "").trim();
  const organiser = await prisma.user.findUnique({
    where: { storefrontSlug: organiserSlug },
    select: { id: true, companyName: true, name: true, storefrontSlug: true },
  });

  if (!organiser) return res.status(404).send("Not found");

  const session = await readCustomerSession(req);
  if (!session?.sub) {
    return res.redirect(`/public/${encodeURIComponent(organiserSlug)}/account`);
  }

  const customer = await prisma.customerAccount.findUnique({
    where: { id: String(session.sub) },
    select: { id: true, email: true, name: true, phone: true },
  });

  if (!customer?.email) {
    clearCustomerCookie(res);
    return res.redirect(`/public/${encodeURIComponent(organiserSlug)}/account`);
  }

  const storefront = await prisma.storefront.findUnique({
    where: { slug: organiserSlug },
    select: { id: true },
  });

  const membership = storefront
    ? await prisma.customerStorefrontMembership.findFirst({
        where: { customerAccountId: customer.id, storefrontId: storefront.id },
        select: { marketingOptIn: true },
      })
    : null;

  const orders = await prisma.order.findMany({
    where: {
      customerAccountId: customer.id,
      show: { organiserId: organiser.id },
    },
    include: {
      show: { select: { title: true, date: true, venue: { select: { name: true, city: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const tickets = await prisma.ticket.findMany({
    where: {
      order: { customerAccountId: customer.id },
      show: { organiserId: organiser.id },
    },
    include: {
      show: { select: { title: true, date: true } },
      ticketType: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const storefrontName = organiser.companyName || organiser.name || organiser.storefrontSlug || organiserSlug;
  const consent = buildConsentBanner(req);
  res.type("html").send(
    renderPortalPage(
      organiserSlug,
      storefrontName,
      { email: customer.email, name: customer.name, phone: customer.phone },
      membership?.marketingOptIn ?? null,
      orders.map((order) => ({
        id: order.id,
        amountPence: order.amountPence,
        status: order.status,
        createdAt: order.createdAt,
        showTitle: order.show?.title || "Show",
        showDate: order.show?.date || null,
        venue: order.show?.venue || null,
      })),
      tickets.map((ticket) => ({
        id: ticket.id,
        showTitle: ticket.show?.title || "Show",
        showDate: ticket.show?.date || null,
        ticketType: ticket.ticketType?.name || "Ticket",
        quantity: ticket.quantity ?? 1,
        seatRef: ticket.seatRef || null,
      })),
      consent.styles,
      consent.banner
    )
  );
});

router.post("/:organiserSlug/account/register", publicAuthLimiter, requireSameOrigin, async (req, res) => {
  try {
    const organiserSlug = String(req.params.organiserSlug || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const name = String(req.body?.name || "").trim() || null;
    const marketingConsent = Boolean(req.body?.marketingConsent || false);
    const organiser = await prisma.user.findUnique({
      where: { storefrontSlug: organiserSlug },
      select: { id: true, companyName: true, name: true },
    });

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email and password are required" });
    }

    const existing = await prisma.customerAccount.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ ok: false, error: "Account already exists" });
    }

    const passwordHash = await hashPassword(password);
    const customer = await prisma.customerAccount.create({
      data: {
        email,
        passwordHash,
        name,
        marketingConsent,
      },
      select: { id: true, email: true, name: true },
    });

    const storefrontName = organiser?.companyName || organiser?.name || organiserSlug;
    await issueCustomerEmailVerification({
      customerId: customer.id,
      email: customer.email,
      req,
      verifyPath: `/public/${encodeURIComponent(organiserSlug)}/account/verify`,
      storefrontName,
    });

    console.info("public account register", { customerId: customer.id, organiserSlug });
    return res.status(201).json({
      ok: true,
      customer,
      requiresVerification: true,
      message: "Check your email to verify your account before signing in.",
    });
  } catch (error: any) {
    console.error("public account register failed", error);
    return res.status(500).json({ ok: false, error: "Failed to create account" });
  }
});

router.post("/:organiserSlug/account/login", publicAuthLimiter, requireSameOrigin, async (req, res) => {
  try {
    const organiserSlug = String(req.params.organiserSlug || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const organiser = await prisma.user.findUnique({
      where: { storefrontSlug: organiserSlug },
      select: { id: true, companyName: true, name: true },
    });

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email and password are required" });
    }

    const customer = await prisma.customerAccount.findUnique({ where: { email } });
    if (!customer || !customer.passwordHash) {
      console.warn("public account login failed", { organiserSlug, reason: "missing_account" });
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const ok = await verifyPassword(password, customer.passwordHash);
    if (!ok) {
      console.warn("public account login failed", { organiserSlug, reason: "invalid_password" });
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    if (!customer.emailVerifiedAt) {
      const storefrontName = organiser?.companyName || organiser?.name || organiserSlug;
      await issueCustomerEmailVerification({
        customerId: customer.id,
        email: customer.email,
        req,
        verifyPath: `/public/${encodeURIComponent(organiserSlug)}/account/verify`,
        storefrontName,
      });
      return res.status(403).json({
        ok: false,
        error: "Please verify your email to continue. We've sent you a new verification link.",
      });
    }

    await prisma.customerAccount.update({
      where: { id: customer.id },
      data: { lastLoginAt: new Date() },
    });

    await ensureMembership(customer.id, organiserSlug);
    await linkPaidGuestOrders(customer.id, customer.email, organiser?.id);
    await mergeGuestCart(req, res, customer.id, organiserSlug);

    const token = await signCustomerToken({ id: customer.id, email: customer.email });
    setCustomerCookie(res, token);

    console.info("public account login", { customerId: customer.id, organiserSlug });
    return res.json({ ok: true, customer: { id: customer.id, email: customer.email, name: customer.name } });
  } catch (error: any) {
    console.error("public account login failed", error);
    return res.status(500).json({ ok: false, error: "Login failed" });
  }
});

router.get("/:organiserSlug/account/verify", async (req, res) => {
  const organiserSlug = String(req.params.organiserSlug || "").trim();
  const token = String(req.query?.token || "").trim();
  if (!token) return res.status(400).send("Missing verification token.");

  const tokenHash = hashCustomerVerificationToken(token);
  const customer = await prisma.customerAccount.findFirst({
    where: {
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: { gt: new Date() },
    },
    select: { id: true, email: true },
  });

  if (!customer) return res.status(400).send("Verification link is invalid or expired.");

  await prisma.customerAccount.update({
    where: { id: customer.id },
    data: {
      emailVerifiedAt: new Date(),
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
    },
  });

  const organiser = await prisma.user.findUnique({
    where: { storefrontSlug: organiserSlug },
    select: { id: true },
  });

  await ensureMembership(customer.id, organiserSlug);
  await linkPaidGuestOrders(customer.id, customer.email, organiser?.id);

  const tokenJwt = await signCustomerToken({ id: customer.id, email: customer.email });
  setCustomerCookie(res, tokenJwt);

  return res.redirect(`/public/${encodeURIComponent(organiserSlug)}/account/portal`);
});

router.post("/:organiserSlug/account/logout", publicAuthLimiter, requireSameOrigin, async (req, res) => {
  const session = await readCustomerSession(req);
  const organiserSlug = String(req.params.organiserSlug || "").trim();
  clearCustomerCookie(res);
  if (session?.sub) {
    console.info("public account logout", { customerId: session.sub, organiserSlug });
  }
  res.json({ ok: true });
});

router.post("/:organiserSlug/account/portal/change-password", publicAuthLimiter, requireSameOrigin, async (req, res) => {
  const session = await readCustomerSession(req);
  if (!session?.sub) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const organiserSlug = String(req.params.organiserSlug || "").trim();
  const currentPassword = String(req.body?.currentPassword || "");
  const newPassword = String(req.body?.newPassword || "");

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ ok: false, error: "Current and new passwords are required" });
  }

  const customer = await prisma.customerAccount.findUnique({
    where: { id: String(session.sub) },
    select: { id: true, passwordHash: true },
  });

  if (!customer?.passwordHash) {
    return res.status(400).json({ ok: false, error: "Password update unavailable" });
  }

  const ok = await verifyPassword(currentPassword, customer.passwordHash);
  if (!ok) return res.status(401).json({ ok: false, error: "Invalid credentials" });

  const passwordHash = await hashPassword(newPassword);
  await prisma.customerAccount.update({
    where: { id: customer.id },
    data: { passwordHash },
  });

  console.info("public account password change", { customerId: customer.id, organiserSlug });
  return res.json({ ok: true });
});

export default router;
