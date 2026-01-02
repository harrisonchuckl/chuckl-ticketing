import { Router } from "express";
import prisma from "../lib/prisma.js";
import { readCustomerSession } from "../lib/customer-auth.js";
import { readStorefrontCartCount } from "../lib/storefront-cart.js";

const router = Router();

function escHtml(v: any) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escAttr(v: any) {
  return escHtml(v).replace(/"/g, '"');
}

function toPublicImageUrl(imageUrl: string | null | undefined, width: number) {
  const value = String(imageUrl ?? "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) {
    return `/img/fetch?src=${encodeURIComponent(value)}&w=${width}`;
  }
  return value;
}

function truncateText(value: string | null | undefined, max = 140) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

async function getBasketCountForStorefront(req: any, storefrontSlug: string, storefrontId: string) {
  const session = await readCustomerSession(req);
  const cookieCount = readStorefrontCartCount(req, storefrontSlug);
  if (!session?.sub) return cookieCount;

  const basket = await prisma.basket.findFirst({
    where: { customerAccountId: String(session.sub), storefrontId },
    select: { items: { select: { qty: true } } },
  });

  const dbCount = (basket?.items || []).reduce((sum, item) => sum + item.qty, 0);
  return dbCount || cookieCount;
}

// Helper to match the SSR brand logic
function getPublicBrand() {
  const name = String(process.env.PUBLIC_BRAND_NAME || 'TixAll').trim();
  const defaultLocalLogo = '/IMG_2374.jpeg'; 
  const logoUrl = String(process.env.PUBLIC_BRAND_LOGO_URL ?? '').trim() || defaultLocalLogo;
  const homeHref = String(process.env.PUBLIC_BRAND_HOME_HREF || '/public').trim();
  return { name, logoUrl, homeHref };
}

function renderAccountPage(opts: { storefrontSlug: string | null; storefrontName: string | null }) {
  const brand = getPublicBrand();
  const title = opts.storefrontName ? `${opts.storefrontName} · Account` : "TixAll Account";
  const storefrontSlug = opts.storefrontSlug || "";
  const accountTitle = opts.storefrontName || "TixAll";
  const accountSubtitle = opts.storefrontName
    ? `Access your tickets, orders, and preferences for ${opts.storefrontName}.`
    : "Access your tickets, orders, and preferences across TixAll.";

  const accountHref = storefrontSlug ? `/public/${escAttr(storefrontSlug)}/account` : "/public/account";
  const basketHref = storefrontSlug ? `/public/${escAttr(storefrontSlug)}/basket` : "/public/basket";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escHtml(title)}</title>
  <style>
    :root{--bg:#f8fafc;--panel:#fff;--text:#0f172a;--muted:#64748b;--border:#e2e8f0;--brand:#0ea5e9}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
    a{text-decoration:none;color:inherit}
    .wrap{max-width:1100px;margin:0 auto;padding:24px}
    .app-header{position:sticky;top:0;background:rgba(255,255,255,0.95);backdrop-filter:saturate(180%) blur(10px);border-bottom:1px solid var(--border);z-index:50}
    .app-header-inner{max-width:1200px;margin:0 auto;padding:0 20px;height:64px;display:flex;align-items:center;justify-content:space-between}
    .app-brand{display:inline-flex;align-items:center;gap:10px;text-decoration:none}
    .app-brand-logo{height:32px;width:auto;border-radius:8px}
    .app-actions{display:flex;align-items:center;gap:10px}
    .app-action{position:relative;width:45px;height:45px;border-radius:12px;display:grid;place-items:center;color:var(--text);border:1px solid transparent}
    .app-action:hover{border-color:var(--border);background:#f8fafc}
    .app-action svg{width:23px;height:23px}
    .app-action-badge{position:absolute;top:-5px;right:-5px;min-width:22px;height:22px;padding:0 4px;border-radius:999px;background:#ef4444;color:#fff;font-size:.72rem;font-weight:700;display:flex;align-items:center;justify-content:center}
    .app-action-badge.is-hidden{display:none}

    .hero{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:8px}
    .hero h1{margin:0;font-size:2rem}
    .hero p{margin:6px 0 0;color:var(--muted)}
    .grid{display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
    .card{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:20px}
    .card h2{margin:0 0 12px;font-size:1.1rem}
    .input{width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--border);margin-bottom:10px}
    .btn{display:inline-flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid var(--border);padding:10px 14px;background:#fff;color:var(--text);cursor:pointer}
    .btn.primary{background:var(--brand);color:#fff;border-color:transparent}
    .btn.link{border:none;background:none;color:var(--brand);padding:0}
    .btn-row{display:flex;gap:10px;flex-wrap:wrap}
    .hidden{display:none}
    .list{display:grid;gap:12px}
    .list-item{padding:12px;border:1px solid var(--border);border-radius:12px;background:#fff}
    .muted{color:var(--muted)}
    .menu{display:flex;gap:12px;flex-wrap:wrap;margin-top:12px}
    .tag{display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;background:#e2e8f0;font-size:.8rem}
  </style>
</head>
<body>
  <header class="app-header">
    <div class="app-header-inner">
      <a href="${escAttr(brand.homeHref || "/public")}" class="app-brand" aria-label="${escAttr(brand.name)}">
        <img class="app-brand-logo" src="${escAttr(brand.logoUrl)}" alt="${escAttr(brand.name)}" />
      </a>
      <div class="app-actions">
        <a class="app-action" href="${escAttr(basketHref)}" aria-label="View basket">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="9" cy="20" r="1"></circle>
            <circle cx="17" cy="20" r="1"></circle>
            <path d="M3 4h2l2.4 12.4a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.6L21 8H6"></path>
          </svg>
          <span class="app-action-badge is-hidden" id="basketCount">0</span>
        </a>
        <a class="app-action" href="${escAttr(accountHref)}" aria-label="Profile">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 21a8 8 0 1 0-16 0"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </a>
      </div>
    </div>
  </header>

  <div class="wrap">
    <div class="hero">
      <div>
        <h1>${escHtml(accountTitle)} account</h1>
        <p>${escHtml(accountSubtitle)}</p>
      </div>
      <span class="tag">Customer portal</span>
    </div>

    <div class="grid" style="margin-top:24px">
      <div class="card" id="signed-out">
        <h2>Sign in</h2>
        <input class="input" id="loginEmail" type="email" placeholder="Email" autocomplete="email" />
        <input class="input" id="loginPassword" type="password" placeholder="Password" autocomplete="current-password" />
        <div class="btn-row">
          <button class="btn primary" id="loginBtn">Sign in</button>
        </div>
        <p class="muted" style="margin-top:16px">New here? Create an account to manage tickets and orders.</p>
        <input class="input" id="signupName" type="text" placeholder="Full name" autocomplete="name" />
        <input class="input" id="signupEmail" type="email" placeholder="Email" autocomplete="email" />
        <input class="input" id="signupPassword" type="password" placeholder="Password" autocomplete="new-password" />
        <label style="display:flex;gap:8px;align-items:center;font-size:.9rem;margin-bottom:10px">
          <input type="checkbox" id="signupConsent" />
          I agree to receive updates from ${escHtml(accountTitle)}.
        </label>
        <div class="btn-row">
          <button class="btn" id="signupBtn">Create account</button>
        </div>
        <p class="muted" id="authMessage"></p>
      </div>

      <div class="card hidden" id="signed-in">
        <h2>My account</h2>
        <p class="muted" id="welcomeText"></p>
        <div class="menu">
          <a class="btn" href="#orders">Orders</a>
          <a class="btn" href="#tickets">Tickets</a>
          <a class="btn" href="#settings">Settings</a>
          <button class="btn" id="logoutBtn">Sign out</button>
        </div>
      </div>

      <div class="card" id="orders">
        <h2>Orders</h2>
        <div class="list" id="ordersList"><span class="muted">Sign in to view your orders.</span></div>
      </div>

      <div class="card" id="tickets">
        <h2>Tickets</h2>
        <p class="muted">Tickets are listed alongside your orders for quick access.</p>
      </div>

      <div class="card" id="settings">
        <h2>Saved details</h2>
        <input class="input" id="profileName" type="text" placeholder="Name" />
        <input class="input" id="profilePhone" type="text" placeholder="Phone" />
        <label style="display:flex;gap:8px;align-items:center;font-size:.9rem;margin-bottom:10px">
          <input type="checkbox" id="globalConsent" />
          I want to receive updates from TixAll.
        </label>
        ${
          storefrontSlug
            ? `<label style="display:flex;gap:8px;align-items:center;font-size:.9rem;margin-bottom:10px">
              <input type="checkbox" id="storefrontConsent" />
              I want to receive updates from ${escHtml(accountTitle)}.
            </label>`
            : ""
        }
        <div class="btn-row">
          <button class="btn primary" id="saveProfileBtn">Save</button>
        </div>
        <p class="muted" id="saveMessage"></p>
      </div>
    </div>
  </div>

  <script>
    const storefrontSlug = ${storefrontSlug ? `"${escAttr(storefrontSlug)}"` : "null"};

    const authMessage = document.getElementById('authMessage');
    const signedOut = document.getElementById('signed-out');
    const signedIn = document.getElementById('signed-in');
    const welcomeText = document.getElementById('welcomeText');
    const ordersList = document.getElementById('ordersList');
    const basketCount = document.getElementById('basketCount');

    function formatDate(raw) {
      if (!raw) return '';
      const d = new Date(raw);
      return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function formatMoney(pence) {
      return '£' + (Number(pence || 0) / 100).toFixed(2);
    }

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

    async function patchJSON(url, payload) {
      const res = await fetch(url, {
        method: 'PATCH',
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

    async function loadSession() {
      const sessionUrl = storefrontSlug
        ? '/public/auth/session?storefront=' + encodeURIComponent(storefrontSlug)
        : '/public/auth/session';
      try {
        const data = await getJSON(sessionUrl);
        if (!data.ok) return null;
        return data;
      } catch {
        return null;
      }
    }

    async function loadOrders() {
      if (!storefrontSlug) {
        const data = await getJSON('/public/customer/orders');
        return data.items || [];
      }
      const data = await getJSON('/public/customer/orders?storefront=' + encodeURIComponent(storefrontSlug));
      return data.items || [];
    }

    function renderOrders(items) {
      if (!items.length) {
        ordersList.innerHTML = '<span class=\"muted\">No orders yet for this account.</span>';
        return;
      }
      ordersList.innerHTML = items.map(item => {
        const venue = item.venue ? [item.venue.name, item.venue.city].filter(Boolean).join(' · ') : '';
        return '<div class=\"list-item\">' +
          '<strong>' + item.showTitle + '</strong>' +
          '<div class=\"muted\">' + [formatDate(item.showDate), venue].filter(Boolean).join(' • ') + '</div>' +
          '<div style=\"margin-top:6px\">' + formatMoney(item.amountPence) + ' · ' + item.status + '</div>' +
        '</div>';
      }).join('');
    }

    async function loadBasketCount() {
      if (!storefrontSlug) return;
      try {
        const data = await getJSON('/public/basket?storefront=' + encodeURIComponent(storefrontSlug));
        const count = (data.items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
        if (count) {
          basketCount.textContent = count;
          basketCount.classList.remove('is-hidden');
        }
      } catch {}
    }

    async function applySession() {
      const data = await loadSession();
      if (!data || !data.customer) return;

      signedOut.classList.add('hidden');
      signedIn.classList.remove('hidden');
      welcomeText.textContent = 'Signed in as ' + data.customer.email;

      document.getElementById('profileName').value = data.customer.name || '';
      document.getElementById('profilePhone').value = data.customer.phone || '';
      document.getElementById('globalConsent').checked = Boolean(data.customer.marketingConsent);

      if (storefrontSlug) {
        const storefrontConsent = document.getElementById('storefrontConsent');
        if (storefrontConsent) storefrontConsent.checked = Boolean(data.membership && data.membership.marketingOptIn);
      }

      const orders = await loadOrders();
      renderOrders(orders);
    }

    document.getElementById('loginBtn').addEventListener('click', async () => {
      authMessage.textContent = '';
      try {
        await postJSON('/public/auth/login', {
          email: document.getElementById('loginEmail').value,
          password: document.getElementById('loginPassword').value,
          storefrontSlug,
        });
        location.reload();
      } catch (err) {
        authMessage.textContent = err.message || 'Sign in failed';
      }
    });

    document.getElementById('signupBtn').addEventListener('click', async () => {
      authMessage.textContent = '';
      try {
        await postJSON('/public/auth/signup', {
          name: document.getElementById('signupName').value,
          email: document.getElementById('signupEmail').value,
          password: document.getElementById('signupPassword').value,
          marketingConsent: document.getElementById('signupConsent').checked,
          storefrontSlug,
        });
        location.reload();
      } catch (err) {
        authMessage.textContent = err.message || 'Signup failed';
      }
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await postJSON('/public/auth/logout');
      location.reload();
    });

    document.getElementById('saveProfileBtn').addEventListener('click', async () => {
      const saveMessage = document.getElementById('saveMessage');
      saveMessage.textContent = '';
      try {
        await patchJSON('/public/customer/profile', {
          name: document.getElementById('profileName').value,
          phone: document.getElementById('profilePhone').value,
          marketingConsent: document.getElementById('globalConsent').checked,
        });
        if (storefrontSlug) {
          const storefrontConsent = document.getElementById('storefrontConsent');
          if (storefrontConsent) {
            await patchJSON('/public/customer/membership?storefront=' + encodeURIComponent(storefrontSlug), {
              marketingOptIn: storefrontConsent.checked,
            });
          }
        }
        saveMessage.textContent = 'Saved!';
      } catch (err) {
        saveMessage.textContent = err.message || 'Save failed';
      }
    });

    loadBasketCount();
    applySession();
  </script>
</body>
</html>`;
}

function renderBasketPage(opts: { storefrontSlug: string | null; storefrontName: string | null }) {
  const brand = getPublicBrand();
  const title = opts.storefrontName ? `${opts.storefrontName} · Basket` : "Basket";
  const storefrontSlug = opts.storefrontSlug || "";
  const accountHref = storefrontSlug ? `/public/${escAttr(storefrontSlug)}/account` : "/public/account";
  const basketHref = storefrontSlug ? `/public/${escAttr(storefrontSlug)}/basket` : "/public/basket";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escHtml(title)}</title>
  <style>
    :root{--bg:#f8fafc;--panel:#fff;--text:#0f172a;--muted:#64748b;--border:#e2e8f0;--brand:#0ea5e9}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
    a{text-decoration:none;color:inherit}
    .wrap{max-width:1100px;margin:0 auto;padding:24px}
    .app-header{position:sticky;top:0;background:rgba(255,255,255,0.95);backdrop-filter:saturate(180%) blur(10px);border-bottom:1px solid var(--border);z-index:50}
    .app-header-inner{max-width:1200px;margin:0 auto;padding:0 20px;height:64px;display:flex;align-items:center;justify-content:space-between}
    .app-brand{display:inline-flex;align-items:center;gap:10px;text-decoration:none}
    .app-brand-logo{height:32px;width:auto;border-radius:8px}
    .app-actions{display:flex;align-items:center;gap:10px}
    .app-action{position:relative;width:45px;height:45px;border-radius:12px;display:grid;place-items:center;color:var(--text);border:1px solid transparent}
    .app-action:hover{border-color:var(--border);background:#f8fafc}
    .app-action svg{width:23px;height:23px}
    .app-action-badge{position:absolute;top:-5px;right:-5px;min-width:22px;height:22px;padding:0 4px;border-radius:999px;background:#ef4444;color:#fff;font-size:.72rem;font-weight:700;display:flex;align-items:center;justify-content:center}
    .app-action-badge.is-hidden{display:none}
    .card{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:20px}
    .list{display:grid;gap:12px}
    .list-item{padding:12px;border:1px solid var(--border);border-radius:12px;background:#fff;display:flex;justify-content:space-between;gap:12px}
    .muted{color:var(--muted)}
    .btn{display:inline-flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid var(--border);padding:10px 14px;background:#fff;color:var(--text);cursor:pointer}
    .btn.primary{background:var(--brand);color:#fff;border-color:transparent}
  </style>
</head>
<body>
  <header class="app-header">
    <div class="app-header-inner">
      <a href="${escAttr(brand.homeHref || "/public")}" class="app-brand" aria-label="${escAttr(brand.name)}">
        <img class="app-brand-logo" src="${escAttr(brand.logoUrl)}" alt="${escAttr(brand.name)}" />
      </a>
      <div class="app-actions">
        <a class="app-action" href="${escAttr(basketHref)}" aria-label="View basket">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="9" cy="20" r="1"></circle>
            <circle cx="17" cy="20" r="1"></circle>
            <path d="M3 4h2l2.4 12.4a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.6L21 8H6"></path>
          </svg>
          <span class="app-action-badge is-hidden" id="basketCount">0</span>
        </a>
        <a class="app-action" href="${escAttr(accountHref)}" aria-label="Profile">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 21a8 8 0 1 0-16 0"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </a>
      </div>
    </div>
  </header>

  <div class="wrap">
    <h1>${escHtml(title)}</h1>
    <div class="card" style="margin-top:16px">
      <div class="list" id="basketList"><span class="muted">Loading basket…</span></div>
      <div style="margin-top:16px;display:flex;justify-content:space-between;align-items:center">
        <strong>Total</strong>
        <strong id="basketTotal">£0.00</strong>
      </div>
      <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
        <a class="btn" href="${storefrontSlug ? `/store/${escAttr(storefrontSlug)}/cart` : "/store"}">Manage in store</a>
        <a class="btn primary" href="${storefrontSlug ? `/store/${escAttr(storefrontSlug)}/cart` : "/store"}">Checkout</a>
      </div>
    </div>
  </div>

  <script>
    const storefrontSlug = ${storefrontSlug ? `"${escAttr(storefrontSlug)}"` : "null"};
    const basketList = document.getElementById('basketList');
    const basketTotal = document.getElementById('basketTotal');
    const basketCount = document.getElementById('basketCount');

    function formatMoney(pence) {
      return '£' + (Number(pence || 0) / 100).toFixed(2);
    }

    async function getJSON(url) {
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    }

    async function loadBasket() {
      if (!storefrontSlug) {
        basketList.innerHTML = '<span class=\"muted\">No storefront selected.</span>';
        return;
      }
      try {
        const data = await getJSON('/public/basket?storefront=' + encodeURIComponent(storefrontSlug));
        const items = data.items || [];
        if (!items.length) {
          basketList.innerHTML = '<span class=\"muted\">Your basket is empty.</span>';
          return;
        }
        let total = 0;
        basketList.innerHTML = items.map(item => {
          total += Number(item.lineTotalPence || 0);
          return '<div class=\"list-item\">' +
            '<div><strong>' + item.title + '</strong>' +
            (item.variant ? '<div class=\"muted\">' + item.variant + '</div>' : '') +
            '<div class=\"muted\">Qty ' + item.qty + '</div></div>' +
            '<div><strong>' + formatMoney(item.lineTotalPence) + '</strong></div>' +
          '</div>';
        }).join('');
        basketTotal.textContent = formatMoney(total);
        const count = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
        if (count) {
          basketCount.textContent = count;
          basketCount.classList.remove('is-hidden');
        }
      } catch (err) {
        basketList.innerHTML = '<span class=\"muted\">Failed to load basket.</span>';
      }
    }

    loadBasket();
  </script>
</body>
</html>`;
}

router.get("/account", (_req, res) => {
  res.type("html").send(renderAccountPage({ storefrontSlug: null, storefrontName: null }));
});

router.get("/basket", (_req, res) => {
  res.type("html").send(renderBasketPage({ storefrontSlug: null, storefrontName: null }));
});

router.get("/:storefront/account", async (req, res) => {
  const storefrontSlug = String(req.params.storefront || "");
  const organiser = await prisma.user.findUnique({
    where: { storefrontSlug },
    select: { companyName: true, name: true, storefrontSlug: true },
  });

  if (!organiser) return res.status(404).send("Not found");
  const storefrontName = organiser.companyName || organiser.name || organiser.storefrontSlug || null;
  res.type("html").send(renderAccountPage({ storefrontSlug, storefrontName }));
});

router.get("/:storefront/basket", async (req, res) => {
  const storefrontSlug = String(req.params.storefront || "");
  const organiser = await prisma.user.findUnique({
    where: { storefrontSlug },
    select: { companyName: true, name: true, storefrontSlug: true },
  });

  if (!organiser) return res.status(404).send("Not found");
  const storefrontName = organiser.companyName || organiser.name || organiser.storefrontSlug || null;
  res.type("html").send(renderBasketPage({ storefrontSlug, storefrontName }));
});

/**
 * 1) Old URL -> redirect to pretty URL (unless internal rewrite)
 *    /public/event/:id  ->  /public/:storefront/:slug
 */
router.get("/event/:showId", async (req, res, next) => {
if (String(req.query?._internal || "") === "1") return next("router");

  const showId = String(req.params.showId || "");
  const show = await prisma.show.findUnique({
    where: { id: showId },
    select: {
      id: true,
      slug: true,
      organiser: { select: { storefrontSlug: true } },
    },
  });

  // If not published / no slug yet, let existing handler render as fallback
if (!show?.slug || !show.organiser?.storefrontSlug) return next("router");

  return res.redirect(301, `/public/${show.organiser.storefrontSlug}/${show.slug}`);
});

/**
 * 2) Pretty URL -> internally rewrite to /event/:id so your EXISTING booking page renders,
 *    but browser URL stays pretty.
 */
router.get("/:storefront/:slug", async (req, res, next) => {
  const storefront = String(req.params.storefront || "");
  const slug = String(req.params.slug || "");
  if (storefront === "checkout") return next("router");

  const organiser = await prisma.user.findUnique({
    where: { storefrontSlug: storefront },
    select: { id: true, storefrontSlug: true },
  });
  if (!organiser) return res.status(404).send("Not found");

  // current slug
  const show = await prisma.show.findFirst({
    where: { organiserId: organiser.id, slug },
    select: { id: true, slug: true },
  });

  if (!show) {
    // old slug -> redirect to current
    const hist = await prisma.showSlugHistory.findFirst({
      where: { organiserId: organiser.id, slug },
      select: { showId: true },
    });

    if (hist?.showId) {
      const current = await prisma.show.findUnique({
        where: { id: hist.showId },
        select: { slug: true },
      });

      if (current?.slug) {
        return res.redirect(301, `/public/${storefront}/${current.slug}`);
      }
    }

    return res.status(404).send("Not found");
  }

  // INTERNAL rewrite to existing booking handler:
  req.url = `/event/${show.id}?_internal=1`;
  return next();
});

/**
 * 3) Storefront landing page
 *    /public/:storefront
 */
router.get("/:storefront", async (req, res) => {
  const storefront = String(req.params.storefront || "");
  if (storefront === "checkout") return res.status(404).send("Not found");

  const organiser = await prisma.user.findUnique({
    where: { storefrontSlug: storefront },
    select: {
      id: true,
      storefrontSlug: true,
      companyName: true,
      name: true,
    },
  });

  if (!organiser) return res.status(404).send("Not found");

  const shows = await prisma.show.findMany({
    where: { organiserId: organiser.id, status: "LIVE" },
    orderBy: { date: "asc" },
   select: {
      id: true,
      title: true,
      date: true,
      slug: true,
      imageUrl: true,
      description: true,
      eventType: true,
      eventCategory: true,
      externalTicketUrl: true,
      usesExternalTicketing: true,
      venue: { select: { name: true, city: true, county: true } },
      ticketTypes: {
        select: { pricePence: true, available: true },
        orderBy: { pricePence: 'asc' },
        take: 1
      }
    },
  });

  const title = organiser.companyName || organiser.name || organiser.storefrontSlug;
  const brand = getPublicBrand();
  const storefrontSlug = organiser.storefrontSlug || "";
  const storefrontRecord = storefrontSlug
    ? await prisma.storefront.findUnique({ where: { slug: storefrontSlug } })
    : null;
  const cartCount =
    storefrontSlug && storefrontRecord
      ? await getBasketCountForStorefront(req, storefrontSlug, storefrontRecord.id)
      : 0;
  const cartHref = storefrontSlug ? `/public/${escAttr(storefrontSlug)}/basket` : "/public/basket";
  const accountHref = storefrontSlug ? `/public/${escAttr(storefrontSlug)}/account` : "/public/account";

  const visibleShows = shows.filter(show => !!show.slug);
  const featuredShows = visibleShows.slice(0, 6);
  const unique = (values: string[]) =>
    Array.from(new Set(values.filter(Boolean).map(value => value.trim()))).sort();
  const humanize = (value: string) =>
    value
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, letter => letter.toUpperCase());

  const venueLabels = unique(visibleShows.map(show => show.venue?.name || ""));
  const showVenueName = venueLabels.length > 1;

  const cards = visibleShows
    .map(show => {
      const d = new Date(show.date);
      const dateStr = d.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const timeStr = d.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const image = toPublicImageUrl(show.imageUrl, 800);
      const externalTicketUrl = String(show.externalTicketUrl || "").trim();
      const usesExternalTicketing = show.usesExternalTicketing === true;
      const hasAvailableTickets = (show.ticketTypes || []).some(
        ticket => ticket?.available === null || Number(ticket?.available ?? 0) > 0
      );
      const shouldUseExternalTickets =
        !!externalTicketUrl && (usesExternalTicketing || !hasAvailableTickets);
      const quickBookHref = shouldUseExternalTickets
        ? externalTicketUrl
        : `/checkout?showId=${escHtml(show.id)}`;
      const quickBookAttrs = shouldUseExternalTickets
        ? ' target="_blank" rel="noopener"'
        : "";
      return `
        <article class="show-card" data-show
          data-date="${escHtml(show.date.toISOString())}"
          data-type="${escHtml(show.eventType || "")}"
          data-venue="${escHtml(show.venue?.name || "")}"
          data-city="${escHtml(show.venue?.city || "")}"
          data-county="${escHtml(show.venue?.county || "")}">
          <a class="show-card__image" href="/public/${escHtml(storefront)}/${escHtml(show.slug)}" aria-label="View ${escHtml(show.title)}">
            ${
              image
                ? `<img src="${escAttr(image)}" alt="${escHtml(show.title)}" loading="lazy" />`
                : `<div class="show-card__placeholder" aria-hidden="true"></div>`
            }
          </a>
          <div class="show-card__body">
            <div class="show-card__meta">
              <span>${escHtml(dateStr)}</span>
              <span>•</span>
              <span>${escHtml(timeStr)}</span>
            </div>
            <h3 class="show-card__title">${escHtml(show.title || "Untitled show")}</h3>
            ${
              showVenueName
                ? `<div class="show-card__details">${escHtml(show.venue?.name || "Venue TBC")}</div>`
                : ""
            }
            <div class="show-card__actions">
              <a class="btn btn--primary" href="${escAttr(quickBookHref)}"${quickBookAttrs}>Quick book</a>
              <a class="btn btn--ghost" href="/public/${escHtml(storefront)}/${escHtml(show.slug)}">More info</a>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  const featuredCards = featuredShows
    .map((show, idx) => {
      const d = new Date(show.date);
      const dateStr = d.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const summary =
        truncateText(show.description, 160) ||
        (show.eventCategory ? `${show.eventCategory} show.` : "Live event.");
      const image = toPublicImageUrl(show.imageUrl, 1400);
      const externalTicketUrl = String(show.externalTicketUrl || "").trim();
      const usesExternalTicketing = show.usesExternalTicketing === true;
      const hasAvailableTickets = (show.ticketTypes || []).some(
        ticket => ticket?.available === null || Number(ticket?.available ?? 0) > 0
      );
      const shouldUseExternalTickets =
        !!externalTicketUrl && (usesExternalTicketing || !hasAvailableTickets);
      const quickBookHref = shouldUseExternalTickets
        ? externalTicketUrl
        : `/checkout?showId=${escHtml(show.id)}`;
      const quickBookAttrs = shouldUseExternalTickets
        ? ' target="_blank" rel="noopener"'
        : "";
      return `
        <div class="hero-slide${idx === 0 ? " is-active" : ""}" data-slide="${idx}">
          <div class="hero-media">
            ${
              image
                ? `<img src="${escAttr(image)}" alt="${escHtml(show.title)}" />`
                : `<div class="hero-placeholder" aria-hidden="true"></div>`
            }
          </div>
          <div class="featured-content">
            <span class="hero-eyebrow">Featured show</span>
            <h2>${escHtml(show.title || "Featured show")}</h2>
            <p class="hero-meta">
              ${escHtml(dateStr)}
              ${showVenueName ? ` • ${escHtml(show.venue?.name || "Venue TBC")}` : ""}
            </p>
            <p class="hero-summary">${escHtml(summary)}</p>
            <div class="hero-actions">
              <a class="btn btn--primary" href="${escAttr(quickBookHref)}"${quickBookAttrs}>Quick book</a>
              <a class="btn btn--ghost" href="/public/${escHtml(storefront)}/${escHtml(show.slug)}">More info</a>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  const typeOptions = unique(visibleShows.map(show => show.eventType || ""));
  const venueOptions = unique(visibleShows.map(show => show.venue?.name || ""));
  const cityOptions = unique(visibleShows.map(show => show.venue?.city || ""));
  const countyOptions = unique(visibleShows.map(show => show.venue?.county || ""));
  const showTypeFilter = typeOptions.length > 1;
  const showVenueFilter = venueOptions.length > 1;
  const showCityFilter = showVenueFilter && cityOptions.length > 1;
  const showCountyFilter = showVenueFilter && countyOptions.length > 1;

  res.type("html").send(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escHtml(title)} – Events</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@700;800;900&display=swap" rel="stylesheet">
 <style>
:root {
  --app-header-h: 64px;

  /* ✅ single source of truth for perfect alignment */
  --container-w: 1200px;
  --page-pad: 20px;

  --bg-page: #F3F4F6;
  --bg-surface: #FFFFFF;
  --primary: #0F172A;
  --brand: #0f9cdf;
  --brand-hover: #0b86c6;
  --text-main: #111827;
  --text-muted: #6B7280;
  --border: #E5E7EB;
  --radius-md: 12px;
  --radius-lg: 16px;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-card: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-float: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  padding-top: var(--app-header-h);
  font-family: 'Inter', sans-serif;
  background: var(--bg-page);
  color: var(--text-main);
  -webkit-font-smoothing: antialiased;
}

/* --- FIXED TOP HEADER --- */
.app-header {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: var(--app-header-h);
  background: rgba(255,255,255,0.95);
  backdrop-filter: saturate(180%) blur(10px);
  -webkit-backdrop-filter: saturate(180%) blur(10px);
  z-index: 500;
  border-bottom: 1px solid var(--border);
}
.app-header-inner {
  max-width: var(--container-w);
  height: 100%;
  margin: 0 auto;
  padding: 0 var(--page-pad);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.app-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}
.app-brand-logo {
  height: 32px;
  width: auto;
  border-radius: 8px;
}
.app-brand-text {
  font-family: 'Outfit', sans-serif;
  font-weight: 900;
  text-transform: uppercase;
  color: var(--primary);
  font-size: 1.1rem;
}
.app-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.app-action {
  position: relative;
  width: 45px;
  height: 45px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  text-decoration: none;
  color: var(--text-main);
  border: 1px solid transparent;
}
.app-action:hover {
  border-color: var(--border);
  background: #f8fafc;
}
.app-action svg {
  width: 23px;
  height: 23px;
}
.app-action-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 22px;
  height: 22px;
  padding: 0 4px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.app-action-badge.is-hidden { display: none; }

/* --- HERO SECTION --- */
.hero-section {
  background: var(--bg-page);
  color: var(--text-main);
  padding: 28px 0 18px;           /* ✅ remove side padding (fixes 20px drift) */
  position: relative;
}

.hero-content {
  max-width: var(--container-w);
  margin: 0 auto;
  padding: 0 var(--page-pad);     /* ✅ match header + wrap left edge exactly */
  text-align: left;
}

.hero-title {
  font-family: 'Outfit', sans-serif;
  font-weight: 900;
  font-size: clamp(1.56rem, 3.6vw, 2.7rem); /* ✅ +20% from current */
  margin: 0 0 10px;
  color: var(--primary);
}



/* --- FEATURED SLIDER --- */
.featured-section {
  max-width: var(--container-w);
  margin: -10px auto 40px;
  padding: 0 var(--page-pad);
}


.featured-slider {
  position: relative;
  border-radius: 24px;
  overflow: hidden;
  background: #0b1120;
  box-shadow: var(--shadow-float);
}

.featured-track {
  display: flex;
  transition: transform 0.6s ease;
}

.hero-slide {
  min-width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  gap: 32px;
  padding: 32px;
  align-items: center;
}

.hero-media {
  width: 100%;
  border-radius: 18px;
  overflow: hidden;
  background: #111827;
  aspect-ratio: 16/9;
}

.hero-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.hero-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1f2937, #0f172a);
}

.featured-content {
  color: #fff;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hero-eyebrow {
  font-size: 0.75rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  font-weight: 700;
  color: rgba(255,255,255,0.7);
}

.featured-content h2 {
  font-family: 'Outfit', sans-serif;
  font-size: clamp(1.8rem, 3vw, 2.8rem);
  margin: 0;
  font-weight: 800;
}

.hero-meta {
  font-size: 0.95rem;
  color: rgba(255,255,255,0.75);
  margin: 0;
}

.hero-summary {
  font-size: 1rem;
  color: rgba(255,255,255,0.85);
  margin: 0;
  line-height: 1.5;
}

.hero-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.featured-nav {
  position: absolute;
  right: 20px;
  bottom: 20px;
  display: flex;
  gap: 8px;
}

.featured-btn {
  border: none;
  background: rgba(255,255,255,0.15);
  color: #fff;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.featured-btn:hover {
  background: rgba(255,255,255,0.3);
}

.section-heading {
  font-family: 'Outfit', sans-serif;
  font-weight: 800;
  font-size: clamp(1.8rem, 3vw, 2.4rem);
  margin: 0 0 16px;
  color: var(--primary);
}

/* --- MAIN CONTENT --- */
.wrap {
  max-width: var(--container-w);
  margin: 0 auto;
  padding: 0 var(--page-pad) 80px;
  position: relative;
  z-index: 20;
}

/* --- FILTERS --- */
.filters-bar {
  background: var(--bg-surface);
  padding: 16px;
  border-radius: var(--radius-lg);
box-shadow: 0 8px 10px -3px rgba(0,0,0,0.04), 0 3px 4px -3px rgba(0,0,0,0.03); /* ~60% softer than shadow-float */
  border: 1px solid var(--border);
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  margin-bottom: 32px;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 140px;
  flex: 1;
}

.filter-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  font-weight: 700;
}

.filter-select {
  appearance: none;
  background: #F8FAFC;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  font-family: inherit;
  font-size: 0.95rem;
  color: var(--text-main);
  font-weight: 500;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 16px;
  cursor: pointer;
}
.filter-select:hover { border-color: var(--brand); }
.filter-select:focus { outline: 2px solid var(--brand); border-color: var(--brand); }

/* --- GRID --- */
.show-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
}

/* --- CARD STYLE --- */
.show-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  transition: transform 0.2s, box-shadow 0.2s;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.show-card:hover {
  transform: none;           /* ✅ no extra lift */
  box-shadow: var(--shadow-card); /* ✅ keep same shadow as default */
}


.show-card__image {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 16/9;
  background: #e2e8f0;
  overflow: hidden;
}

.show-card__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s;
}
.show-card:hover .show-card__image img {
  transform: scale(1.05);
}

/* Date Badge on Image */
.date-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(4px);
  border-radius: 8px;
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 4px 10px rgba(0,0,0,0.15);
  line-height: 1;
}
.db-month { font-size: 0.7rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted); margin-bottom: 2px; }
.db-day { font-size: 1.2rem; font-weight: 800; color: var(--primary); }

.show-card__body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 12px;
}

.show-card__meta {
  font-size: 0.98rem; /* ✅ 0.85 * 1.15 ≈ 0.98 */
  color: var(--brand);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}


.show-card__title {
  margin: 0;
  font-family: 'Outfit', sans-serif;
  font-size: 1.35rem;
  line-height: 1.2;
  font-weight: 800;
}
.show-card__title a {
  text-decoration: none;
  color: var(--primary);
}
.show-card__title a:hover { color: var(--brand); }

.show-card__details {
  color: var(--text-muted);
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  gap: 6px;
}

.show-card__actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: auto;
}

.show-card__actions .btn {
  padding: 12px 22px;
  font-size: 1rem;
}

.show-card__footer {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.price-tag {
  font-weight: 700;
  color: var(--text-main);
  font-size: 1rem;
}

.card-actions {
  display: flex;
  gap: 8px;
}

/* --- BUTTONS --- */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  padding: 8px 16px;
  font-weight: 700;
  font-size: 0.9rem;
  text-decoration: none;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn--primary {
  background: var(--brand);
  color: #fff;
  border: 1px solid transparent;
  box-shadow: 0 4px 6px rgba(15, 156, 223, 0.2);
}
.btn--primary:hover {
  background: var(--brand-hover);
  transform: translateY(-1px);
}

.btn--ghost {
  background: white;
  border: 1px solid var(--border);
  color: var(--text-main);
}
.btn--ghost:hover {
  border-color: var(--brand);
  color: var(--brand);
}

.empty {
  grid-column: 1 / -1;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  padding: 40px;
  text-align: center;
  color: var(--text-muted);
  border: 1px dashed var(--border);
}

@media (max-width: 768px) {
  .app-header-inner { padding: 0 16px; }

  /* ✅ keep hero aligned with header + wrap on mobile */
  .hero-section { padding: 24px 0 20px; }
  .hero-content { padding: 0 16px; }

  /* ✅ +20% from previous mobile size (2.2rem -> 2.64rem) */
  .hero-title { font-size: 2.64rem; }

  .hero-slide { grid-template-columns: 1fr; padding: 20px; }
  .featured-section { margin-top: -10px; }
  .filters-bar { flex-direction: column; align-items: stretch; gap: 12px; }
  .card-actions { width: 100%; }
  .card-actions .btn { flex: 1; }
}
</style>
</head>
<body>

  <header class="app-header">
    <div class="app-header-inner">
      <a href="${escAttr(brand.homeHref || '#')}" class="app-brand" aria-label="${escAttr(brand.name)}">
        <img class="app-brand-logo" src="${escAttr(brand.logoUrl)}" alt="${escAttr(brand.name)}" />
      </a>
      <div class="app-actions">
        <a class="app-action" href="${cartHref}" aria-label="View basket">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="9" cy="20" r="1"></circle>
            <circle cx="17" cy="20" r="1"></circle>
            <path d="M3 4h2l2.4 12.4a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.6L21 8H6"></path>
          </svg>
          <span class="app-action-badge${cartCount ? "" : " is-hidden"}">${cartCount}</span>
        </a>
        <a class="app-action" href="${accountHref}" aria-label="Profile">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 21a8 8 0 1 0-16 0"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </a>
      </div>
    </div>
  </header>

  <section class="hero-section">
    <div class="hero-content">
      <h1 class="hero-title">What's On</h1>
    </div>
  </section>

  ${
    featuredCards
      ? `<section class="featured-section">
          <div class="featured-slider" data-featured-slider>
            <div class="featured-track">
              ${featuredCards}
            </div>
            <div class="featured-nav">
              <button class="featured-btn" type="button" data-featured-prev aria-label="Previous featured show">‹</button>
              <button class="featured-btn" type="button" data-featured-next aria-label="Next featured show">›</button>
            </div>
          </div>
        </section>`
      : ""
  }

  <div class="wrap">
    <h2 class="section-heading">All shows</h2>
    <div class="filters-bar">
      ${
        showTypeFilter
          ? `<div class="filter-group">
              <label class="filter-label" for="filter-type">Category</label>
              <select id="filter-type" class="filter-select">
                <option value="">All categories</option>
                ${typeOptions
                  .map(t => `<option value="${escHtml(t)}">${escHtml(humanize(t))}</option>`)
                  .join("")}
              </select>
            </div>`
          : ""
      }
      ${
        showVenueFilter
          ? `<div class="filter-group">
              <label class="filter-label" for="filter-venue">Venue</label>
              <select id="filter-venue" class="filter-select">
                <option value="">All venues</option>
                ${venueOptions.map(v => `<option value="${escHtml(v)}">${escHtml(v)}</option>`).join("")}
              </select>
            </div>`
          : ""
      }
      ${
        showCityFilter
          ? `<div class="filter-group">
              <label class="filter-label" for="filter-city">Town / city</label>
              <select id="filter-city" class="filter-select">
                <option value="">All towns/cities</option>
                ${cityOptions.map(city => `<option value="${escHtml(city)}">${escHtml(city)}</option>`).join("")}
              </select>
            </div>`
          : ""
      }
      ${
        showCountyFilter
          ? `<div class="filter-group">
              <label class="filter-label" for="filter-county">County</label>
              <select id="filter-county" class="filter-select">
                <option value="">All counties</option>
                ${countyOptions.map(county => `<option value="${escHtml(county)}">${escHtml(county)}</option>`).join("")}
              </select>
            </div>`
          : ""
      }
    </div>

    <div class="show-grid" id="show-grid">
      ${cards || `<div class="empty">No live events scheduled at the moment.</div>`}
    </div>
  </div>  
  
  <script>
  (function(){
    const slider = document.querySelector('[data-featured-slider]');
    if (slider){
      const track = slider.querySelector('.featured-track');
      const slides = Array.from(slider.querySelectorAll('.hero-slide'));
      const prevBtn = slider.querySelector('[data-featured-prev]');
      const nextBtn = slider.querySelector('[data-featured-next]');
      let index = 0;
      let intervalId = null;

      const update = (nextIndex) => {
        if (!track) return;
        index = (nextIndex + slides.length) % slides.length;
        track.style.transform = 'translateX(' + (-index * 100) + '%)';
        slides.forEach((slide, idx) => {
          slide.classList.toggle('is-active', idx === index);
        });
      };

      const start = () => {
        if (slides.length <= 1) return;
        intervalId = window.setInterval(() => {
          update(index + 1);
        }, 7000);
      };

      const stop = () => {
        if (intervalId) window.clearInterval(intervalId);
      };

      if (prevBtn) prevBtn.addEventListener('click', () => {
        stop();
        update(index - 1);
        start();
      });
      if (nextBtn) nextBtn.addEventListener('click', () => {
        stop();
        update(index + 1);
        start();
      });

      slider.addEventListener('mouseenter', stop);
      slider.addEventListener('mouseleave', start);
      update(0);
      start();
    }

    const typeFilter = document.getElementById('filter-type');
    const venueFilter = document.getElementById('filter-venue');
    const cityFilter = document.getElementById('filter-city');
    const countyFilter = document.getElementById('filter-county');
    const cards = Array.from(document.querySelectorAll('[data-show]'));

    function applyFilters(){
      const typeValue = typeFilter?.value || '';
      const venueValue = venueFilter?.value || '';
      const cityValue = cityFilter?.value || '';
      const countyValue = countyFilter?.value || '';
      let visibleCount = 0;
      
      cards.forEach(card => {
        const type = card.getAttribute('data-type') || '';
        const venue = card.getAttribute('data-venue') || '';
        const city = card.getAttribute('data-city') || '';
        const county = card.getAttribute('data-county') || '';

        const show = 
          (!typeValue || type === typeValue) &&
          (!venueValue || venue === venueValue) &&
          (!cityValue || city === cityValue) &&
          (!countyValue || county === countyValue);

        // Use 'flex' to maintain card height/structure
        card.style.display = show ? 'flex' : 'none'; 
        if(show) visibleCount += 1;
      });

      const grid = document.getElementById('show-grid');
      if(grid){
        const existing = grid.querySelector('.empty');
        if(visibleCount === 0 && !existing){
           const empty = document.createElement('div');
           empty.className = 'empty';
           empty.textContent = 'No shows match those filters.';
           grid.appendChild(empty);
        } else if(visibleCount > 0 && existing){
           existing.remove();
        }
      }
    }

    [typeFilter, venueFilter, cityFilter, countyFilter].forEach(f => {
      if(f) f.addEventListener('change', applyFilters);
    });
  })();
</script>
</body>
</html>
  `);
});

export default router;
