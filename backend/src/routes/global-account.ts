import { Router } from "express";
import prisma from "../lib/prisma.js";
import { clearCustomerCookie, readCustomerSession, setCustomerCookie, signCustomerToken } from "../lib/customer-auth.js";
import { hashPassword, verifyPassword } from "../utils/security.js";
import { publicAuthLimiter, requireSameOrigin } from "../lib/public-auth-guards.js";
import { hashCustomerVerificationToken } from "../lib/customer-email-verification.js";
import { linkPaidGuestOrders } from "../lib/public-customer.js";

const router = Router();

function escHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderGlobalAccountPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Account</title>
  <style>
    :root{--bg:#f8fafc;--panel:#fff;--text:#0f172a;--muted:#64748b;--border:#e2e8f0;--brand:#0ea5e9}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
    a{text-decoration:none;color:inherit}
    .wrap{max-width:760px;margin:0 auto;padding:24px}
    .card{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:20px}
    .title{margin:0 0 6px;font-size:1.6rem}
    .muted{color:var(--muted)}
    .input{width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--border);margin-bottom:10px}
    .btn{display:inline-flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid var(--border);padding:10px 14px;background:#fff;color:var(--text);cursor:pointer}
    .btn.primary{background:var(--brand);color:#fff;border-color:transparent}
    .btn-row{display:flex;gap:10px;flex-wrap:wrap}
    .hidden{display:none}
    .divider{height:1px;background:var(--border);margin:16px 0}
  </style>
</head>
<body>
  <div class="wrap">
    <h1 class="title">Account</h1>
    <p class="muted">Sign in or create an account to manage tickets across venues.</p>

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
        I agree to receive updates from TixAll.
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
        <a class="btn primary" href="/account/portal">Go to portal</a>
        <button class="btn" id="logoutBtn">Sign out</button>
      </div>
    </div>
  </div>

  <script>
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
        const data = await getJSON('/public/auth/session');
        if (!data.ok || !data.customer) return;
        signedOut.classList.add('hidden');
        signedIn.classList.remove('hidden');
        welcomeText.textContent = 'Signed in as ' + data.customer.email;
      } catch {}
    }

    document.getElementById('loginBtn').addEventListener('click', async () => {
      authMessage.textContent = '';
      try {
        await postJSON('/public/auth/login', {
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
        const data = await postJSON('/public/auth/signup', {
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
      await postJSON('/public/auth/logout');
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

function renderGlobalPortalPage({
  customer,
  marketingConsent,
  orders,
  tickets,
  venues,
}: {
  customer: { email: string; name: string | null; phone: string | null };
  marketingConsent: boolean | null;
  orders: Array<{
    id: string;
    amountPence: number;
    status: string;
    createdAt: Date;
    showTitle: string;
    showDate: Date | null;
    venue: { name: string | null; city: string | null } | null;
    organiserName: string | null;
  }>;
  tickets: Array<{
    id: string;
    showTitle: string;
    showDate: Date | null;
    ticketType: string;
    quantity: number;
    seatRef: string | null;
  }>;
  venues: Array<{ slug: string; name: string }>;
}) {
  const safeEmail = escHtml(customer.email);
  const safeCustomerName = escHtml(customer.name || "Not provided");
  const safeCustomerPhone = escHtml(customer.phone || "Not provided");
  const marketingLabel =
    marketingConsent === null
      ? "Not set"
      : marketingConsent
      ? "Opted in to updates"
      : "Not opted in";
  const ordersHtml = orders.length
    ? orders
        .map((order) => {
          const venueLabel = order.venue
            ? [order.venue.name, order.venue.city].filter(Boolean).join(" · ")
            : "";
          const organiserLabel = order.organiserName ? ` • ${escHtml(order.organiserName)}` : "";
          return `
          <div class="list-item">
            <strong>${escHtml(order.showTitle)}</strong>
            <div class="muted">${escHtml(formatShortDate(order.showDate))}${venueLabel ? ` • ${escHtml(venueLabel)}` : ""}${organiserLabel}</div>
            <div class="muted" style="margin-top:6px">${escHtml(formatMoney(order.amountPence))} · ${escHtml(
              order.status
            )}</div>
          </div>`;
        })
        .join("")
    : '<span class="muted">No orders yet.</span>';
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
    : '<span class="muted">No tickets yet.</span>';
  const venuesHtml = venues.length
    ? venues
        .map(
          (venue) =>
            `<a class="btn" href="/public/${encodeURIComponent(venue.slug)}/account/portal">${escHtml(venue.name)}</a>`
        )
        .join("")
    : '<span class="muted">No venues yet.</span>';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Account · Portal</title>
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
</head>
<body>
  <div class="wrap">
    <h1 class="title">Account portal</h1>
    <div class="card">
      <p class="muted">Signed in as ${safeEmail}.</p>
      <div class="section">
        <strong>Saved details</strong>
        <div class="muted" style="margin-top:6px">Name: ${safeCustomerName}</div>
        <div class="muted">Phone: ${safeCustomerPhone}</div>
      </div>
      <div class="section">
        <strong>Marketing preference</strong>
        <div class="muted" style="margin-top:6px">${escHtml(marketingLabel)}</div>
      </div>
      <div class="section">
        <strong>Venue switcher</strong>
        <div class="btn-row">${venuesHtml}</div>
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
        <a class="btn" href="/account">Back to account</a>
        <button class="btn primary" id="logoutBtn">Sign out</button>
      </div>
    </div>
  </div>
  <script>
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await fetch('/public/auth/logout', { method: 'POST', credentials: 'include' });
      location.href = '/account';
    });

    document.getElementById('changePasswordBtn').addEventListener('click', async () => {
      const message = document.getElementById('passwordMessage');
      message.textContent = '';
      try {
        const res = await fetch('/account/change-password', {
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

router.get("/account", (_req, res) => {
  res.type("html").send(renderGlobalAccountPage());
});

router.get("/account/portal", async (req, res) => {
  const session = await readCustomerSession(req);
  if (!session?.sub) {
    return res.redirect("/account");
  }

  const customer = await prisma.customerAccount.findUnique({
    where: { id: String(session.sub) },
    select: { id: true, email: true, name: true, phone: true, marketingConsent: true },
  });

  if (!customer?.email) {
    clearCustomerCookie(res);
    return res.redirect("/account");
  }

  const orders = await prisma.order.findMany({
    where: { customerAccountId: customer.id },
    include: {
      show: {
        select: {
          title: true,
          date: true,
          venue: { select: { name: true, city: true } },
          organiser: { select: { storefrontSlug: true, companyName: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const tickets = await prisma.ticket.findMany({
    where: { order: { customerAccountId: customer.id } },
    include: {
      show: { select: { title: true, date: true } },
      ticketType: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const memberships = await prisma.customerStorefrontMembership.findMany({
    where: { customerAccountId: customer.id },
    include: { storefront: { select: { slug: true, name: true } } },
  });

  const venuesMap = new Map<string, { slug: string; name: string }>();
  for (const membership of memberships) {
    const storefront = membership.storefront;
    if (storefront?.slug) {
      venuesMap.set(storefront.slug, { slug: storefront.slug, name: storefront.name || storefront.slug });
    }
  }
  for (const order of orders) {
    const organiser = order.show?.organiser;
    if (organiser?.storefrontSlug) {
      const label = organiser.companyName || organiser.name || organiser.storefrontSlug;
      venuesMap.set(organiser.storefrontSlug, { slug: organiser.storefrontSlug, name: label });
    }
  }

  const token = await signCustomerToken({
    id: customer.id,
    email: customer.email,
    mode: "GLOBAL",
  });
  setCustomerCookie(res, token);

  res.type("html").send(
    renderGlobalPortalPage({
      customer: { email: customer.email, name: customer.name, phone: customer.phone },
      marketingConsent: customer.marketingConsent ?? null,
      orders: orders.map((order) => ({
        id: order.id,
        amountPence: order.amountPence,
        status: order.status,
        createdAt: order.createdAt,
        showTitle: order.show?.title || "Show",
        showDate: order.show?.date || null,
        venue: order.show?.venue || null,
        organiserName:
          order.show?.organiser?.companyName || order.show?.organiser?.name || order.show?.organiser?.storefrontSlug || null,
      })),
      tickets: tickets.map((ticket) => ({
        id: ticket.id,
        showTitle: ticket.show?.title || "Show",
        showDate: ticket.show?.date || null,
        ticketType: ticket.ticketType?.name || "Ticket",
        quantity: ticket.quantity ?? 1,
        seatRef: ticket.seatRef || null,
      })),
      venues: Array.from(venuesMap.values()),
    })
  );
});

router.get("/account/verify", async (req, res) => {
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

  await linkPaidGuestOrders(customer.id, customer.email);

  const tokenJwt = await signCustomerToken({ id: customer.id, email: customer.email });
  setCustomerCookie(res, tokenJwt);

  return res.redirect("/account/portal");
});

router.post("/account/change-password", publicAuthLimiter, requireSameOrigin, async (req, res) => {
  const session = await readCustomerSession(req);
  if (!session?.sub) return res.status(401).json({ ok: false, error: "Unauthorized" });

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

  console.info("global account password change", { customerId: customer.id });
  return res.json({ ok: true });
});

export default router;
