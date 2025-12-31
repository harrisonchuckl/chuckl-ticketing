// backend/src/routes/admin-ui.ts
import path from "path";
import { fileURLToPath } from "url";
import { Router, json } from "express";
import type { DashboardWidgetPreference } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { requireAdminOrOrganiser } from "../lib/authz.js";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const widgetRegistry = [
  {
    key: "tickets_sold_7d",
    title: "Tickets sold (7d)",
    category: "Sales",
    defaultEnabled: true,
    defaultOrder: 1,
  },
  {
    key: "orders_7d",
    title: "Orders (7d)",
    category: "Sales",
    defaultEnabled: true,
    defaultOrder: 2,
  },
  {
    key: "gross_revenue_7d",
    title: "Gross revenue (7d)",
    category: "Financial",
    defaultEnabled: true,
    defaultOrder: 3,
  },
  {
    key: "net_revenue_7d",
    title: "Net revenue (7d)",
    category: "Financial",
    defaultEnabled: true,
    defaultOrder: 4,
  },
  {
    key: "average_order_value",
    title: "Average order value",
    category: "Financial",
    defaultEnabled: true,
    defaultOrder: 5,
  },
  {
    key: "new_customers_7d",
    title: "New customers (7d)",
    category: "Customers",
    defaultEnabled: true,
    defaultOrder: 6,
  },
  {
    key: "returning_customers_7d",
    title: "Returning customers (7d)",
    category: "Customers",
    defaultEnabled: true,
    defaultOrder: 7,
  },
  {
    key: "refunds_7d",
    title: "Refunds (7d)",
    category: "Financial",
    defaultEnabled: true,
    defaultOrder: 8,
  },
  {
    key: "booking_fee_kickback",
    title: "Booking Fee Kickback",
    category: "Financial",
    defaultEnabled: true,
    defaultOrder: 9,
  },
  {
    key: "daily_performance",
    title: "Daily Performance",
    category: "Sales",
    defaultEnabled: true,
    defaultOrder: 10,
  },
  {
    key: "early_warnings",
    title: "Early Warnings",
    category: "Operations",
    defaultEnabled: true,
    defaultOrder: 11,
  },
  {
    key: "top_performing_shows",
    title: "Top Performing Shows",
    category: "Sales",
    defaultEnabled: true,
    defaultOrder: 12,
  },
  {
    key: "needs_attention",
    title: "Needs Attention",
    category: "Operations",
    defaultEnabled: true,
    defaultOrder: 13,
  },
  {
    key: "customer_behaviour_snapshot",
    title: "Customer Behaviour Snapshot",
    category: "Customers",
    defaultEnabled: true,
    defaultOrder: 14,
  },
];

const widgetCategoryOrder = [
  "Sales",
  "Customers",
  "Financial",
  "Operations",
  "Marketing",
];

function mergeWidgetPreferences(
  preferences?: DashboardWidgetPreference[] | null
) {
  const prefMap = new Map<string, DashboardWidgetPreference>();
  (preferences || []).forEach((pref) => {
    if (!pref || !pref.widgetKey) return;
    prefMap.set(pref.widgetKey, pref);
  });

  const merged = widgetRegistry.map((widget) => {
    const pref = prefMap.get(widget.key);
    return {
      key: widget.key,
      title: widget.title,
      category: widget.category,
      defaultOrder: widget.defaultOrder,
      enabled: pref ? Boolean(pref.enabled) : Boolean(widget.defaultEnabled),
      order:
        pref && pref.order !== null && pref.order !== undefined
          ? Number(pref.order)
          : widget.defaultOrder,
    };
  });

  const categoryIndex = new Map(
    widgetCategoryOrder.map((category, index) => [category, index])
  );

  merged.sort((a, b) => {
    const catA = categoryIndex.get(a.category) ?? widgetCategoryOrder.length;
    const catB = categoryIndex.get(b.category) ?? widgetCategoryOrder.length;
    if (catA !== catB) return catA - catB;
    const orderA = a.order ?? a.defaultOrder ?? 0;
    const orderB = b.order ?? b.defaultOrder ?? 0;
    return orderA - orderB;
  });

  return merged;
}

function getRegistryWidget(key: string) {
  return widgetRegistry.find((widget) => widget.key === key) || null;
}

// ✅ Serve the brand logo from the admin router (no guessing about /public mounting)
router.get("/ui/brand-logo", (_req, res) => {
  res.set("Cache-Control", "public, max-age=86400");
  res.sendFile(path.join(__dirname, "../../public/TixAll on White Background.png"));
});

router.get("/ui/api/home-widgets", requireAdminOrOrganiser, async (req, res) => {
  try {
    const userId = String(req.user?.id || "");
    if (!userId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const preferences = await prisma.dashboardWidgetPreference.findMany({
      where: { userId },
    });

    const merged = mergeWidgetPreferences(preferences);
    return res.json({ ok: true, widgets: merged });
  } catch (err) {
    console.error("[admin-ui] home widgets fetch failed", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to load widget preferences" });
  }
});

router.post("/ui/api/home-widgets", requireAdminOrOrganiser, async (req, res) => {
  try {
    const userId = String(req.user?.id || "");
    if (!userId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const { widgetKey, enabled, order } = req.body || {};
    const registryWidget = getRegistryWidget(widgetKey);
    if (!registryWidget) {
      return res.status(400).json({ ok: false, error: "Unknown widget" });
    }

    const payload = {
      enabled: Boolean(enabled),
      order:
        order !== null && order !== undefined ? Number(order) : undefined,
    };

    await prisma.dashboardWidgetPreference.upsert({
      where: { userId_widgetKey: { userId, widgetKey } },
      update: payload,
      create: {
        userId,
        widgetKey,
        enabled: payload.enabled,
        order: payload.order,
      },
    });

    const preferences = await prisma.dashboardWidgetPreference.findMany({
      where: { userId },
    });
    const merged = mergeWidgetPreferences(preferences);
    return res.json({ ok: true, widgets: merged });
  } catch (err) {
    console.error("[admin-ui] home widgets update failed", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to update widget preference" });
  }
});

// ✅ Login page (must be inside a route so req/res exist)
router.get("/ui/login", (req, res) => {
  const brandName = String(process.env.PUBLIC_BRAND_NAME || "TixAll").trim();
  const logoUrl = String(
    process.env.PUBLIC_BRAND_LOGO_URL || "/admin/ui/brand-logo"
  ).trim();

  const error = typeof req.query.error === "string" ? req.query.error : "";

  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${brandName} | Organiser Login</title>
  <meta name="robots" content="noindex,nofollow" />

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@400;700;800;900&display=swap" rel="stylesheet">

  <style>
    :root{
      --brand: #009fe3;
      --brand-deep: #007fb6;
      --ink: #0F172A;
      --muted: rgba(15,23,42,0.72);
      --card: #ffffff;
      --border: #e2e8f0;
      --shadow: 0 12px 24px rgba(15,23,42,0.08);
      --radius: 18px;
    }
    *{ box-sizing:border-box; }
    body{
      margin:0;
      min-height:100vh;
      font-family: 'Inter', sans-serif;
      color: var(--ink);
      background: #ffffff;
      overflow-x:hidden;
    }
    .wrap{
      min-height:100vh;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      padding: 28px 16px;
      position:relative;
    }
    .brand-center{
      display:flex;
      align-items:center;
      justify-content:center;
      padding: 0 16px;
      margin-bottom: 14px;
    }
    .brand{
      display:inline-flex;
      align-items:center;
      gap:10px;
      color: var(--ink);
    }
    .brand img{ height:36px; width:auto; display:block; }
    .brand .name{
      font-family:'Outfit', sans-serif;
      font-weight:900;
      letter-spacing:0.02em;
      text-transform:uppercase;
      font-size:1.05rem;
      line-height:1;
    }
    .card{
      width: min(420px, 100%);
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 20px;
      backdrop-filter: blur(10px);
    }
    .title{
      font-family:'Outfit', sans-serif;
      font-weight:900;
      letter-spacing:-0.02em;
      font-size: 1.7rem;
      margin: 4px 0 6px;
    }
    .subtitle{
      color: var(--muted);
      font-weight:600;
      margin: 0 0 16px;
      line-height:1.45;
    }
    label{
      display:block;
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      text-transform:uppercase;
      font-weight:800;
      color: rgba(15,23,42,0.70);
      margin: 12px 0 6px;
    }
    input{
      width:100%;
      padding: 12px 12px;
      border-radius: 12px;
      border: 1px solid rgba(15,23,42,0.14);
      background: rgba(255,255,255,0.92);
      outline:none;
      font-size: 1rem;
      font-weight:600;
      color: var(--ink);
    }
    input:focus{
      border-color: rgba(0,159,227,0.55);
      box-shadow: 0 0 0 4px rgba(0,159,227,0.18);
    }
    .row{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 12px;
      margin-top: 10px;
    }
    .link{
      color: var(--brand-deep);
      text-decoration:none;
      font-weight:800;
      font-size: 0.95rem;
    }
    .link:hover{ text-decoration:underline; }
    button{
      width:100%;
      margin-top: 14px;
      border:0;
      border-radius: 12px;
      padding: 12px 14px;
      background: #0B1220;
      color:#fff;
      font-family:'Outfit', sans-serif;
      font-weight:900;
      letter-spacing:0.03em;
      text-transform:uppercase;
      cursor:pointer;
      transition: transform .06s ease, opacity .2s ease;
    }
    button:active{ transform: translateY(1px); }
    button[disabled]{ opacity:0.65; cursor:not-allowed; }
    .btn-secondary{
      background:#fff;
      color:#0B1220;
      border:1px solid #0B1220;
    }
    .msg{
      margin-top: 12px;
      font-weight:700;
      font-size: 0.95rem;
      line-height:1.4;
    }
    .msg.err{ color:#b91c1c; }
    .msg.ok{ color:#166534; }
    .footer{
      margin-top: 14px;
      color: rgba(15,23,42,0.55);
      font-size: 0.85rem;
      text-align:center;
      font-weight:700;
    }
    .hidden{ display:none; }
    .btn-row{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
    }
    .btn-row button{
      flex:1;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand-center">
      <div class="brand">
        ${logoUrl ? `<img src="${logoUrl}" alt="${brandName}" />` : `<span class="name">${brandName}</span>`}
      </div>
    </div>

    <div class="card">
      <div id="loginPane">
        <div class="title">Organiser Console</div>
        <div class="subtitle">Log in to manage your events.</div>

        <form id="loginForm">
          <label for="email">Email</label>
          <input id="email" name="email" type="email" autocomplete="email" required />

          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required />

          <div class="row">
            <a class="link" href="/auth/forgot">Forgot password?</a>
          </div>

          <button id="btn" type="submit">Log in</button>
          <div id="msg" class="msg ${error ? "err" : ""}">${error ? String(error) : ""}</div>

          <div class="footer">🔒 Secure ticketing powered by TixAll.</div>
          <button id="btnCreateAccount" type="button" class="btn-secondary">Create account</button>
        </form>
      </div>

      <div id="requestPane" class="hidden">
        <div class="title">Create account</div>
        <div class="subtitle">Request access to the organiser console.</div>

        <form id="requestForm">
          <label for="req-name">Name</label>
          <input id="req-name" name="name" type="text" autocomplete="name" required />

          <label for="req-email">Email</label>
          <input id="req-email" name="email" type="email" autocomplete="email" required />

          <label for="req-company">Company name</label>
          <input id="req-company" name="company" type="text" autocomplete="organization" required />

          <button id="btnRequest" type="submit">Submit request</button>
          <button id="btnBackToLogin" type="button" class="btn-secondary">Back to login</button>
          <div id="requestMsg" class="msg"></div>
        </form>
      </div>
    </div>
  </div>

<script>
(function(){
  const form = document.getElementById("loginForm");
  const btn = document.getElementById("btn");
  const msg = document.getElementById("msg");
  const emailEl = document.getElementById("email");
  const pwEl = document.getElementById("password");
  const loginPane = document.getElementById("loginPane");
  const requestPane = document.getElementById("requestPane");
  const createBtn = document.getElementById("btnCreateAccount");
  const backBtn = document.getElementById("btnBackToLogin");
  const requestForm = document.getElementById("requestForm");
  const requestMsg = document.getElementById("requestMsg");
  const requestBtn = document.getElementById("btnRequest");
  const requestName = document.getElementById("req-name");
  const requestEmail = document.getElementById("req-email");
  const requestCompany = document.getElementById("req-company");

  // If already logged in, skip login
  (async function(){
    try{
      const r = await fetch('/auth/me', { credentials:'include' });
      if(r.ok) location.href = '/admin/ui/home';
    }catch{}
  })();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";
    msg.className = "msg";
    btn.disabled = true;
    btn.textContent = "Signing in…";

    const email = (emailEl.value || "").trim().toLowerCase();
    const password = String(pwEl.value || "");

    try{
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password })
      });

      const txt = await res.text();
      let data = null;
      try{ data = JSON.parse(txt); }catch{}

      if(!res.ok){
        const err = (data && data.error) ? data.error : "Login failed";
        msg.textContent = err;
        msg.className = "msg err";
        return;
      }

      msg.textContent = "Signed in. Redirecting…";
      msg.className = "msg ok";
      setTimeout(() => location.href = "/admin/ui/home", 250);
    }catch(err){
      msg.textContent = "Something went wrong. Please try again.";
      msg.className = "msg err";
    }finally{
      btn.disabled = false;
      btn.textContent = "Log in";
    }
  });

  function showRequestForm(){
    loginPane.classList.add("hidden");
    requestPane.classList.remove("hidden");
    requestMsg.textContent = "";
    requestMsg.className = "msg";
  }

  function showLoginForm(){
    requestPane.classList.add("hidden");
    loginPane.classList.remove("hidden");
  }

  createBtn?.addEventListener("click", showRequestForm);
  backBtn?.addEventListener("click", showLoginForm);

  requestForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    requestMsg.textContent = "";
    requestMsg.className = "msg";
    requestBtn.disabled = true;
    requestBtn.textContent = "Sending…";

    const payload = {
      name: (requestName.value || "").trim(),
      email: (requestEmail.value || "").trim().toLowerCase(),
      companyName: (requestCompany.value || "").trim(),
    };

    try{
      const res = await fetch("/auth/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const txt = await res.text();
      let data = null;
      try{ data = JSON.parse(txt); }catch{}

      if(!res.ok){
        const err = (data && data.error) ? data.error : "Request failed";
        requestMsg.textContent = err;
        requestMsg.className = "msg err";
        return;
      }

      requestMsg.textContent = "Thanks! We'll review your request and email you once approved.";
      requestMsg.className = "msg ok";
      requestForm.reset();
    }catch(err){
      requestMsg.textContent = "Something went wrong. Please try again.";
      requestMsg.className = "msg err";
    }finally{
      requestBtn.disabled = false;
      requestBtn.textContent = "Submit request";
    }
  });
})();
</script>
</body>
</html>`);
});

// UI logout helper
router.get("/ui/logout", (_req, res) => {
  res.clearCookie("auth", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  res.redirect("/admin/ui/login");
});


/**
 * Admin Single Page App (Organiser Console)
 * Served at /admin/ui/*
 */
router.get(
  ["/ui", "/ui/", "/ui/home", "/ui/*"],
  (req, res, next) => {
    // If not logged in, force login page
    if (!req.user) return res.redirect("/admin/ui/login");
    next();
  },
  requireAdminOrOrganiser,
  (_req, res) => {

    res.set("Cache-Control", "no-store");
    res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Organiser Console</title>
  <style>
 :root{
  --bg:#f7f8fb;
  --panel:#ffffff;
  --border:#e5e7eb;
  --text:#111827;
  --muted:#6b7280;
  --ink:#111827;

  /* Global fixed header height */
  --header-h:56px;
  --sidebar-width:220px;

  /* TIXall AI highlight */
  --ai:#009fe3;
}


    *{box-sizing:border-box;}
    html,body{
      margin:0;
      padding:0;
      height:100%;
      font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;
      color:var(--text);
      background:var(--bg);
    }
   /* Fixed header sits above everything */
.top-header{
  position:fixed;
  top:0; left:0; right:0;
  height:var(--header-h);
  background:#ffffff;
  border-bottom:1px solid var(--border); /* soft line like sidebar border */
  z-index:100;
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:0 16px;
}

/* Brand (logo) */
.hdr-brand{
  display:flex;
  align-items:center;
  gap:10px;
  text-decoration:none;
}
.hdr-logo{
  height:36.4px;
  width:auto;
  display:block;
}

/* Account button + dropdown */
.hdr-right{
  display:flex;
  align-items:center;
  gap:10px;
}
.hdr-menu-toggle{
  width:36px;
  height:36px;
  border:1px solid var(--border);
  background:#ffffff;
  border-radius:10px;
  display:none;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  padding:0;
}
.hdr-menu-toggle:hover{ background:#f9fafb; }
.hdr-account{
  position:relative;
}
.hdr-account-btn{
  width:36px;
  height:36px;
  border:1px solid var(--border);
  background:#ffffff;
  border-radius:999px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  padding:0;
}
.hdr-account-btn:hover{ background:#f9fafb; }

.hdr-account-menu{
  position:absolute;
  right:0;
  top:44px;
  background:#ffffff;
  border:1px solid var(--border);
  border-radius:10px;
  min-width:180px;
  display:none;
  z-index:200;
}
.hdr-account-menu.open{ display:block; }

.hdr-menu-item{
  display:block;
  padding:10px 12px;
  text-decoration:none;
  color:#111827;
  font-size:14px;
}
.hdr-menu-item:hover{ background:#f8fafc; }

.hdr-menu-sep{
  height:1px;
  background:var(--border);
  margin:6px 0;
}

/* Layout now accounts for fixed header */
.wrap{
  display:flex;
  min-height:calc(100vh - var(--header-h));
  padding-top:var(--header-h);
}

.sidebar{
  width:var(--sidebar-width);
  min-width:var(--sidebar-width);
  max-width:var(--sidebar-width);
  flex:0 0 var(--sidebar-width);
  background:#ffffff;
  border-right:1px solid var(--border);
  padding:16px 12px;
  position:sticky;
  top:var(--header-h);
  height:calc(100vh - var(--header-h));
  box-sizing:border-box;
  overflow:auto;
  scrollbar-gutter:stable;
}
    .sb-group{
      font-size:12px;
      letter-spacing:.04em;
      color:var(--muted);
      margin:14px 8px 6px;
      text-transform:uppercase;
    }
    .sb-link{
      display:block;
      padding:10px 12px;
      margin:4px 4px;
      border-radius:8px;
      color:#111827;
      text-decoration:none;
    }
    .sb-link.active,
    .sb-link:hover{
      background:#f1f5f9;
    }
.sb-sub{margin-left:6px;}

    /* Keeps "Create Show" + AI badge on one line */
.sb-link-row{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  width:100%;
  min-width:0;
}

.sb-link-label{
  flex:1;
  min-width:0;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

.ai-badge{
  white-space:nowrap;
}


 .ai-badge{
  display:inline-block;
  font-size:9px;
  font-weight:800;
  padding:2px 6px;
  border-radius:999px;
  border:1px solid #0f9cdf;
  background:#e6f7fd;
  color:#0f9cdf;
  line-height:1.2;
  white-space:nowrap;
  flex:0 0 auto;
}

    .content{
      flex:1;
      padding:20px;
    }

@media (max-width: 960px){
  .hdr-menu-toggle{
    display:inline-flex;
  }
  .wrap{
    display:block;
  }
  .sidebar{
    position:fixed;
    left:0;
    top:var(--header-h);
    height:calc(100vh - var(--header-h));
    transform:translateX(-100%);
    transition:transform 0.2s ease;
    z-index:150;
    box-shadow:10px 0 30px rgba(15, 23, 42, 0.15);
  }
  body.sidebar-open .sidebar{
    transform:translateX(0);
  }
}
@media (max-width: 720px){
  .content{
    padding:12px;
  }
  .card{
    padding:12px;
  }
  .hero-grid{
    grid-template-columns:1fr;
  }
  .grid-2{
    grid-template-columns:1fr;
  }
  .kpi-grid{
    grid-template-columns:repeat(2,minmax(140px,1fr));
  }
  .table-list{
    overflow-x:auto;
    -webkit-overflow-scrolling:touch;
  }
  .table-row{
    min-width:520px;
  }
}
    .card{
      background:var(--panel);
      border:1px solid var(--border);
      border-radius:12px;
      padding:16px;
      margin-bottom:16px;
    }
    .header{
      display:flex;
      align-items:center;
      justify-content:space-between;
      margin-bottom:12px;
      gap:12px;
    }
    .title{font-weight:600;}
    .muted{color:var(--muted);}
    .btn{
      appearance:none;
      border:1px solid var(--border);
      background:#ffffff;
      border-radius:8px;
      padding:8px 12px;
      cursor:pointer;
      font:inherit;
    }
    .btn:hover{background:#f9fafb;}
    .btn.p{
  background:#0f9cdf;
  color:#ffffff;
  border-color:#0f9cdf;
}
.btn.p:hover{
  background:#0f9cdf;
  border-color:#0f9cdf;
  filter:brightness(0.95);
}
    .grid{display:grid;gap:8px;}
    .grid-2{grid-template-columns:repeat(2,1fr);}
    .grid-3{grid-template-columns:repeat(3,1fr);}
    .dashboard{display:grid;gap:16px;}
    .kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;}
    .kpi-card{
      background:#ffffff;
      border:1px solid var(--border);
      border-radius:12px;
      padding:14px;
      display:flex;
      flex-direction:column;
      gap:6px;
      min-height:110px;
    }
    .kpi-card.widget-add-card{
      align-items:center;
      justify-content:center;
      text-align:center;
      cursor:pointer;
      border-style:dashed;
      color:var(--muted);
    }
    .kpi-card.widget-add-card:hover{
      border-color:#0f9cdf;
      color:#0f9cdf;
      background:#f8fbff;
    }
    .widget-add-icon{
      width:36px;
      height:36px;
      border-radius:50%;
      background:rgba(15,156,223,0.12);
      color:#0f9cdf;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:22px;
      font-weight:700;
    }
    .widget-drawer{
      position:fixed;
      inset:0;
      display:none;
      align-items:stretch;
      justify-content:flex-end;
      background:rgba(15,23,42,0.32);
      z-index:50;
    }
    .widget-drawer.open{display:flex;}
    .widget-drawer-panel{
      width:min(360px, 92vw);
      background:#ffffff;
      border-left:1px solid var(--border);
      padding:20px;
      display:flex;
      flex-direction:column;
      gap:16px;
      box-shadow:-12px 0 24px rgba(15,23,42,0.12);
    }
    .widget-drawer-header{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
    }
    .widget-drawer-title{
      font-size:16px;
      font-weight:700;
    }
    .widget-drawer-helper{
      font-size:12px;
      color:var(--muted);
    }
    .widget-group{
      display:flex;
      flex-direction:column;
      gap:8px;
      padding-bottom:12px;
      border-bottom:1px solid var(--border);
    }
    .widget-group:last-child{border-bottom:none;padding-bottom:0;}
    .widget-group-title{
      font-size:12px;
      font-weight:700;
      letter-spacing:.08em;
      text-transform:uppercase;
      color:var(--muted);
    }
    .widget-item{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      padding:8px 10px;
      border-radius:8px;
      border:1px solid transparent;
    }
    .widget-item.loading{
      opacity:0.6;
    }
    .widget-item input{cursor:pointer;}
    .widget-item-label{
      font-size:13px;
      font-weight:600;
    }
    .widget-item-status{
      font-size:11px;
      color:var(--muted);
    }
    .kpi-label{
      font-size:11px;
      text-transform:uppercase;
      letter-spacing:.08em;
      color:var(--muted);
      font-weight:700;
    }
    .kpi-value{
      font-size:20px;
      font-weight:700;
    }
    .kpi-meta{
      display:flex;
      align-items:center;
      gap:6px;
      font-size:12px;
      color:var(--muted);
    }
    .kpi-change.up{color:#15803d;}
    .kpi-change.down{color:#b91c1c;}
    .booking-kickback .kick-row{
      display:flex;
      align-items:center;
      justify-content:space-between;
      font-size:13px;
      padding:4px 0;
    }
    .hero-grid{
      display:grid;
      grid-template-columns:minmax(0,2.2fr) minmax(240px,1fr);
      gap:16px;
      align-items:start;
    }
    .chart-layout{
      display:flex;
      gap:12px;
      align-items:flex-start;
    }
    .chart-y-axis{
      display:flex;
      flex-direction:column;
      justify-content:space-between;
      font-size:12px;
      color:var(--muted);
      padding-top:2px;
      height:220px;
      min-width:64px;
    }
    .chart-y-axis .tick{
      display:flex;
      align-items:center;
      gap:6px;
    }
    .chart-plot{
      flex:1;
      min-width:0;
      position:relative;
    }
    .chart-wrap{
      height:220px;
      display:flex;
      align-items:flex-end;
      gap:6px;
      padding-top:10px;
    }
    .chart-bar{
      flex:1;
      background:rgba(15,156,223,0.2);
      border-radius:6px 6px 0 0;
      position:relative;
      min-width:4px;
      transition:background 0.2s ease;
    }
    .chart-bar.active,
    .chart-bar:hover,
    .chart-bar.is-hover{
      background:rgba(15,156,223,0.5);
    }
    .chart-axis{
      display:flex;
      justify-content:space-between;
      font-size:12px;
      color:var(--muted);
      margin-top:8px;
    }
    .chart-toggles{
      flex-wrap:wrap;
      gap:6px;
    }
    .chart-toggle{
      border:1px solid var(--border);
      background:#ffffff;
      border-radius:999px;
      padding:6px 10px;
      font-size:12px;
      font-weight:600;
      cursor:pointer;
    }
    .chart-toggle.active{
      background:#0f9cdf;
      border-color:#0f9cdf;
      color:#ffffff;
    }
    .chart-tooltip{
      position:absolute;
      top:0;
      left:0;
      transform:translate(-50%, -100%);
      background:#111827;
      color:#ffffff;
      padding:10px 12px;
      border-radius:10px;
      font-size:12px;
      line-height:1.4;
      min-width:180px;
      box-shadow:0 8px 20px rgba(15,23,42,0.25);
      opacity:0;
      pointer-events:none;
      transition:opacity 0.15s ease;
      z-index:2;
    }
    .chart-tooltip.visible{
      opacity:1;
    }
    .chart-tooltip .tooltip-date{
      font-weight:700;
      margin-bottom:6px;
    }
    .chart-tooltip .tooltip-row{
      display:flex;
      justify-content:space-between;
      gap:12px;
    }
    .chart-tooltip .tooltip-row span{
      color:rgba(255,255,255,0.7);
    }
    .chart-tooltip .tooltip-row strong{
      font-weight:600;
    }
    .alert-item{
      display:flex;
      flex-direction:column;
      gap:6px;
      padding:10px 0;
      border-bottom:1px solid var(--border);
    }
    .alert-item:last-child{border-bottom:0;}
    .alert-title{font-weight:600;}
    .alert-action{
      align-self:flex-start;
      text-decoration:none;
      font-size:12px;
      font-weight:700;
      color:#0f9cdf;
    }
    .table-list{
      display:grid;
      gap:8px;
    }
    .table-row{
      display:grid;
      grid-template-columns:2fr 1.5fr 1fr 1fr 1fr;
      gap:8px;
      font-size:13px;
      align-items:center;
    }
    .table-row.head{
      font-size:11px;
      text-transform:uppercase;
      letter-spacing:.08em;
      color:var(--muted);
      font-weight:700;
    }
    .table-row a{
      color:inherit;
      text-decoration:none;
      font-weight:600;
    }
    .badge{
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding:4px 8px;
      border-radius:999px;
      background:#f8fafc;
      border:1px solid var(--border);
      font-size:12px;
      font-weight:600;
    }
    .snapshot-grid{
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(200px,1fr));
      gap:12px;
      margin-top:8px;
    }
    .snapshot-block{
      border:1px solid var(--border);
      border-radius:12px;
      padding:12px;
      background:#ffffff;
    }
    .skeleton{
      background:linear-gradient(90deg,#f1f5f9 25%,#e5e7eb 45%,#f1f5f9 65%);
      background-size:200% 100%;
      animation:shimmer 1.2s infinite;
      border-radius:8px;
    }
    .skeleton-line{height:12px;width:100%;}
    .skeleton-tile{height:76px;}
    @keyframes shimmer{
      0%{background-position:200% 0;}
      100%{background-position:-200% 0;}
    }
    .empty-state{
      color:var(--muted);
      font-size:13px;
      padding:8px 0;
    }
    .error-inline{
      color:#b91c1c;
      font-size:13px;
      padding:6px 0;
    }
        input,select,textarea{
      border:1px solid var(--border);
      border-radius:8px;
      padding:8px 10px;
      background:#ffffff;
      outline:none;
      font:inherit;
    }
    /* AI-generated field highlight (removed once user edits) */
.ai-gen{
  border:2px solid var(--ai) !important;
  box-shadow:0 0 0 3px rgba(0,159,227,.12);
}

/* AI highlight for contenteditable editor */
.ai-gen-editor{
  border:2px solid var(--ai) !important;
  box-shadow:0 0 0 3px rgba(0,159,227,.12);
}

/* AI highlight for drop areas */
.ai-gen-drop{
  border-color: var(--ai) !important;
}


    /* Fixed-height controls (use on selects that must line up perfectly) */
  .ctl{
  width:100%;
  height:40px;
  min-height:40px;
  padding:8px 10px;
  display:block;              /* KEY: stops baseline weirdness */
}
.field{
  display:flex;
  flex-direction:column;
  gap:4px;                    /* consistent label → control spacing */
}


    table{
      width:100%;
      border-collapse:collapse;
      font-size:14px;
    }
    th,td{
      text-align:left;
      padding:10px;
      border-bottom:1px solid var(--border);
    }
    th.promoter-col,
    td.promoter-col{
      text-align:center;
    }
    th{
      font-weight:600;
      color:#334155;
      background:#f8fafc;
    }
    .loading-strip{
      position:relative;
      height:6px;
      border-radius:999px;
      background:rgba(0,159,227,0.12);
      overflow:hidden;
    }
    .loading-strip::before{
      content:"";
      position:absolute;
      inset:0;
      width:35%;
      transform:translateX(-120%);
      background:linear-gradient(
        90deg,
        rgba(0,159,227,0),
        rgba(0,159,227,0.35),
        rgba(0,159,227,0.85),
        rgba(0,159,227,0.35),
        rgba(0,159,227,0)
      );
      animation:loading-strip 1.2s ease-in-out infinite;
    }
    @keyframes loading-strip{
      0%{transform:translateX(-120%);}
      100%{transform:translateX(320%);}
    }
    .error{color:#b91c1c;}
    .row{
      display:flex;
      gap:8px;
      align-items:center;
    }
    .drop{
      border:2px dashed #cbd5e1;
      border-radius:12px;
      padding:16px;
      text-align:center;
      color:#64748b;
      cursor:pointer;
    }
    .drop.drag{
      background:#f8fafc;
      border-color:#94a3b8;
    }
    .imgprev{
      max-height:140px;
      border:1px solid var(--border);
      border-radius:8px;
      display:none;
    }
    .progress{
      height:8px;
      background:#e5e7eb;
      border-radius:999px;
      overflow:hidden;
    }
    .bar{
      height:8px;
      background:#111827;
      width:0%;
      transition:width .2s ease-out;
    }
    .kbd{
      font:12px/1 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;
      background:#f3f4f6;
      border:1px solid #e5e7eb;
      border-radius:6px;
      padding:2px 6px;
    }
    .kebab{position:relative;}
.menu{
  position:absolute;
  right:0;
  top:28px;
  display:none;
  flex-direction:column;
  min-width:180px;
  background:#fff;
  border:1px solid #e5e7eb;
  border-radius:10px;
  box-shadow:0 10px 30px rgba(0,0,0,.12);
  padding:6px;
  z-index:999; /* ensure it’s always above the table */
}
.menu.open{display:flex;}
.menu.up{
  top:auto;
  bottom:28px; /* flips the menu above the dots */
}

    .menu a{
      display:block;
      padding:8px 10px;
      text-decoration:none;
      color:#111827;
    }
    .menu a:hover{background:#f8fafc;}
    .tip{font-size:12px;color:#64748b;margin-top:4px;}
    .pill{
      display:inline-block;
      padding:2px 8px;
      border-radius:999px;
      font-size:12px;
      border:1px solid var(--border);
      background:#f9fafb;
    }
    .pop{
      position:absolute;
      z-index:30;
      background:#ffffff;
      border:1px solid var(--border);
      border-radius:8px;
      box-shadow:0 8px 24px rgba(0,0,0,.08);
      min-width:260px;
      display:none;
    }
    .pop.open{display:block;}
    .opt{
      padding:8px 10px;
      cursor:pointer;
    }
    .opt:hover{background:#f8fafc;}
.table-wrap{
  overflow-x:auto;     /* keep horizontal scroll for tables */
  overflow-y:visible;  /* allow dropdown menus to escape */
  padding-bottom:72px; /* gives the last row enough breathing room */
  position:relative;
}
    .mini-grid{
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
      gap:10px;
    }
    .mini-card{
      padding:10px;
      border:1px solid var(--border);
      border-radius:10px;
      background:#f8fafc;
    }
    .tag{
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding:4px 10px;
      border-radius:999px;
      border:1px solid var(--border);
      background:#f8fafc;
      color:#334155;
      font-weight:700;
      font-size:12px;
    }
    .loyalty{
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding:4px 12px;
      border-radius:999px;
      font-weight:800;
      background:#ecfeff;
      color:#0e7490;
      border:1px solid #a5f3fc;
      text-transform:uppercase;
      letter-spacing:0.05em;
      font-size:12px;
    }
    .loyalty.vip{background:#fef9c3;color:#854d0e;border-color:#fcd34d;}
    .loyalty.repeat{background:#ecfdf3;color:#15803d;border-color:#bbf7d0;}
    .loyalty.new{background:#eef2ff;color:#4f46e5;border-color:#c7d2fe;}
    .status-badge{
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding:4px 8px;
      border-radius:10px;
      font-weight:700;
      border:1px solid var(--border);
      background:#f8fafc;
      text-transform:uppercase;
      font-size:12px;
      letter-spacing:0.02em;
    }
    .status-badge.paid{color:#166534;background:#ecfdf3;border-color:#bbf7d0;}
    .status-badge.refunded{color:#7c2d12;background:#fef2f2;border-color:#fecaca;}
    .status-badge.cancelled{color:#4338ca;background:#eef2ff;border-color:#c7d2fe;}
    .tabs{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      border-bottom:1px solid var(--border);
      margin-top:14px;
    }
    .tab-btn{
      padding:8px 12px;
      border:1px solid var(--border);
      border-bottom:none;
      border-radius:10px 10px 0 0;
      background:#f8fafc;
      font-weight:700;
      cursor:pointer;
    }
    .tab-btn.active{
      background:#ffffff;
      border-bottom:1px solid #ffffff;
    }
    .tab-panel{
      display:none;
      padding-top:12px;
    }
    .tab-panel.active{
      display:block;
    }
    .drawer-overlay{
      position:fixed;
      top:var(--header-h);
      left:0;
      right:0;
      bottom:0;
      background:rgba(15,23,42,0.25);
      display:none;
      z-index:24;
    }
    .drawer-overlay.open{display:block;}
    .drawer{
      position:fixed;
      top:var(--header-h);
      right:-540px;
      bottom:0;
      width:min(540px,100%);
      background:#ffffff;
      border-left:1px solid var(--border);
      box-shadow:-14px 0 32px rgba(0,0,0,.12);
      transition:right .18s ease;
      z-index:25;
      overflow-y:auto;
      padding:18px;
    }
    .drawer.open{right:0;}
    .drawer-header{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:10px;
      position:sticky;
      top:0;
      background:#ffffff;
      padding-bottom:10px;
    }
    .drawer-section{margin-top:12px;}
    .drawer-section .title{margin:0 0 6px;}
    .drawer-close{
      background:none;
      border:1px solid var(--border);
      border-radius:10px;
      padding:6px 8px;
      cursor:pointer;
    }
    .orders-toolbar{
      display:flex;
      flex-wrap:wrap;
      align-items:center;
      justify-content:space-between;
      gap:12px;
    }
    .orders-filters{
      margin-top:12px;
      display:grid;
      gap:10px;
      grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
    }
    .orders-filters label{
      font-size:12px;
      font-weight:700;
      color:var(--muted);
      display:grid;
      gap:4px;
    }
    .orders-filters input,
    .orders-filters select{
      padding:8px 10px;
      border-radius:10px;
      border:1px solid var(--border);
      font-size:13px;
      background:#ffffff;
    }
    .orders-kpis{
      margin-top:14px;
      display:grid;
      gap:10px;
      grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
    }
    .orders-kpi{
      background:#f8fafc;
      border:1px solid var(--border);
      border-radius:12px;
      padding:10px;
      display:grid;
      gap:4px;
    }
    .orders-kpi .label{
      font-size:12px;
      color:var(--muted);
      font-weight:700;
      text-transform:uppercase;
      letter-spacing:.04em;
    }
    .orders-kpi .value{
      font-size:18px;
      font-weight:800;
      color:var(--ink);
    }
    .orders-actions{
      margin-top:12px;
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      align-items:center;
    }
    .orders-columns{
      position:relative;
    }
    .orders-columns-panel{
      position:absolute;
      right:0;
      top:40px;
      background:#ffffff;
      border:1px solid var(--border);
      border-radius:12px;
      padding:10px;
      min-width:200px;
      box-shadow:0 10px 20px rgba(15,23,42,0.12);
      display:none;
      z-index:5;
    }
    .orders-columns-panel.open{display:block;}
    .orders-actions .bulk-input{
      min-width:220px;
    }
    .orders-table-wrap{
      margin-top:12px;
      overflow:auto;
      border:1px solid var(--border);
      border-radius:12px;
      background:#ffffff;
    }
    .orders-table{
      width:100%;
      border-collapse:collapse;
      font-size:13px;
      min-width:980px;
    }
    .orders-table th,
    .orders-table td{
      padding:10px 12px;
      border-bottom:1px solid var(--border);
      text-align:left;
      vertical-align:top;
    }
    .orders-table th{
      font-size:12px;
      text-transform:uppercase;
      letter-spacing:.04em;
      color:var(--muted);
      cursor:pointer;
      position:sticky;
      top:0;
      background:#f9fafb;
      z-index:1;
    }
    .orders-table tr:hover{background:#f9fafb;}
    .orders-table .col-hidden{display:none;}
    .orders-tag{
      display:inline-flex;
      align-items:center;
      padding:2px 8px;
      border-radius:999px;
      background:#e0f2fe;
      border:1px solid #bae6fd;
      color:#0369a1;
      font-size:11px;
      font-weight:700;
      margin-right:4px;
      margin-bottom:4px;
    }
    .orders-status{
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding:3px 8px;
      border-radius:999px;
      border:1px solid var(--border);
      font-weight:700;
      text-transform:uppercase;
      font-size:11px;
    }
    .orders-status.paid{background:#ecfdf3;color:#166534;border-color:#bbf7d0;}
    .orders-status.refunded{background:#fef2f2;color:#b91c1c;border-color:#fecaca;}
    .orders-status.cancelled{background:#eef2ff;color:#4338ca;border-color:#c7d2fe;}
    .orders-status.pending{background:#f8fafc;color:#475569;border-color:#e2e8f0;}
    .orders-delivery{
      display:flex;
      gap:6px;
      align-items:center;
      font-size:12px;
    }
    .orders-delivery .pill{
      display:inline-flex;
      align-items:center;
      gap:4px;
      padding:2px 6px;
      border-radius:999px;
      border:1px solid var(--border);
      background:#f8fafc;
      font-weight:700;
      font-size:11px;
    }
    .pill.sent{color:#166534;background:#ecfdf3;border-color:#bbf7d0;}
    .pill.failed{color:#b91c1c;background:#fef2f2;border-color:#fecaca;}
    .pill.skipped{color:#475569;background:#f8fafc;border-color:#e2e8f0;}
    .pill.unknown{color:#7c3aed;background:#ede9fe;border-color:#ddd6fe;}
    .pill.good{color:#166534;background:#ecfdf3;border-color:#bbf7d0;}
    .pill.bad{color:#b91c1c;background:#fef2f2;border-color:#fecaca;}
    .orders-pagination{
      margin-top:12px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      flex-wrap:wrap;
    }
    .orders-drawer-backdrop{
      position:fixed;
      top:var(--header-h);
      left:0;
      right:0;
      bottom:0;
      background:rgba(15,23,42,0.35);
      opacity:0;
      pointer-events:none;
      transition:opacity .2s ease;
      z-index:30;
    }
    .orders-drawer-backdrop.open{
      opacity:1;
      pointer-events:auto;
    }
    .orders-drawer{
      position:fixed;
      top:var(--header-h);
      right:-520px;
      bottom:0;
      width:min(520px,100%);
      background:#ffffff;
      border-left:1px solid var(--border);
      box-shadow:-18px 0 32px rgba(15,23,42,.18);
      padding:18px;
      overflow-y:auto;
      transition:right .2s ease;
      z-index:31;
    }
    .orders-drawer.open{right:0;}
    .orders-drawer h3{margin:0 0 6px;font-size:18px;}
    .orders-drawer .section{margin-top:14px;}
    .orders-drawer .section-title{
      font-size:12px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.05em;
      color:var(--muted);
      margin-bottom:6px;
    }
    .orders-drawer .close-btn{
      background:#ffffff;
      border:1px solid var(--border);
      border-radius:10px;
      padding:6px 10px;
      cursor:pointer;
    }
    .ps-create-page{
      max-width:980px;
      margin:0 auto;
      display:flex;
      flex-direction:column;
      gap:16px;
    }
    .ps-create-hero{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:16px;
    }
    .ps-eyebrow{
      text-transform:uppercase;
      letter-spacing:.08em;
      font-size:11px;
      font-weight:700;
      color:var(--muted);
      margin-bottom:6px;
    }
    .ps-section{
      display:flex;
      flex-direction:column;
      gap:12px;
    }
    .ps-section-header{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:12px;
    }
    .ps-section-header .section-title{
      font-weight:700;
      font-size:16px;
      margin-bottom:4px;
    }
    .ps-chip{
      background:#e6f6f4;
      color:#0f766e;
      font-size:11px;
      font-weight:700;
      border-radius:999px;
      padding:4px 10px;
      white-space:nowrap;
    }
    .ps-upload-card{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      padding:12px;
      border:1px dashed var(--border);
      border-radius:12px;
      background:#f8fafc;
      flex-wrap:wrap;
    }
    .ps-row-list{
      display:grid;
      gap:8px;
    }
    .ps-form-grid{
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
      gap:12px;
    }
    .ps-field{
      display:grid;
      gap:6px;
      font-size:13px;
      font-weight:600;
      color:var(--text);
    }
    .ps-field span{
      font-size:12px;
      color:var(--muted);
      text-transform:uppercase;
      letter-spacing:.04em;
    }
    .ps-field-wide{
      grid-column:1 / -1;
    }
    .ps-check{
      display:flex;
      align-items:center;
      gap:8px;
      font-size:14px;
      font-weight:600;
      color:var(--text);
      padding-top:8px;
    }
    .ps-tip-card{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      padding:12px 16px;
      border-radius:14px;
      background:#e6f6f4;
      color:#0f766e;
    }
    .ps-tip-title{
      font-weight:700;
      margin-bottom:4px;
    }
    .ps-tip-text{
      font-size:13px;
    }
    .ps-tip-link{
      font-weight:700;
      white-space:nowrap;
    }
    .ps-action-bar{
      display:flex;
      align-items:center;
      gap:12px;
      flex-wrap:wrap;
    }
    @media (max-width:720px){
      .ps-create-hero{
        flex-direction:column;
        align-items:flex-start;
      }
      .ps-tip-card{
        flex-direction:column;
        align-items:flex-start;
      }
    }
  </style>
</head>
<body>
  <header class="top-header">
    <a class="hdr-brand" href="/admin/ui/home" data-view="/admin/ui/home">
      <!-- NOTE: spaces must be URL-encoded -->
      <img
  class="hdr-logo"
  src="/admin/ui/brand-logo"
  alt="TixAll"
/>

    </a>

    <div class="hdr-right">
      <button class="hdr-menu-toggle" id="hdrMenuToggle" aria-label="Toggle menu" aria-expanded="false" aria-controls="adminSidebar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" stroke="#111827" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </button>
      <div class="hdr-account" id="hdrAccount">
        <button class="hdr-account-btn" id="hdrAccountBtn" aria-haspopup="menu" aria-expanded="false" title="Account">
          <!-- Simple person icon (inline SVG) -->
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.51 4.51 0 0 0 12 12Z" stroke="#111827" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M4 20.2c1.7-4.1 5.1-6.2 8-6.2s6.3 2.1 8 6.2" stroke="#111827" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <div class="hdr-account-menu" id="hdrAccountMenu" role="menu" aria-label="Account menu">
          <a class="hdr-menu-item" href="/admin/ui/account" data-view="/admin/ui/account" role="menuitem">Account</a>
          <a class="hdr-menu-item" href="/admin/ui/finance" data-view="/admin/ui/finance" role="menuitem">Finance</a>
          <div class="hdr-menu-sep"></div>
          <a class="hdr-menu-item" href="/admin/ui/logout" role="menuitem">Log out</a>
        </div>
      </div>
    </div>
  </header>

  <div class="wrap">
    <aside class="sidebar" id="adminSidebar">
      <div class="sb-group">Dashboard</div>
      <a class="sb-link" href="/admin/ui/home" data-view="/admin/ui/home">Home</a>

      <div class="sb-group">Shows and Events</div>
      <div>
        <div class="sb-sub" id="showsSub">
        <a class="sb-link sub" href="/admin/ui/shows/create" data-view="/admin/ui/shows/create">Create Show</a>

<a class="sb-link sub" href="/admin/ui/shows/create-ai" data-view="/admin/ui/shows/create-ai">
  <span class="sb-link-row">
    <span class="sb-link-label">Create Show</span>
    <span class="ai-badge" title="AI assisted">TixAll AI</span>
  </span>
</a>

        <a class="sb-link sub" href="/admin/ui/shows/current" data-view="/admin/ui/shows/current">All Events</a>
      </div>

      </div>
      <a class="sb-link" href="/admin/ui/customers" data-view="/admin/ui/customers">Customers</a>
      <a class="sb-link" href="/admin/ui/venues" data-view="/admin/ui/venues">Venues</a>
      <a class="sb-link" href="/admin/ui/promoters" data-view="/admin/ui/promoters">Promoters</a>
      <a class="sb-link" href="/admin/ui/orders" data-view="/admin/ui/orders">Orders</a>

      <div class="sb-group">Insights</div>
      <a class="sb-link" href="/admin/ui/analytics" data-view="/admin/ui/analytics">Analytics</a>

      <div class="sb-group">Marketing</div>
      <a class="sb-link" href="/admin/ui/marketing" data-view="/admin/ui/marketing">Marketing</a>
      <a class="sb-link" href="/admin/ui/audiences" data-view="/admin/ui/audiences">Audiences</a>
      <a class="sb-link" href="/admin/ui/email" data-view="/admin/ui/email">Email Campaigns</a>

      <div class="sb-group">Commerce</div>
      <a class="sb-link" href="/admin/ui/product-store" data-view="/admin/ui/product-store">Product Store</a>

      <div class="sb-group">Settings</div>
      <a class="sb-link" href="/admin/ui/account" data-view="/admin/ui/account">Account</a>
<a class="sb-link" href="/admin/ui/logout">Log out</a>
    </aside>

    <main class="content" id="main">
      <div class="card"><div class="title">Loading…</div></div>
    </main>
  </div>

<script>
(function(){
  console.log('[Admin UI] booting');
  var menuToggle = document.getElementById('hdrMenuToggle');
  var sidebar = document.getElementById('adminSidebar');
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', function(){
      var isOpen = document.body.classList.toggle('sidebar-open');
      menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    sidebar.addEventListener('click', function(event){
      if (window.innerWidth > 960) return;
      if (event.target && event.target.closest && event.target.closest('a')) {
        document.body.classList.remove('sidebar-open');
        menuToggle.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('click', function(event){
      if (window.innerWidth > 960) return;
      if (!document.body.classList.contains('sidebar-open')) return;
      if (menuToggle.contains(event.target) || sidebar.contains(event.target)) return;
      document.body.classList.remove('sidebar-open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });

    window.addEventListener('resize', function(){
      if (window.innerWidth > 960) {
        document.body.classList.remove('sidebar-open');
        menuToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }
    // If the session has expired, force login (1 hour inactivity)
  (async function ensureAuth(){
    try{
      const r = await fetch('/auth/me', { credentials:'include' });
      if(!r.ok) location.href = '/admin/ui/login';
    }catch(e){
      location.href = '/admin/ui/login';
    }
  })();

  function $(sel, root){ return (root || document).querySelector(sel); }
  function $$(sel, root){ return Array.from((root || document).querySelectorAll(sel)); }
  function escapeHtml(s){
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  function promoterLabel(promoter){
    return (promoter && (promoter.tradingName || promoter.name)) || '';
  }
  function promoterInitials(label){
    var text = String(label || '').trim();
    if (!text) return '';
    var parts = text.split(/\s+/).filter(Boolean);
    var first = parts[0] ? parts[0][0] : '';
    var second = parts.length > 1 ? parts[1][0] : '';
    return (first + second).toUpperCase();
  }
  function promoterAvatarHtml(promoter, opts){
    opts = opts || {};
    var size = opts.size || 48;
    var label = promoterLabel(promoter) || (promoter ? 'Promoter' : 'Add promoter');
    var initials = promoter ? promoterInitials(label) : '+';
    var logoUrl = promoter && promoter.logoUrl;
    var fontSize = Math.max(14, Math.round(size * 0.42));
    var inner = logoUrl
      ? '<img src="' + escapeHtml(logoUrl) + '" alt="' + escapeHtml(label) + ' logo" style="width:100%;height:100%;object-fit:cover;display:block;" />'
      : '<span style="font-weight:700;color:#0f172a;font-size:' + fontSize + 'px;">' + escapeHtml(initials || '+') + '</span>';
    return ''
      + '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:999px;background:#f1f5f9;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;overflow:hidden;">'
      + inner
      + '</div>';
  }
    // --- AI field highlighting ---
  function markAi(el, kind){
    if (!el) return;
    if (kind === 'editor') el.classList.add('ai-gen-editor');
    else if (kind === 'drop') el.classList.add('ai-gen-drop');
    else el.classList.add('ai-gen');
    el.dataset.aiGen = '1';
  }

  function clearAi(el){
    if (!el) return;
    el.classList.remove('ai-gen','ai-gen-editor','ai-gen-drop');
    el.dataset.aiGen = '';
  }

  // Remove blue border as soon as the user changes the field
  function bindAiClearOnUserEdit(el, evts){
    if (!el) return;
    (evts || ['input','change','blur']).forEach(function(evt){
      el.addEventListener(evt, function(){
        if (el.dataset.aiGen === '1') clearAi(el);
      }, { passive:true });
    });
  }


  var main = $('#main');

  // --- Fixed header: account dropdown ---
(function initHeader(){
  var btn = $('#hdrAccountBtn');
  var menu = $('#hdrAccountMenu');
  var wrap = $('#hdrAccount');

  if (!btn || !menu || !wrap) return;

  function close(){
    menu.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }
  function toggle(){
    var isOpen = menu.classList.contains('open');
    if (isOpen) close();
    else{
      menu.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
  }

  btn.addEventListener('click', function(e){
    e.preventDefault();
    e.stopPropagation();
    toggle();
  });

  document.addEventListener('click', function(e){
    if (!wrap.contains(e.target)) close();
  });

  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') close();
  });
})();


  var showsToggle = $('#showsToggle');
  var showsSub = $('#showsSub');
  if (showsToggle && showsSub){
    showsToggle.addEventListener('click', function(e){
      e.preventDefault();
      showsSub.style.display = showsSub.style.display === 'none' ? 'block' : 'none';
    });
  }

  function setActive(path){
    $$('.sb-link').forEach(function(a){
      a.classList.toggle('active', a.getAttribute('data-view') === path);
    });
  }

  async function j(url, opts){
    const res = await fetch(url, { credentials:'include', ...(opts || {}) });
    let text = '';
    try{ text = await res.text(); } catch(e){}
    if (!res.ok){
      throw new Error(text || ('HTTP ' + res.status));
    }
    if (!text) return {};
    try{
      return JSON.parse(text);
    }catch(e){
      return {};
    }
  }

  function parseErr(e){
    var msg = (e && e.message) ? e.message : String(e || '');
    try{
      var j = JSON.parse(msg);
      return (j && (j.message || j.error)) ? (j.message || j.error) : msg;
    }catch{
      return msg;
    }
  }

  function formatVenueLabel(venue){
    if (!venue) return '';
    var name = venue.name || '';
    var city = venue.city || '';
    return name && city ? (name + ' – ' + city) : (name || city || '');
  }

  function formatShowLabel(show){
    if (!show) return '';
    var title = show.title || 'Untitled show';
    var when = show.date ? new Date(show.date).toLocaleDateString('en-GB', { dateStyle:'medium' }) : 'TBC';
    var venue = formatVenueLabel(show.venue);
    return title + ' · ' + when + (venue ? (' · ' + venue) : '');
  }

  function loadVenueExtrasFromStorage(){
    try{
      var saved = localStorage.getItem('adminVenueExtras');
      return saved ? JSON.parse(saved) : {};
    }catch(e){
      return {};
    }
  }

  function saveVenueExtrasToStorage(extras){
    try{ localStorage.setItem('adminVenueExtras', JSON.stringify(extras || {})); }catch(e){}
  }

  async function maybeSetupWeeklyReport(showId, promoter){
    if (!showId || !promoter || !promoter.id) return;
    var ok = confirm('Do you want to set up weekly reports for this promoter?');
    if (!ok) return;
    var time = prompt('What time should the weekly report be sent? (HH:MM)', '09:00');
    if (!time) return;
    var email = prompt('What email address should receive the weekly report?', promoter.email || '');
    if (!email) return;
    try{
      await j('/admin/shows/' + encodeURIComponent(showId) + '/promoters/' + encodeURIComponent(promoter.id) + '/weekly-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportEmail: email, reportTime: time })
      });
      alert('Weekly report scheduled.');
    }catch(err){
      alert('Failed to save weekly report settings: ' + parseErr(err));
    }
  }

  async function openPromoterLinker(opts){
    opts = opts || {};
    var showId = opts.showId;
    if (!showId) return;

    var overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(15,23,42,0.45)';
    overlay.style.zIndex = '60';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'flex-start';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '80px 16px 16px';

    overlay.innerHTML = ''
      + '<div style="background:#fff;border-radius:14px;max-width:520px;width:100%;padding:18px;border:1px solid var(--border);box-shadow:0 20px 40px rgba(15,23,42,0.2)">'
      +   '<div class="header" style="margin-bottom:12px;">'
      +     '<div>'
      +       '<div class="title">Link promoters</div>'
      +       '<div class="muted" style="margin-top:4px;">'+escapeHtml(opts.showTitle || 'Select promoters for this show')+'</div>'
      +     '</div>'
      +     '<button class="btn" id="promoterLinkClose">Close</button>'
      +   '</div>'
      +   '<div id="promoterLinkErr" class="error" style="margin-bottom:8px;"></div>'
      +   '<div id="promoterLinkList" style="display:grid;gap:8px;margin-bottom:12px;"></div>'
      +   '<div class="grid" style="gap:8px;">'
      +     '<label style="display:grid;gap:6px;">Add promoter'
      +       '<select id="promoterLinkSelect" class="ctl"></select>'
      +     '</label>'
      +     '<button class="btn p" id="promoterLinkAdd">Add promoter</button>'
      +   '</div>'
      + '</div>';

    document.body.appendChild(overlay);

    var closeBtn = overlay.querySelector('#promoterLinkClose');
    var errEl = overlay.querySelector('#promoterLinkErr');
    var listEl = overlay.querySelector('#promoterLinkList');
    var selectEl = overlay.querySelector('#promoterLinkSelect');
    var addBtn = overlay.querySelector('#promoterLinkAdd');
    var cachedPromoters = [];

    function close(){
      document.removeEventListener('keydown', escHandler);
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    overlay.addEventListener('click', function(e){
      if (e.target === overlay) close();
    });
    if (closeBtn) closeBtn.addEventListener('click', function(){ close(); });

    async function load(){
      if (errEl) errEl.textContent = '';
      if (listEl) listEl.innerHTML = '<div class="muted">Loading promoters…</div>';
      if (selectEl) selectEl.innerHTML = '';

      try{
        var res = await Promise.all([
          j('/admin/promoters'),
          j('/admin/shows/' + encodeURIComponent(showId) + '/promoters'),
        ]);
        var promoters = (res[0] && res[0].items) ? res[0].items : [];
        var linked = (res[1] && res[1].promoters) ? res[1].promoters : [];
        cachedPromoters = promoters;
        var linkedIds = new Set(linked.map(function(p){ return p.id; }));

        if (listEl){
          if (!linked.length){
            listEl.innerHTML = '<div class="muted">No promoters linked yet.</div>';
          }else{
            listEl.innerHTML = linked.map(function(p){
              var label = p.tradingName || p.name || 'Promoter';
              var meta = p.email ? (' · ' + p.email) : '';
              return ''
                + '<div class="row" style="justify-content:space-between;border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:#f8fafc;">'
                +   '<div><strong>'+escapeHtml(label)+'</strong><span class="muted" style="font-size:12px;">'+escapeHtml(meta)+'</span></div>'
                +   '<button class="btn" data-remove-promoter="'+escapeHtml(p.id)+'">Remove</button>'
                + '</div>';
            }).join('');
          }
        }

        if (selectEl){
          var options = promoters.filter(function(p){ return !linkedIds.has(p.id); });
          selectEl.innerHTML = '<option value="">Select promoter…</option>'
            + options.map(function(p){
              var label = p.tradingName || p.name || 'Promoter';
              var suffix = p.email ? (' · ' + p.email) : '';
              return '<option value="'+escapeHtml(p.id)+'">'+escapeHtml(label + suffix)+'</option>';
            }).join('');
          if (!options.length){
            selectEl.innerHTML = '<option value="">No additional promoters available</option>';
          }
        }

        if (listEl){
          $$('[data-remove-promoter]', listEl).forEach(function(btn){
            btn.addEventListener('click', async function(e){
              e.preventDefault();
              var pid = btn.getAttribute('data-remove-promoter');
              if (!pid) return;
              try{
                await j('/admin/shows/' + encodeURIComponent(showId) + '/promoters/' + encodeURIComponent(pid), {
                  method: 'DELETE',
                });
                await load();
                if (typeof opts.onUpdated === 'function') opts.onUpdated();
              }catch(err){
                if (errEl) errEl.textContent = parseErr(err);
              }
            });
          });
        }
      }catch(e){
        if (listEl) listEl.innerHTML = '';
        if (errEl) errEl.textContent = parseErr(e) || 'Failed to load promoters.';
      }
    }

    if (addBtn){
      addBtn.addEventListener('click', async function(){
        if (!selectEl || !selectEl.value) return;
        var selectedId = selectEl.value;
        if (errEl) errEl.textContent = '';
        try{
          await j('/admin/shows/' + encodeURIComponent(showId) + '/promoters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ promoterId: selectedId })
          });
          await load();
          if (typeof opts.onUpdated === 'function') opts.onUpdated();
          var chosen = cachedPromoters.find(function(p){ return p.id === selectedId; });
          await maybeSetupWeeklyReport(showId, chosen);
        }catch(err){
          if (errEl) errEl.textContent = parseErr(err);
        }
      });
    }

    load();
  }

  async function openVenuePanel(opts){
    opts = opts || {};
    var venueId = opts.venueId;
    if (!venueId) return;

    var overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(15,23,42,0.45)';
    overlay.style.zIndex = '60';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'flex-start';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '80px 16px 16px';

    overlay.innerHTML = ''
      + '<div style="background:#fff;border-radius:14px;max-width:980px;width:100%;padding:18px;border:1px solid var(--border);box-shadow:0 20px 40px rgba(15,23,42,0.2);max-height:calc(100vh - 140px);overflow:auto;">'
      +   '<div class="header" style="margin-bottom:12px;">'
      +     '<div>'
      +       '<div class="title">Venue details</div>'
      +       '<div class="muted" style="margin-top:4px;">'+escapeHtml(opts.venueLabel || 'Manage this venue without leaving all events')+'</div>'
      +     '</div>'
      +     '<button class="btn" id="venuePanelClose">Close</button>'
      +   '</div>'
      +   '<div id="venuePanelError" class="error" style="margin-bottom:8px;"></div>'
      +   '<div id="venuePanelBody"></div>'
      + '</div>';

    document.body.appendChild(overlay);

    var closeBtn = overlay.querySelector('#venuePanelClose');
    var errEl = overlay.querySelector('#venuePanelError');
    var body = overlay.querySelector('#venuePanelBody');
    var extras = loadVenueExtrasFromStorage();

    function close(){
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    overlay.addEventListener('click', function(e){
      if (e.target === overlay) close();
    });
    if (closeBtn) closeBtn.addEventListener('click', function(){ close(); });
    function escHandler(e){
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', escHandler);

    async function load(){
      if (!body) return;
      body.innerHTML = '<div class="muted">Loading venue…</div>';
      if (errEl) errEl.textContent = '';
      try{
        var res = await j('/admin/venues/' + encodeURIComponent(venueId));
        var venue = (res && (res.venue || res.item)) || res || {};
        renderVenueCard(venue);
      }catch(e){
        if (errEl) errEl.textContent = parseErr(e) || 'Failed to load venue.';
        body.innerHTML = '';
      }
    }

    function renderVenueCard(v){
      if (!body) return;
      body.innerHTML = '';
      if (!v || !v.id){
        body.innerHTML = '<div class="muted">Venue not found.</div>';
        return;
      }

      var card = document.createElement('div');
      card.className = 'card';
      card.style.margin = '0';

      var ext = extras && extras[v.id] ? extras[v.id] : {};
      var spaces = Array.isArray(ext.spaces)
        ? ext.spaces.map(function(space){
            if (typeof space === 'string') return { name: space, capacity: null };
            return {
              name: space && space.name ? String(space.name) : '',
              capacity: space && space.capacity != null ? Number(space.capacity) : null,
            };
          })
        : [];
      var maps = Array.isArray(ext.maps)
        ? ext.maps.map(function(map){
            if (typeof map === 'string') return { name: map, space: '' };
            return {
              name: map && map.name ? String(map.name) : '',
              space: map && map.space ? String(map.space) : '',
            };
          })
        : [];

      card.innerHTML = ''
        + '<div class="header">'
        +   '<div>'
        +     '<div class="title">' + escapeHtml(v.name || 'Untitled venue') + '</div>'
        +     '<div class="muted">' + escapeHtml([v.city, v.postcode].filter(Boolean).join(' • ')) + '</div>'
        +   '</div>'
        +   '<div class="row" style="gap:6px;align-items:center;">'
        +     '<div style="position:relative;">'
        +       '<button class="btn" data-action="venueMenu" title="Venue actions" style="padding:6px 8px;">'
        +         '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
        +           '<line x1="3" y1="6" x2="21" y2="6"></line>'
        +           '<line x1="3" y1="12" x2="21" y2="12"></line>'
        +           '<line x1="3" y1="18" x2="21" y2="18"></line>'
        +         '</svg>'
        +       '</button>'
        +       '<div data-menu="venueMenu" style="display:none;position:absolute;right:0;top:36px;background:#fff;border:1px solid var(--border);border-radius:8px;box-shadow:0 6px 18px rgba(15,23,42,0.12);min-width:160px;z-index:10;">'
        +         '<button class="btn" data-action="deleteVenue" style="width:100%;justify-content:flex-start;border:none;border-radius:8px;">Delete venue</button>'
        +       '</div>'
        +     '</div>'
        +   '</div>'
        + '</div>'

        + '<div class="grid" style="gap:10px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));">'
        +   '<div class="grid" style="gap:6px;">'
        +     '<label style="margin:0;font-weight:600;font-size:13px;">Venue photo</label>'
        +     '<div class="row" style="gap:12px;align-items:center;flex-wrap:wrap;">'
        +       '<div class="venue-photo" style="border:1px solid var(--border);border-radius:999px;height:88px;width:88px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#f9fafb;">'
        +         (ext.image ? '<img src="' + escapeHtml(ext.image) + '" alt="Preview" style="width:100%;height:100%;object-fit:cover;" />' : '<div class="muted" style="font-size:12px;">No image</div>')
        +       '</div>'
        +       '<div class="grid" style="gap:6px;">'
        +         '<input type="file" accept="image/*" data-field="imageFile" />'
        +         '<div class="row" style="gap:8px;align-items:center;">'
        +           '<button class="btn" data-action="uploadImage">Upload photo</button>'
        +           '<input type="hidden" data-field="image" value="' + escapeHtml(ext.image || '') + '" />'
        +         '</div>'
        +         '<div class="muted" style="font-size:12px;">Square images work best.</div>'
        +         '<div class="error" data-error="image"></div>'
        +       '</div>'
        +     '</div>'
        +   '</div>'

        +   '<div class="grid" style="gap:6px;">'
        +     '<label style="margin:0;font-weight:600;font-size:13px;">Contact name<input data-field="contactName" value="' + escapeHtml(ext.contactName || '') + '" placeholder="Venue manager" /></label>'
        +     '<label style="margin:0;font-weight:600;font-size:13px;">Contact email<input data-field="contactEmail" type="email" value="' + escapeHtml(ext.contactEmail || '') + '" placeholder="manager@example.com" /></label>'
        +     '<label style="margin:0;font-weight:600;font-size:13px;">Contact phone<input data-field="contactPhone" value="' + escapeHtml(ext.contactPhone || '') + '" placeholder="+44 20 1234 5678" /></label>'
        +   '</div>'

        +   '<div class="grid" style="gap:6px;">'
        +     '<label style="margin:0;font-weight:600;font-size:13px;" data-capacity-row="true">Capacity<input type="number" min="1" data-field="capacity" value="' + escapeHtml(String(ext.capacity || v.capacity || '')) + '" /></label>'
        +     '<label style="margin:0;font-weight:600;font-size:13px;">Ticket contra (£)<input type="number" min="0" step="0.01" data-field="contra" value="' + escapeHtml(ext.contra ? String(ext.contra) : '') + '" placeholder="e.g. 250" /></label>'
        +     '<label style="margin:0;font-weight:600;font-size:13px;">Booking fee (%)<input type="number" min="10" step="0.5" data-field="fee" value="' + escapeHtml(ext.fee ? String(ext.fee) : '10') + '" /></label>'
        +     '<div class="muted" style="font-size:12px;">Fees must be at least 10%. We recommend 10–15%.</div>'
        +   '</div>'
        + '</div>'

        + '<div class="grid" style="gap:10px;margin-top:10px;">'
        +   '<div class="grid" style="gap:6px;">'
        +     '<div class="row" style="justify-content:space-between;align-items:center;gap:8px;">'
        +       '<div style="font-weight:600;font-size:13px;">Spaces inside this venue</div>'
        +       '<button class="btn" data-action="addSpace" style="padding:6px 10px;">+ Space</button>'
        +     '</div>'
        +     '<div class="muted" style="font-size:12px;">Add areas like studio, foyer or main room.</div>'
        +     '<div class="grid" style="gap:6px;" data-list="spaces"></div>'
        +     '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:6px;">'
        +       '<input data-input="spaceName" placeholder="Space name" />'
        +       '<input data-input="spaceCapacity" type="number" min="1" placeholder="Capacity" />'
        +     '</div>'
        +   '</div>'

        +   '<div class="grid" style="gap:6px;">'
        +     '<div class="row" style="justify-content:space-between;align-items:center;gap:8px;">'
        +       '<div style="font-weight:600;font-size:13px;">Seating maps</div>'
        +       '<button class="btn" data-action="addMap" style="padding:6px 10px;">+ Map</button>'
        +     '</div>'
        +     '<div class="muted" style="font-size:12px;">Create and link seating maps to specific spaces.</div>'
        +     '<div class="grid" style="gap:6px;" data-list="maps"></div>'
        +     '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:6px;">'
        +       '<input data-input="mapName" placeholder="Seating map name" />'
        +       '<select data-input="mapSpace"></select>'
        +     '</div>'
        +   '</div>'
        + '</div>'

        + '<div class="row" style="justify-content:space-between;align-items:center;margin-top:12px;gap:8px;">'
        +   '<div class="muted" style="font-size:12px;">Save to keep booking fees, spaces and contacts linked to this venue.</div>'
        +   '<div class="row" style="gap:8px;align-items:center;">'
        +     '<div class="muted" data-status="' + escapeHtml(v.id) + '" style="font-size:12px;"></div>'
        +     '<button class="btn p" data-save="' + escapeHtml(v.id) + '">Save details</button>'
        +   '</div>'
        + '</div>';

      body.appendChild(card);

      var imgInput = card.querySelector('input[data-field="image"]');
      var imgFileInput = card.querySelector('input[data-field="imageFile"]');
      var uploadBtn = card.querySelector('[data-action="uploadImage"]');
      var imgErr = card.querySelector('[data-error="image"]');
      var preview = card.querySelector('.venue-photo');
      if (uploadBtn && imgFileInput && imgInput && preview){
        uploadBtn.addEventListener('click', async function(){
          if (imgErr) imgErr.textContent = '';
          var file = imgFileInput.files && imgFileInput.files[0];
          if (!file){
            if (imgErr) imgErr.textContent = 'Choose an image to upload.';
            return;
          }
          uploadBtn.disabled = true;
          uploadBtn.textContent = 'Uploading…';
          try{
            var upload = await uploadPoster(file);
            imgInput.value = upload.url || '';
            preview.innerHTML = upload.url
              ? '<img src="' + escapeHtml(upload.url) + '" alt="Preview" style="width:100%;height:100%;object-fit:cover;" />'
              : '<div class="muted" style="font-size:12px;">No image</div>';
          }catch(e){
            if (imgErr) imgErr.textContent = parseErr(e);
          }finally{
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload photo';
          }
        });
      }

      var spaceInput = card.querySelector('input[data-input="spaceName"]');
      var spaceCapacityInput = card.querySelector('input[data-input="spaceCapacity"]');
      var mapInput = card.querySelector('input[data-input="mapName"]');
      var mapSpaceInput = card.querySelector('select[data-input="mapSpace"]');
      var spaceList = card.querySelector('[data-list="spaces"]');
      var mapList = card.querySelector('[data-list="maps"]');
      var capacityRow = card.querySelector('[data-capacity-row="true"]');

      function updateCapacityRow(){
        if (!capacityRow) return;
        capacityRow.style.display = spaces.length ? 'none' : '';
      }

      function renderMapSpaces(){
        if (!mapSpaceInput) return;
        var options = spaces.filter(function(space){ return space.name; });
        mapSpaceInput.innerHTML = '<option value="">Link to space…</option>'
          + options.map(function(space){
            return '<option value="' + escapeHtml(space.name) + '">' + escapeHtml(space.name) + '</option>';
          }).join('');
      }

      function renderMaps(){
        if (!mapList) return;
        mapList.innerHTML = '';
        if (!maps.length){
          var emptyMap = document.createElement('div');
          emptyMap.className = 'muted';
          emptyMap.style.fontSize = '12px';
          emptyMap.textContent = 'Nothing added yet';
          mapList.appendChild(emptyMap);
          return;
        }
        maps.forEach(function(map, idx){
          var row = document.createElement('div');
          row.style.display = 'grid';
          row.style.gridTemplateColumns = 'minmax(140px,1fr) minmax(140px,1fr) auto';
          row.style.gap = '8px';
          row.style.alignItems = 'center';
          row.style.padding = '6px 0';
          row.style.borderBottom = '1px solid var(--border)';
          row.innerHTML = ''
            + '<input data-map-name="' + idx + '" value="' + escapeHtml(map.name || '') + '" placeholder="Map name" />'
            + '<select data-map-space="' + idx + '"></select>'
            + '<button class="btn" data-map-remove="' + idx + '">Remove</button>';
          mapList.appendChild(row);
        });
        $$('[data-map-name]', mapList).forEach(function(input){
          input.addEventListener('input', function(){
            var idx = Number(input.getAttribute('data-map-name'));
            if (!isNaN(idx) && maps[idx]) maps[idx].name = input.value.trim();
          });
        });
        $$('[data-map-space]', mapList).forEach(function(select){
          var idx = Number(select.getAttribute('data-map-space'));
          if (isNaN(idx) || !maps[idx]) return;
          var options = spaces.filter(function(space){ return space.name; });
          select.innerHTML = '<option value="">Link to space…</option>'
            + options.map(function(space){
              var selected = maps[idx].space === space.name ? ' selected' : '';
              return '<option value="' + escapeHtml(space.name) + '"' + selected + '>' + escapeHtml(space.name) + '</option>';
            }).join('');
          select.addEventListener('change', function(){
            maps[idx].space = select.value;
          });
        });
        $$('[data-map-remove]', mapList).forEach(function(btn){
          btn.addEventListener('click', function(){
            var idx = Number(btn.getAttribute('data-map-remove'));
            if (isNaN(idx)) return;
            maps.splice(idx, 1);
            renderMaps();
          });
        });
      }

      function renderSpaces(){
        if (!spaceList) return;
        spaceList.innerHTML = '';
        if (!spaces.length){
          var emptySpace = document.createElement('div');
          emptySpace.className = 'muted';
          emptySpace.style.fontSize = '12px';
          emptySpace.textContent = 'Nothing added yet';
          spaceList.appendChild(emptySpace);
          updateCapacityRow();
          renderMapSpaces();
          renderMaps();
          return;
        }
        spaces.forEach(function(space, idx){
          var row = document.createElement('div');
          row.style.display = 'grid';
          row.style.gridTemplateColumns = 'minmax(120px,1fr) minmax(120px,140px) auto';
          row.style.gap = '8px';
          row.style.alignItems = 'center';
          row.style.padding = '6px 0';
          row.style.borderBottom = '1px solid var(--border)';
          row.innerHTML = ''
            + '<input data-space-name="' + idx + '" value="' + escapeHtml(space.name || '') + '" placeholder="Space name" />'
            + '<input data-space-capacity="' + idx + '" type="number" min="1" placeholder="Capacity" value="' + (space.capacity != null ? escapeHtml(String(space.capacity)) : '') + '" />'
            + '<button class="btn" data-space-remove="' + idx + '">Remove</button>';
          spaceList.appendChild(row);
        });

        $$('[data-space-name]', spaceList).forEach(function(input){
          input.addEventListener('input', function(){
            var idx = Number(input.getAttribute('data-space-name'));
            if (!isNaN(idx) && spaces[idx]) spaces[idx].name = input.value.trim();
            renderMapSpaces();
            renderMaps();
          });
        });
        $$('[data-space-capacity]', spaceList).forEach(function(input){
          input.addEventListener('input', function(){
            var idx = Number(input.getAttribute('data-space-capacity'));
            if (isNaN(idx) || !spaces[idx]) return;
            var raw = input.value.trim();
            spaces[idx].capacity = raw ? Number(raw) : null;
          });
        });
        $$('[data-space-remove]', spaceList).forEach(function(btn){
          btn.addEventListener('click', function(){
            var idx = Number(btn.getAttribute('data-space-remove'));
            if (isNaN(idx)) return;
            spaces.splice(idx, 1);
            renderSpaces();
          });
        });
        updateCapacityRow();
        renderMapSpaces();
      }

      renderSpaces();
      renderMaps();

      function addSpaceFromInputs(){
        if (!spaceInput) return;
        var name = (spaceInput.value || '').trim();
        var capRaw = spaceCapacityInput ? (spaceCapacityInput.value || '').trim() : '';
        if (!name) return;
        var cap = capRaw ? Number(capRaw) : null;
        spaces.push({ name: name, capacity: cap && !isNaN(cap) ? cap : null });
        spaceInput.value = '';
        if (spaceCapacityInput) spaceCapacityInput.value = '';
        renderSpaces();
      }

      function addMapFromInputs(){
        if (!mapInput) return;
        var name = (mapInput.value || '').trim();
        if (!name) return;
        var space = mapSpaceInput ? mapSpaceInput.value : '';
        maps.push({ name: name, space: space || '' });
        mapInput.value = '';
        if (mapSpaceInput) mapSpaceInput.value = '';
        renderMaps();
      }

      if (spaceInput){
        spaceInput.addEventListener('keydown', function(e){
          if (e.key === 'Enter'){ e.preventDefault(); addSpaceFromInputs(); }
        });
      }
      if (spaceCapacityInput){
        spaceCapacityInput.addEventListener('keydown', function(e){
          if (e.key === 'Enter'){ e.preventDefault(); addSpaceFromInputs(); }
        });
      }
      if (mapInput){
        mapInput.addEventListener('keydown', function(e){
          if (e.key === 'Enter'){ e.preventDefault(); addMapFromInputs(); }
        });
      }

      var addSpaceBtn = card.querySelector('[data-action="addSpace"]');
      if (addSpaceBtn){
        addSpaceBtn.addEventListener('click', function(){
          addSpaceFromInputs();
          if (spaceInput) spaceInput.focus();
        });
      }

      var addMapBtn = card.querySelector('[data-action="addMap"]');
      if (addMapBtn){
        addMapBtn.addEventListener('click', function(){
          addMapFromInputs();
          if (mapInput) mapInput.focus();
        });
      }

      var menuToggle = card.querySelector('[data-action="venueMenu"]');
      var menu = card.querySelector('[data-menu="venueMenu"]');
      if (menuToggle && menu){
        menuToggle.addEventListener('click', function(e){
          e.stopPropagation();
          var open = menu.style.display === 'block';
          menu.style.display = open ? 'none' : 'block';
        });
        document.addEventListener('click', function(){
          menu.style.display = 'none';
        });
      }

      card.querySelectorAll('[data-action="deleteVenue"]').forEach(function(btn){
        btn.addEventListener('click', async function(e){
          e.preventDefault();
          e.stopPropagation();
          if (!confirm('Delete this venue?')) return;
          try{
            await j('/admin/venues/' + encodeURIComponent(v.id), { method:'DELETE' });
            close();
          }catch(err){
            if (errEl) errEl.textContent = 'Failed to delete venue: ' + parseErr(err);
          }
        });
      });

      var feeInput = card.querySelector('input[data-field="fee"]');
      if (feeInput){
        feeInput.addEventListener('change', function(){
          var val = Number(feeInput.value || 0);
          if (!val || val < 10){
            feeInput.value = '10';
          }
        });
      }

      var saveBtn = card.querySelector('[data-save]');
      if (saveBtn){
        saveBtn.addEventListener('click', function(){
          var data = {
            image: imgInput ? imgInput.value.trim() : '',
            contactName: valueOf('contactName'),
            contactEmail: valueOf('contactEmail'),
            contactPhone: valueOf('contactPhone'),
            capacity: numberOf('capacity'),
            contra: numberOf('contra'),
            fee: Math.max(10, numberOf('fee') || 10),
            spaces: spaces.slice(),
            maps: maps.slice(),
          };
          extras = extras || {};
          extras[v.id] = data;
          saveVenueExtrasToStorage(extras);
          var status = card.querySelector('[data-status="' + v.id + '"]');
          if (status){
            status.textContent = 'Saved';
            status.style.color = '#059669';
            setTimeout(function(){ status.textContent = ''; }, 2000);
          }
        });
      }

      function valueOf(field){
        var el = card.querySelector('input[data-field="' + field + '"]');
        return el ? el.value.trim() : '';
      }
      function numberOf(field){
        var raw = valueOf(field);
        if (!raw) return null;
        var num = Number(raw);
        return isNaN(num) ? null : num;
      }
    }

    load();
  }

  function go(path){
    history.pushState(null, '', path);
    route();
  }

  // SPA links (sidebar + header) using data-view
document.addEventListener('click', function(e){
  var tgt = e.target;
  if (!tgt || !tgt.closest) return;

  var a = tgt.closest('a[data-view]');
  if (a){
    var view = a.getAttribute('data-view');
    if (view){
      e.preventDefault();
      go(view);
    }
  }
});


  window.addEventListener('popstate', route);

  function home(){
    if (!main) return;
    main.innerHTML =
      '<div class="dashboard">'
      +  '<section class="kpi-grid" id="kpiGrid">'
      +    '<div class="kpi-card skeleton skeleton-tile"></div>'
      +    '<div class="kpi-card skeleton skeleton-tile"></div>'
      +    '<div class="kpi-card skeleton skeleton-tile"></div>'
      +    '<div class="kpi-card skeleton skeleton-tile"></div>'
      +    '<div class="kpi-card skeleton skeleton-tile"></div>'
      +    '<div class="kpi-card skeleton skeleton-tile"></div>'
      +    '<div class="kpi-card skeleton skeleton-tile"></div>'
      +    '<div class="kpi-card skeleton skeleton-tile"></div>'
      +    '<div class="kpi-card skeleton skeleton-tile"></div>'
      +  '</section>'
      +  '<section class="hero-grid">'
      +    '<div class="card" id="heroCard">'
      +      '<div class="header">'
      +        '<div>'
      +          '<div class="title">Daily Performance</div>'
      +          '<div class="muted">Last 30 days · Europe/London</div>'
      +        '</div>'
      +        '<div class="row chart-toggles" id="chartToggles"></div>'
      +      '</div>'
      +      '<div id="chartBody">'
      +        '<div class="skeleton skeleton-line" style="height:200px;"></div>'
      +      '</div>'
      +    '</div>'
      +    '<div class="card" id="alertsCard">'
      +      '<div class="header"><div class="title">Early Warnings</div></div>'
      +      '<div id="alertsBody">'
      +        '<div class="skeleton skeleton-line"></div>'
      +        '<div class="skeleton skeleton-line" style="margin-top:8px;"></div>'
      +      '</div>'
      +    '</div>'
      +  '</section>'
      +  '<section class="grid grid-2" id="showsGrid">'
      +    '<div class="card" id="topShowsCard">'
      +      '<div class="header"><div class="title">Top Performing Shows (7 days)</div></div>'
      +      '<div id="topShowsBody"><div class="skeleton skeleton-line"></div></div>'
      +    '</div>'
      +    '<div class="card" id="bottomShowsCard">'
      +      '<div class="header"><div class="title">Needs Attention (7 days)</div></div>'
      +      '<div id="bottomShowsBody"><div class="skeleton skeleton-line"></div></div>'
      +    '</div>'
      +  '</section>'
      +  '<section class="card" id="customerCard">'
      +    '<div class="header"><div class="title">Customer Behaviour Snapshot</div></div>'
      +    '<div id="customerBody">'
      +      '<div class="skeleton skeleton-line"></div>'
      +      '<div class="skeleton skeleton-line" style="margin-top:8px;"></div>'
      +    '</div>'
      +  '</section>'
      +'</div>'
      +'<div class="widget-drawer" id="widgetDrawer" aria-hidden="true">'
      +  '<div class="widget-drawer-panel" role="dialog" aria-modal="true">'
      +    '<div class="widget-drawer-header">'
      +      '<div class="widget-drawer-title">Home screen widgets</div>'
      +      '<button class="btn" id="widgetDrawerClose" aria-label="Close">✕</button>'
      +    '</div>'
      +    '<div class="widget-drawer-helper">Tick to show a widget. Untick to hide it.</div>'
      +    '<div id="widgetDrawerError" class="error" style="display:none;"></div>'
      +    '<div id="widgetDrawerList" class="grid" style="gap:12px;"></div>'
      +  '</div>'
      +'</div>';

    var drawer = $('#widgetDrawer');
    if (drawer && !widgetDrawerEventsBound){
      var closeBtn = $('#widgetDrawerClose');
      if (closeBtn){
        closeBtn.addEventListener('click', function(){
          closeWidgetDrawer();
        });
      }
      drawer.addEventListener('click', function(e){
        if (e.target === drawer){
          closeWidgetDrawer();
        }
      });
      document.addEventListener('keydown', function(e){
        if (e.key === 'Escape'){
          closeWidgetDrawer();
        }
      });
      widgetDrawerEventsBound = true;
    }

    loadWidgetPreferences().then(function(){
      applyWidgetVisibility();
      renderDashboard();
      renderWidgetDrawer();
    });
  }

  const fmtMoney = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const fmtNumber = new Intl.NumberFormat('en-GB');
  const fmtPercent = new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
  const fmtDate = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: '2-digit',
    month: 'short'
  });
  const fmtDateTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  function renderDelta(value){
    var cls = value >= 0 ? 'up' : 'down';
    var arrow = value >= 0 ? '▲' : '▼';
    return '<span class="kpi-change ' + cls + '">' + arrow + ' ' + fmtPercent.format(Math.abs(value)) + '%</span>';
  }

  function formatMoney(pence){
    return fmtMoney.format((pence || 0) / 100);
  }

  var widgetState = { list: [], byKey: {} };
  var widgetLoading = {};
  var dashboardCache = { summary: null, kickback: null, topShows: null, alerts: null };
  var widgetDrawerEventsBound = false;

  function setWidgetState(widgets){
    widgetState.list = widgets || [];
    widgetState.byKey = widgetState.list.reduce(function(acc, item){
      acc[item.key] = item;
      return acc;
    }, {});
  }

  function isWidgetEnabled(key){
    if (!key) return true;
    if (!widgetState.list.length) return true;
    var item = widgetState.byKey[key];
    return item ? !!item.enabled : true;
  }

  async function loadWidgetPreferences(){
    try{
      var data = await j('/admin/ui/api/home-widgets');
      if (data && data.ok){
        setWidgetState(data.widgets || []);
      }
    }catch(e){
      setWidgetState([]);
    }
  }

  function applyWidgetVisibility(){
    var heroCard = $('#heroCard');
    var alertsCard = $('#alertsCard');
    var topShowsCard = $('#topShowsCard');
    var bottomShowsCard = $('#bottomShowsCard');
    var customerCard = $('#customerCard');
    var heroGrid = document.querySelector('.hero-grid');
    var showsGrid = $('#showsGrid');

    if (heroCard) heroCard.style.display = isWidgetEnabled('daily_performance') ? '' : 'none';
    if (alertsCard) alertsCard.style.display = isWidgetEnabled('early_warnings') ? '' : 'none';
    if (topShowsCard) topShowsCard.style.display = isWidgetEnabled('top_performing_shows') ? '' : 'none';
    if (bottomShowsCard) bottomShowsCard.style.display = isWidgetEnabled('needs_attention') ? '' : 'none';
    if (customerCard) customerCard.style.display = isWidgetEnabled('customer_behaviour_snapshot') ? '' : 'none';

    if (heroGrid){
      heroGrid.style.display = (isWidgetEnabled('daily_performance') || isWidgetEnabled('early_warnings')) ? '' : 'none';
    }
    if (showsGrid){
      showsGrid.style.display = (isWidgetEnabled('top_performing_shows') || isWidgetEnabled('needs_attention')) ? '' : 'none';
    }
  }

  function applyWidgetUpdate(updatedList){
    setWidgetState(updatedList || []);
    applyWidgetVisibility();
    if (dashboardCache.summary && dashboardCache.summary.ok){
      renderKpiTiles(dashboardCache.summary, dashboardCache.kickback);
      if (isWidgetEnabled('customer_behaviour_snapshot')){
        renderCustomerSnapshot(dashboardCache.summary.customerSnapshot);
      }
    }
    if (dashboardCache.topShows && dashboardCache.topShows.ok){
      if (isWidgetEnabled('top_performing_shows')){
        renderShows('topShowsBody', dashboardCache.topShows.top);
      }
      if (isWidgetEnabled('needs_attention')){
        renderShows('bottomShowsBody', dashboardCache.topShows.bottom);
      }
    }
    if (dashboardCache.alerts && dashboardCache.alerts.ok && isWidgetEnabled('early_warnings')){
      renderAlerts(dashboardCache.alerts);
    }
    if (isWidgetEnabled('daily_performance')){
      renderChartToggles();
      loadTimeseries(chartMetric);
    }
    renderWidgetDrawer();
  }

  function renderKpiTiles(summary, kickback){
    var grid = $('#kpiGrid');
    if (!grid) return;

    var tiles = [
      {
        key: 'tickets_sold_7d',
        label: 'Tickets sold (7d)',
        value: fmtNumber.format(summary.current.tickets || 0),
        delta: summary.comparisons.tickets
      },
      {
        key: 'orders_7d',
        label: 'Orders (7d)',
        value: fmtNumber.format(summary.current.orders || 0),
        delta: summary.comparisons.orders
      },
      {
        key: 'gross_revenue_7d',
        label: 'Gross revenue (7d)',
        value: formatMoney(summary.current.gross || 0),
        delta: summary.comparisons.gross
      },
      {
        key: 'net_revenue_7d',
        label: 'Net revenue (7d)',
        value: formatMoney(summary.current.net || 0),
        delta: summary.comparisons.net
      },
      {
        key: 'average_order_value',
        label: 'Average order value',
        value: formatMoney(summary.current.aov || 0),
        delta: summary.comparisons.aov
      },
      {
        key: 'new_customers_7d',
        label: 'New customers (7d)',
        value: fmtNumber.format(summary.current.newCustomers || 0),
        delta: summary.comparisons.newCustomers
      },
      {
        key: 'returning_customers_7d',
        label: 'Returning customers (7d)',
        value: fmtNumber.format(summary.current.returningCustomers || 0),
        delta: summary.comparisons.returningCustomers
      },
      {
        key: 'refunds_7d',
        label: 'Refunds (7d)',
        value: formatMoney(summary.current.refunds || 0),
        sub: fmtNumber.format(summary.current.refundsCount || 0) + ' refunds',
        delta: summary.comparisons.refunds
      }
    ];

    var html = tiles.filter(function(tile){
      return isWidgetEnabled(tile.key);
    }).map(function(tile){
      return (
        '<div class="kpi-card">'
        + '<div class="kpi-label">' + tile.label + '</div>'
        + '<div class="kpi-value">' + tile.value + '</div>'
        + (tile.sub ? '<div class="muted" style="font-size:12px;">' + tile.sub + '</div>' : '')
        + '<div class="kpi-meta">vs prev 7d ' + renderDelta(tile.delta) + '</div>'
        + '</div>'
      );
    }).join('');

    if (isWidgetEnabled('booking_fee_kickback')){
      var kick = kickback || { last7: 0, mtd: 0, last52w: 0 };
      html += (
        '<div class="kpi-card booking-kickback">'
        + '<div class="kpi-label">Booking Fee Kickback</div>'
        + '<div class="kick-row"><span>7 days</span><strong>' + formatMoney(kick.last7 || 0) + '</strong></div>'
        + '<div class="kick-row"><span>This month</span><strong>' + formatMoney(kick.mtd || 0) + '</strong></div>'
        + '<div class="kick-row"><span>52 weeks</span><strong>' + formatMoney(kick.last52w || 0) + '</strong></div>'
        + '</div>'
      );
    }

    html += (
      '<div class="kpi-card widget-add-card" id="widgetAddTile" role="button" tabindex="0">'
      + '<div class="widget-add-icon">+</div>'
      + '<div class="kpi-value" style="font-size:14px;font-weight:700;">Add or edit widgets</div>'
      + '<div class="muted" style="font-size:12px;">on your home screen</div>'
      + '</div>'
    );

    grid.innerHTML = html;

    var addTile = $('#widgetAddTile');
    if (addTile){
      addTile.addEventListener('click', function(){
        openWidgetDrawer();
      });
      addTile.addEventListener('keydown', function(e){
        if (e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          openWidgetDrawer();
        }
      });
    }
  }

  function renderWidgetDrawer(){
    var listEl = $('#widgetDrawerList');
    if (!listEl) return;

    var groups = {};
    (widgetState.list || []).forEach(function(widget){
      if (!groups[widget.category]) groups[widget.category] = [];
      groups[widget.category].push(widget);
    });

    var orderedCategories = ['Sales', 'Customers', 'Financial', 'Operations', 'Marketing'];
    listEl.innerHTML = orderedCategories.filter(function(cat){
      return groups[cat] && groups[cat].length;
    }).map(function(category){
      var items = groups[category] || [];
      var itemHtml = items.map(function(widget){
        var isLoading = !!widgetLoading[widget.key];
        var checked = widget.enabled ? 'checked' : '';
        return (
          '<label class="widget-item' + (isLoading ? ' loading' : '') + '">'
          + '<span class="widget-item-label">' + widget.title + '</span>'
          + '<span class="row" style="gap:8px;align-items:center;">'
          +   (isLoading ? '<span class="widget-item-status">Saving…</span>' : '')
          +   '<input type="checkbox" data-widget-key="' + widget.key + '" ' + checked + ' ' + (isLoading ? 'disabled' : '') + ' />'
          + '</span>'
          + '</label>'
        );
      }).join('');

      return (
        '<div class="widget-group">'
        + '<div class="widget-group-title">' + category + '</div>'
        + itemHtml
        + '</div>'
      );
    }).join('');

    $$('#widgetDrawerList input[type="checkbox"]').forEach(function(input){
      input.addEventListener('change', async function(){
        var key = input.getAttribute('data-widget-key');
        if (!key) return;
        var nextEnabled = input.checked;
        widgetLoading[key] = true;
        renderWidgetDrawer();
        try{
          var resp = await j('/admin/ui/api/home-widgets', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ widgetKey: key, enabled: nextEnabled })
          });
          if (resp && resp.ok){
            widgetLoading[key] = false;
            applyWidgetUpdate(resp.widgets || []);
            var err = $('#widgetDrawerError');
            if (err){ err.style.display = 'none'; err.textContent = ''; }
          }else{
            throw new Error((resp && resp.error) || 'Failed to update widget');
          }
        }catch(e){
          widgetLoading[key] = false;
          var errEl = $('#widgetDrawerError');
          if (errEl){
            errEl.textContent = 'Sorry, we could not save that change. Please try again.';
            errEl.style.display = 'block';
          }
          renderWidgetDrawer();
        }
      });
    });
  }

  function openWidgetDrawer(){
    var drawer = $('#widgetDrawer');
    if (!drawer) return;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
  }

  function closeWidgetDrawer(){
    var drawer = $('#widgetDrawer');
    if (!drawer) return;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
  }

  var timeseriesCache = {};
  var chartMetric = 'tickets';

  function isMoneyMetric(metric){
    return metric === 'gross' || metric === 'net' || metric === 'refunds';
  }

  function getNiceStep(maxValue, steps){
    if (!maxValue || maxValue <= 0) return 1;
    var rough = maxValue / steps;
    var pow10 = Math.pow(10, Math.floor(Math.log10(rough)));
    var normalized = rough / pow10;
    var step;
    if (normalized <= 1) step = 1;
    else if (normalized <= 2) step = 2;
    else if (normalized <= 5) step = 5;
    else step = 10;
    return step * pow10;
  }

  function renderChart(series, metric){
    var chartBody = $('#chartBody');
    if (!chartBody) return;

    if (!series || !series.length){
      chartBody.innerHTML = '<div class="empty-state">No orders in this period yet.</div>';
      return;
    }

    var maxValue = Math.max.apply(null, series.map(function(d){ return d.value || 0; })) || 1;
    var axisSteps = 4;
    var step = getNiceStep(maxValue, axisSteps);
    var maxTick = step * axisSteps;
    var barsHtml = series.map(function(point, idx){
      var height = Math.max(4, Math.round((point.value / maxTick) * 100));
      var isActive = idx === series.length - 1 ? ' active' : '';
      var labelValue = isMoneyMetric(metric)
        ? formatMoney(point.value)
        : fmtNumber.format(point.value || 0);
      return '<div class="chart-bar' + isActive + '" style="height:' + height + '%;" data-date="'
        + point.date + '" data-label="' + labelValue + '" data-tickets="'
        + (point.tickets || 0) + '" data-gross="' + (point.gross || 0) + '" data-platform="'
        + (point.platformFees || 0) + '" data-organiser="' + (point.organiserShare || 0) + '"></div>';
    }).join('');

    var startLabel = fmtDate.format(new Date(series[0].date));
    var endLabel = fmtDate.format(new Date(series[series.length - 1].date));
    var ticksHtml = '';
    for (var i = axisSteps; i >= 0; i -= 1){
      var tickValue = Math.round(step * i);
      var tickLabel = isMoneyMetric(metric)
        ? formatMoney(tickValue)
        : fmtNumber.format(tickValue);
      ticksHtml += '<div class="tick"><span>' + tickLabel + '</span></div>';
    }

    chartBody.innerHTML =
      '<div class="chart-layout">'
      + '<div class="chart-y-axis">' + ticksHtml + '</div>'
      + '<div class="chart-plot">'
      + '<div class="chart-wrap">' + barsHtml + '</div>'
      + '<div class="chart-axis"><span>' + startLabel + '</span><span>' + endLabel + '</span></div>'
      + '<div class="chart-tooltip" id="chartTooltip" aria-hidden="true"></div>'
      + '</div>'
      + '</div>';

    var tooltip = $('#chartTooltip');
    var plot = chartBody.querySelector('.chart-plot');
    if (!tooltip || !plot) return;

    function showTooltip(bar){
      var date = bar.getAttribute('data-date') || '';
      var tickets = Number(bar.getAttribute('data-tickets') || 0);
      var gross = Number(bar.getAttribute('data-gross') || 0);
      var platform = Number(bar.getAttribute('data-platform') || 0);
      var organiser = Number(bar.getAttribute('data-organiser') || 0);
      var kickback = Math.max(0, platform - organiser);

      tooltip.innerHTML =
        '<div class="tooltip-date">' + fmtDateTime.format(new Date(date)) + '</div>'
        + '<div class="tooltip-row"><span>Tickets sold</span><strong>' + fmtNumber.format(tickets) + '</strong></div>'
        + '<div class="tooltip-row"><span>Revenue taken</span><strong>' + formatMoney(gross) + '</strong></div>'
        + '<div class="tooltip-row"><span>Kickback from booking fee</span><strong>' + formatMoney(organiser) + '</strong></div>';

      var barRect = bar.getBoundingClientRect();
      var plotRect = plot.getBoundingClientRect();
      var left = barRect.left - plotRect.left + barRect.width / 2;
      var top = barRect.top - plotRect.top;
      var clampLeft = Math.max(90, Math.min(left, plotRect.width - 90));

      tooltip.style.left = clampLeft + 'px';
      tooltip.style.top = top + 'px';
      tooltip.classList.add('visible');
      tooltip.setAttribute('aria-hidden', 'false');
    }

    function hideTooltip(){
      tooltip.classList.remove('visible');
      tooltip.setAttribute('aria-hidden', 'true');
    }

    var bars = chartBody.querySelectorAll('.chart-bar');
    bars.forEach(function(bar){
      bar.addEventListener('mouseenter', function(){
        bars.forEach(function(other){ other.classList.remove('is-hover'); });
        bar.classList.add('is-hover');
        showTooltip(bar);
      });
      bar.addEventListener('mouseleave', function(){
        bar.classList.remove('is-hover');
        hideTooltip();
      });
    });
  }

  function renderChartToggles(){
    var toggles = $('#chartToggles');
    if (!toggles) return;

    var options = [
      { key: 'tickets', label: 'Tickets sold' },
      { key: 'gross', label: 'Gross £' },
      { key: 'net', label: 'Net £' },
      { key: 'refunds', label: 'Refund £' }
    ];

    toggles.innerHTML = options.map(function(opt){
      var active = opt.key === chartMetric ? ' active' : '';
      return '<button class="chart-toggle' + active + '" data-metric="' + opt.key + '">' + opt.label + '</button>';
    }).join('');

    $$('#chartToggles .chart-toggle').forEach(function(btn){
      btn.addEventListener('click', function(){
        var metric = btn.getAttribute('data-metric');
        if (!metric || metric === chartMetric) return;
        chartMetric = metric;
        renderChartToggles();
        loadTimeseries(metric);
      });
    });
  }

  async function loadTimeseries(metric){
    var chartBody = $('#chartBody');
    if (chartBody) chartBody.innerHTML = '<div class="skeleton skeleton-line" style="height:200px;"></div>';

    try{
      if (!timeseriesCache[metric]){
        timeseriesCache[metric] = await j('/admin/api/dashboard/timeseries?metric=' + metric + '&days=30');
      }
      var data = timeseriesCache[metric];
      if (!data || !data.ok) throw new Error('Failed to load chart');
      renderChart(data.series || [], metric);
    }catch(e){
      if (chartBody) chartBody.innerHTML = '<div class="error-inline">Chart failed to load.</div>';
    }
  }

  function renderAlerts(alertsData){
    var body = $('#alertsBody');
    if (!body) return;
    if (!alertsData || !alertsData.alerts || !alertsData.alerts.length){
      body.innerHTML = '<div class="empty-state">No early warnings right now.</div>'
        + (alertsData && alertsData.milestonesTracked === false ? '<div class="muted" style="font-size:12px;margin-top:6px;">Operational milestones are not tracked yet.</div>' : '');
      return;
    }

    body.innerHTML = alertsData.alerts.map(function(alert){
      return (
        '<div class="alert-item">'
        + '<div class="alert-title">' + escapeHtml(alert.title) + '</div>'
        + '<div class="muted" style="font-size:12px;">' + escapeHtml(alert.detail) + '</div>'
        + '<a class="alert-action" href="' + alert.action.href + '" data-view="' + alert.action.href + '">' + alert.action.label + '</a>'
        + '</div>'
      );
    }).join('');
  }

  function renderShows(containerId, shows){
    var body = $('#' + containerId);
    if (!body) return;

    if (!shows || !shows.length){
      body.innerHTML = '<div class="empty-state">No shows in this period yet.</div>';
      return;
    }

    var head = '<div class="table-row head">'
      + '<div>Show</div><div>Venue</div><div>Date</div><div>Tickets</div><div>Gross</div>'
      + '</div>';

    var rows = shows.map(function(show){
      var dateLabel = show.date ? fmtDateTime.format(new Date(show.date)) : 'TBC';
      var capacity = show.capacityPct !== null && show.capacityPct !== undefined
        ? '<span class="muted" style="font-size:11px;">' + Math.round(show.capacityPct) + '% cap</span>'
        : '';
      return (
        '<div class="table-row">'
        + '<div><a href="/admin/ui/shows/' + show.id + '/edit" data-view="/admin/ui/shows/' + show.id + '/edit">' + escapeHtml(show.title) + '</a></div>'
        + '<div>' + escapeHtml(show.venue || '-') + '</div>'
        + '<div>' + dateLabel + '</div>'
        + '<div>' + fmtNumber.format(show.tickets || 0) + '</div>'
        + '<div>' + formatMoney(show.gross || 0) + '<div>' + capacity + '</div></div>'
        + '</div>'
      );
    }).join('');

    body.innerHTML = '<div class="table-list">' + head + rows + '</div>';
  }

  function renderCustomerSnapshot(snapshot){
    var body = $('#customerBody');
    if (!body) return;

    if (!snapshot){
      body.innerHTML = '<div class="empty-state">No customer data yet.</div>';
      return;
    }

    var topTowns = (snapshot.topTowns || []).map(function(item){
      return '<div class="badge">' + escapeHtml(item.town) + ' · ' + fmtNumber.format(item.customers) + '</div>';
    }).join('');

    var topVenues = (snapshot.topVenues || []).map(function(item){
      return '<div class="badge">' + escapeHtml(item.venue) + ' · ' + fmtNumber.format(item.customers) + '</div>';
    }).join('');

    body.innerHTML =
      '<div class="snapshot-grid">'
      + '<div class="snapshot-block">'
      +   '<div class="kpi-label">New vs Returning (7d)</div>'
      +   '<div class="kpi-value">' + fmtNumber.format(snapshot.last7.newCustomers || 0) + ' / ' + fmtNumber.format(snapshot.last7.returningCustomers || 0) + '</div>'
      +   '<div class="muted" style="font-size:12px;">New / returning customers</div>'
      + '</div>'
      + '<div class="snapshot-block">'
      +   '<div class="kpi-label">New vs Returning (30d)</div>'
      +   '<div class="kpi-value">' + fmtNumber.format(snapshot.last30.newCustomers || 0) + ' / ' + fmtNumber.format(snapshot.last30.returningCustomers || 0) + '</div>'
      +   '<div class="muted" style="font-size:12px;">New / returning customers</div>'
      + '</div>'
      + '<div class="snapshot-block">'
      +   '<div class="kpi-label">Repeat Purchase Rate (90d)</div>'
      +   '<div class="kpi-value">' + fmtPercent.format(snapshot.repeatRate || 0) + '%</div>'
      +   '<div class="muted" style="font-size:12px;">Customers with 2+ orders</div>'
      + '</div>'
      + '<div class="snapshot-block">'
      +   '<div class="kpi-label">Lapsed Customers</div>'
      +   '<div class="kpi-value">' + fmtNumber.format(snapshot.lapsedCount || 0) + '</div>'
      +   '<div class="muted" style="font-size:12px;">90+ days since last purchase</div>'
      + '</div>'
      + '</div>'
      + '<div class="snapshot-grid" style="margin-top:12px;">'
      +   '<div class="snapshot-block">'
      +     '<div class="kpi-label">Top towns</div>'
      +     (topTowns ? topTowns : '<div class="empty-state">No customer towns yet.</div>')
      +   '</div>'
      +   '<div class="snapshot-block">'
      +     '<div class="kpi-label">Top venues</div>'
      +     (topVenues ? topVenues : '<div class="empty-state">No customer venues yet.</div>')
      +   '</div>'
      + '</div>';
  }

  async function renderDashboard(){
    if (isWidgetEnabled('daily_performance')){
      renderChartToggles();
      loadTimeseries(chartMetric);
    }

    try{
      var results = await Promise.allSettled([
        j('/admin/api/dashboard/summary?range=7d'),
        j('/admin/api/dashboard/booking-fee-kickback'),
        j('/admin/api/dashboard/top-shows?range=7d'),
        j('/admin/api/dashboard/alerts')
      ]);

      var summary = results[0].status === 'fulfilled' ? results[0].value : null;
      var kickback = results[1].status === 'fulfilled' ? results[1].value : null;
      var topShows = results[2].status === 'fulfilled' ? results[2].value : null;
      var alerts = results[3].status === 'fulfilled' ? results[3].value : null;

      dashboardCache.summary = summary;
      dashboardCache.kickback = kickback;
      dashboardCache.topShows = topShows;
      dashboardCache.alerts = alerts;

      if (!summary || !summary.ok){
        $('#kpiGrid').innerHTML = '<div class="error-inline">Summary failed to load.</div>';
      }else{
        renderKpiTiles(summary, kickback);
        if (isWidgetEnabled('customer_behaviour_snapshot')){
          renderCustomerSnapshot(summary.customerSnapshot);
        }
      }

      if (isWidgetEnabled('top_performing_shows') || isWidgetEnabled('needs_attention')){
        if (!topShows || !topShows.ok){
          if (isWidgetEnabled('top_performing_shows')){
            $('#topShowsBody').innerHTML = '<div class="error-inline">Top shows failed to load.</div>';
          }
          if (isWidgetEnabled('needs_attention')){
            $('#bottomShowsBody').innerHTML = '<div class="error-inline">Shows failed to load.</div>';
          }
        }else{
          if (isWidgetEnabled('top_performing_shows')){
            renderShows('topShowsBody', topShows.top);
          }
          if (isWidgetEnabled('needs_attention')){
            renderShows('bottomShowsBody', topShows.bottom);
          }
        }
      }

      if (isWidgetEnabled('early_warnings')){
        if (!alerts || !alerts.ok){
          $('#alertsBody').innerHTML = '<div class="error-inline">Alerts failed to load.</div>';
        }else{
          renderAlerts(alerts);
        }
      }
    }catch(e){
      $('#kpiGrid').innerHTML = '<div class="error-inline">Dashboard failed to load.</div>';
    }
  }

  // --- Venue search / inline create ---
  async function searchVenues(q){
    if (!q) return [];
    try{
      const res = await j('/admin/venues?q=' + encodeURIComponent(q));
      return res.items || [];
    }catch(e){
      return [];
    }
  }

  function mountVenuePicker(input, dateInput, opts){
  if (!input) return;
  opts = opts || {};
  var requireApproval = !!opts.requireApproval;

  var wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  var pop = document.createElement('div');
  pop.className = 'pop';
  wrapper.appendChild(pop);

  // expandable details panel (address + approval)
  var details = document.createElement('div');
  details.style.cssText =
    'display:none;margin-top:8px;padding:10px;border:1px solid var(--border);border-radius:8px;background:#fff;';
  wrapper.appendChild(details);

  // expandable create panel (name + address + save)
  var createPanel = document.createElement('div');
  createPanel.style.cssText =
    'display:none;margin-top:8px;padding:10px;border:1px dashed var(--border);border-radius:8px;background:#fff;';
  wrapper.appendChild(createPanel);

  var selectedVenue = null;
    // Allow programmatic AI prefill (select existing venue or open create form with address)
  input._venuePicker = {
    selectExisting: async function(v){
      if (!v) return;
      input.value = v.name || input.value || '';
      input.dataset.venueId = v.id || '';
      createPanel.style.display = 'none';
      close();
      selectedVenue = await tryFetchVenueDetails(v);
      setApproved(false);
      renderDetails();
    },
    openCreate: function(name, address){
      resetSelection();
      openCreateForm(name || '', address || '');
    }
  };


  function close(){ pop.classList.remove('open'); }

  function fmtDate(){
    if (!dateInput || !dateInput.value) return '';
    // datetime-local -> readable
    return dateInput.value.replace('T', ' ');
  }

  function fmtAddress(v){
    if (!v) return '';
    var parts = [];
    // try common keys (safe + non-breaking)
    if (v.address) parts.push(v.address);
    if (v.address1) parts.push(v.address1);
    if (v.address2) parts.push(v.address2);
    if (v.line1) parts.push(v.line1);
    if (v.line2) parts.push(v.line2);
    if (v.city) parts.push(v.city);
    if (v.town) parts.push(v.town);
    if (v.postcode) parts.push(v.postcode);
    if (v.zip) parts.push(v.zip);
    if (v.country) parts.push(v.country);
    return parts.filter(Boolean).join(', ');
  }

  function setApproved(val){
    if (!requireApproval) return;
    input.dataset.venueApproved = val ? '1' : '';
    renderDetails();
  }

  function canApprove(){
    return !!(selectedVenue && (selectedVenue.id || input.dataset.venueId) && dateInput && dateInput.value);
  }

  function renderDetails(){
    if (!selectedVenue){
      details.style.display = 'none';
      return;
    }

    var addr = fmtAddress(selectedVenue);
    var when = fmtDate();

    var approved = (input.dataset.venueApproved === '1');
    var approveDisabled = !canApprove();

    details.innerHTML = ''
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">'
      +   '<div>'
      +     '<div style="font-weight:600;">Venue selected</div>'
      +     '<div class="muted" style="margin-top:2px;">' + (selectedVenue.name || input.value || '') + '</div>'
      +     (addr ? ('<div class="muted" style="margin-top:2px;">' + addr + '</div>') : '')
      +     (when ? ('<div class="muted" style="margin-top:2px;">Date: ' + when + '</div>') : '')
      +   '</div>'
      +   (requireApproval ? (
            '<button type="button" id="venueApproveBtn" class="btn ' + (approved ? 'p' : '') + '" '
          + (approveDisabled ? 'disabled' : '')
          + ' style="white-space:nowrap;">'
          + (approved ? 'Approved ✓' : 'Approve venue & date')
          + '</button>'
        ) : '')
      + '</div>'
      + (requireApproval && !approved ? '<div class="muted" style="margin-top:8px;">Please approve before saving.</div>' : '');

    details.style.display = 'block';

    if (requireApproval){
      var btn = details.querySelector('#venueApproveBtn');
      if (btn){
        btn.addEventListener('click', function(){
          if (!canApprove()) return;
          setApproved(true);
        });
      }
    }
  }

  function resetSelection(){
    selectedVenue = null;
    input.dataset.venueId = '';
    if (requireApproval) input.dataset.venueApproved = '';
    details.style.display = 'none';
  }

  async function tryFetchVenueDetails(v){
    // If your searchVenues already returns full address, this is a no-op.
    // If you have an endpoint like /admin/venues/:id, we’ll attempt it and fall back safely.
    if (!v || !v.id) return v;
    try{
      var full = await j('/admin/venues/' + v.id);
      // support different shapes
      return (full && (full.venue || full.item || full)) || v;
    }catch(e){
      return v;
    }
  }

  async function createVenue(name, address){
    // attempt with address (preferred)
    try{
      var created = await j('/admin/venues', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name:name, address:address })
      });
      return created;
    }catch(e){
      // fallback: if backend rejects unknown keys, try name-only (won’t break your flow)
      var created2 = await j('/admin/venues', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name:name })
      });
      // attach address locally so UI can still show it
      if (created2 && (created2.venue || created2.item)){
        var vv = created2.venue || created2.item;
        vv.address = vv.address || address;
      }
      return created2;
    }
  }

  function openCreateForm(prefillName, prefillAddress){
    close();
    createPanel.innerHTML = ''
      + '<div style="font-weight:600;margin-bottom:8px;">Create new venue</div>'
      + '<div class="grid" style="gap:8px;">'
      +   '<div class="grid" style="gap:6px;">'
      +     '<label style="margin:0;">Venue name</label>'
      +     '<input id="newVenueName" value="' + (prefillName || '').replace(/"/g,'&quot;') + '" />'
      +   '</div>'
      +   '<div class="grid" style="gap:6px;">'
      +     '<label style="margin:0;">Address</label>'
      +     '<textarea id="newVenueAddress" rows="2" style="resize:vertical;">'
      +       (prefillAddress || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      +     '</textarea>'
      +   '</div>'
      +   '<div class="row" style="justify-content:flex-end;gap:8px;margin-top:6px;">'
      +     '<button type="button" id="cancelCreateVenue" class="btn">Cancel</button>'
      +     '<button type="button" id="saveCreateVenue" class="btn p">Save venue</button>'
      +   '</div>'
      +   '<div class="error" id="createVenueErr" style="margin-top:6px;"></div>'
      + '</div>';

    createPanel.style.display = 'block';

    var nameEl = createPanel.querySelector('#newVenueName');
    var addrEl = createPanel.querySelector('#newVenueAddress');
    if (addrEl) addrEl.focus();

    createPanel.querySelector('#cancelCreateVenue').addEventListener('click', function(){
      createPanel.style.display = 'none';
    });

    createPanel.querySelector('#saveCreateVenue').addEventListener('click', async function(){
      var errEl = createPanel.querySelector('#createVenueErr');
      if (errEl) errEl.textContent = '';

      var nm = nameEl ? nameEl.value.trim() : '';
      var ad = addrEl ? addrEl.value.trim() : '';

      if (!nm || !ad){
        if (errEl) errEl.textContent = 'Venue name and address are required.';
        return;
      }

      try{
        var created = await createVenue(nm, ad);
        var v = (created && (created.venue || created.item)) ? (created.venue || created.item) : null;
        if (!v || !v.id){
          throw new Error('Failed to create venue (no id returned).');
        }
        v.name = v.name || nm;
        v.address = v.address || ad;

        selectedVenue = v;
        input.value = v.name;
        input.dataset.venueId = v.id;

        createPanel.style.display = 'none';
        setApproved(false);
        renderDetails();
      }catch(e){
        if (errEl) errEl.textContent = 'Create failed: ' + (e.message || e);
      }
    });
  }

  function render(list, q){
    pop.innerHTML = '';

    // Always show only existing venues from search
    if (list && list.length){
      list.forEach(function(v){
        var el = document.createElement('div');
        el.className = 'opt';

        var label = (v.name || '');
        var addr = fmtAddress(v);
        el.textContent = label + (addr ? (' — ' + addr) : (v.city ? (' — ' + v.city) : ''));

        el.addEventListener('click', async function(){
          // select existing
          input.value = v.name || '';
          input.dataset.venueId = v.id;

          createPanel.style.display = 'none';
          close();

          selectedVenue = await tryFetchVenueDetails(v);
          setApproved(false);
          renderDetails();
        });

        pop.appendChild(el);
      });
    }

    // Create option if no exact match
    if (q && (!list || !list.some(function(v){ return (v.name || '').toLowerCase() === q.toLowerCase(); }))){
      var add = document.createElement('div');
      add.className = 'opt';
      add.innerHTML = '➕ Create venue “' + q + '”';
      add.addEventListener('click', function(){
        resetSelection();
        openCreateForm(q);
      });
      pop.appendChild(add);
    }

    if (pop.children.length){ pop.classList.add('open'); } else { close(); }
  }

  // typing clears selection + approval (forces picking from list or creating)
  input.addEventListener('input', async function(){
    resetSelection();
    createPanel.style.display = 'none';

    var q = input.value.trim();
    if (!q){ close(); return; }

    var list = await searchVenues(q);
    render(list, q);
  });

  input.addEventListener('focus', async function(){
    var q = input.value.trim();
    if (!q) return;
    var list = await searchVenues(q);
    render(list, q);
  });

  // changing the date invalidates approval
  if (dateInput){
    dateInput.addEventListener('change', function(){
      if (requireApproval) input.dataset.venueApproved = '';
      if (selectedVenue) renderDetails();
    });
  }

  document.addEventListener('click', function(e){
    if (!pop.contains(e.target) && e.target !== input) close();
  });
}


  // --- Upload helper ---
  async function uploadPoster(file){
    var form = new FormData();
    form.append('file', file);
    const res = await fetch('/admin/uploads', {
      method:'POST',
      body: form,
      credentials:'include'
    });
    const txt = await res.text();
    if (!res.ok) throw new Error(txt || ('HTTP ' + res.status));
    const data = txt ? JSON.parse(txt) : {};
    if (!data.ok || !data.url) throw new Error('Unexpected upload response');
    return data;
  }

  function editorToolbarHtml(){
    return ''
      +'<div class="row" style="gap:6px;margin-bottom:6px">'
      +  '<button type="button" class="btn" data-cmd="bold">B</button>'
      +  '<button type="button" class="btn" data-cmd="italic"><span style="font-style:italic">I</span></button>'
      +  '<button type="button" class="btn" data-cmd="underline"><span style="text-decoration:underline">U</span></button>'
      +  '<button type="button" class="btn" data-cmd="insertUnorderedList">• List</button>'
      +  '<button type="button" class="btn" data-cmd="insertOrderedList">1. List</button>'
      +'</div>';
  }

  function bindWysiwyg(root){
    if (!root) return;
    root.querySelectorAll('[data-cmd]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var cmd = btn.getAttribute('data-cmd') || '';
        if (cmd) document.execCommand(cmd);
      });
    });
  }

  // --- Create Show (AI) shared refs ---
// addFiles() can be called from event handlers, so keep refs in shared scope.
var drop, fileInput, list, btn, err, status, result, state;


 async function createShowAI(){
  if (!main) return;

  main.innerHTML =
    '<div class="card">'
  +   '<div class="title">Create Show (AI)</div>'
  +   '<div class="muted" style="margin-top:6px; line-height:1.4">'
  +     'Drop your show assets here (event copy, briefs, PDFs/DOCX, and artwork). '
  +     'We’ll extract key details and pre-fill the Create Show form for you to review and approve.'
  +   '</div>'

  +   '<div id="ai_drop" class="drop" style="margin-top:14px; padding:18px; min-height:120px;">'
  +     '<div style="font-weight:600">Drop files here or click to upload</div>'
  +     '<div class="muted" style="margin-top:4px">Supports: PDF, DOC/DOCX, TXT/MD, and images (JPG/PNG/WebP)</div>'
  +   '</div>'
  +   '<input id="ai_files" type="file" multiple '
  +     'accept=".pdf,.doc,.docx,.txt,.md,image/*" style="display:none" />'

  +   '<div id="ai_list" style="margin-top:12px;"></div>'

  +   '<div class="row" style="margin-top:12px; gap:10px; align-items:center; justify-content:flex-end;">'
+     '<div id="ai_status" class="muted" style="flex:1; font-size:15px; font-weight:700;"></div>'
  +     '<button id="ai_analyse" class="btn p">Analyse &amp; Pre-fill</button>'
  +   '</div>'

  +   '<div id="ai_err" class="error" style="margin-top:10px;"></div>'
  +   '<div id="ai_result" style="margin-top:14px;"></div>'

  + '</div>';

   drop = $('#ai_drop');
  fileInput = $('#ai_files');
  list = $('#ai_list');
  btn = $('#ai_analyse');
  err = $('#ai_err');
  status = $('#ai_status');
  result = $('#ai_result');

  // Rotating status messages while analysing

  const analysingMessages = [
    'TixAll is doing its magic…',
    'TixAll AI is building your event page…',
    'Extracting key details from your files…',
    'Picking the best artwork + layout…',
    'Almost there — preparing your draft…'
  ];

  let analysingTimer = null;

  function startAnalysingStatus(){
    stopAnalysingStatus();
    let i = 0;
    status.textContent = analysingMessages[i];
    analysingTimer = setInterval(function(){
      i = (i + 1) % analysingMessages.length;
      status.textContent = analysingMessages[i];
    }, 5000);
  }

  function stopAnalysingStatus(){
    if (analysingTimer){
      clearInterval(analysingTimer);
      analysingTimer = null;
    }
  }

   state = {

    images: [], // { file, name, type, size, url, w, h, ratio, diff, tooBig }

    docs: [],   // { file, name, type, size, dataUrl, tooBig }

  };

  // --- Oversize UX helpers (13MB cap message + auto-clear when resolved) ---
  const OVERSIZE_MSG = 'File size is too big, please upload a file under 13MB in size.';

  function hasOversizeFiles(){
    return (state.images || []).some(f => f && f.tooBig) || (state.docs || []).some(f => f && f.tooBig);
  }

  function showOversizeError(){
    if (err) err.textContent = OVERSIZE_MSG;
  }

  function clearOversizeErrorIfResolved(){
    // Only clear OUR oversize message (don’t wipe other errors)
    if (!err) return;
    if (!hasOversizeFiles() && err.textContent === OVERSIZE_MSG){
      err.textContent = '';
    }
  }



  function bytes(n){
    if (!n && n !== 0) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024*1024) return (n/1024).toFixed(1) + ' KB';
    return (n/(1024*1024)).toFixed(1) + ' MB';
  }

  function esc(s){
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function renderList(){
  const imgRows = state.images.map((f, idx) => ({
    kind: 'Image',
    kindKey: 'image',
    idx,
    name: f.name,
    size: f.size,
    bad: !!f.tooBig,
    extra: f.tooBig ? 'File too big' : (f.url ? 'Uploaded' : 'Pending upload')
  }));

  const docRows = state.docs.map((f, idx) => ({
    kind: 'Doc',
    kindKey: 'doc',
    idx,
    name: f.name,
    size: f.size,
    bad: !!f.tooBig,
    extra: f.tooBig ? 'File too big' : (f.dataUrl ? 'Ready' : 'Pending read')
  }));

  const rows = imgRows.concat(docRows);

    if (!rows.length){

    list.innerHTML = '<div class="muted">No files added yet.</div>';

    // If the only error showing was the oversize message, clear it now the file is gone
    clearOversizeErrorIfResolved();

    return;

  }

  list.innerHTML =
    '<div style="border:1px solid var(--border); border-radius:10px; overflow:hidden;">'
  +   '<div style="display:grid; grid-template-columns: 110px 1fr 90px 120px 52px; gap:10px; padding:10px 12px; background:#f8fafc; font-weight:600; font-size:12px; align-items:center;">'
  +     '<div>Type</div><div>File</div><div>Size</div><div>Status</div><div></div>'
  +   '</div>'
  +   rows.map(r =>
        '<div style="display:grid; grid-template-columns: 110px 1fr 90px 120px 52px; gap:10px; padding:10px 12px; border-top:1px solid var(--border); font-size:13px; align-items:center;">'
      +   '<div>'+esc(r.kind)+'</div>'
      +   '<div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;'
      +     (r.bad ? 'color:#b91c1c; font-weight:700;' : '')
      +   '">'+esc(r.name)+'</div>'
      +   '<div>'+esc(bytes(r.size))+'</div>'
      +   '<div class="muted">'+esc(r.extra)+'</div>'
      +   '<div style="text-align:right;">'
      +     '<button'
      +       ' type="button"'
      +       ' class="btn"'
      +       ' title="Remove"'
      +       ' aria-label="Remove '+esc(r.name)+'"'
      +       ' data-remove-kind="'+esc(r.kindKey)+'"'
      +       ' data-remove-idx="'+String(r.idx)+'"'
      +       ' style="padding:6px 10px; line-height:1; font-size:14px;">'
      +       '🗑️'
      +     '</button>'
      +   '</div>'
      + '</div>'
    ).join('')
  + '</div>';

  // Remove handlers
  // Remove handlers
  $$('.btn[data-remove-kind]', list).forEach(function(btn){
    btn.addEventListener('click', function(){
      const kind = btn.getAttribute('data-remove-kind');
      const idx = Number(btn.getAttribute('data-remove-idx'));

      if (!Number.isFinite(idx) || idx < 0) return;

      if (kind === 'image' && idx < state.images.length) state.images.splice(idx, 1);
      if (kind === 'doc' && idx < state.docs.length) state.docs.splice(idx, 1);

      renderList();

      // ✅ Remove the oversize banner ONLY if no oversize files remain
      clearOversizeErrorIfResolved();
    });
  });
}

  function readAsDataURL(file){
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ''));
      fr.onerror = () => reject(fr.error || new Error('Failed to read file'));
      fr.readAsDataURL(file);
    });
  }

    function isLikelySquareName(name){
    const n = String(name || '').toLowerCase();
    return n.includes('sq') || n.includes('square') || n.includes('insta');
  }

  function isLikelyBannerName(name){
    const n = String(name || '').toLowerCase();
    return n.includes('banner') || n.includes('header') || n.includes('web');
  }

  function isLikelyPosterName(name){
    const n = String(name || '').toLowerCase();
    return n.includes('poster') || n.includes('artwork') || n.includes('a3') || n.includes('print');
  }

  async function getImageMeta(url){
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = function(){
        const w = img.naturalWidth || 0;
        const h = img.naturalHeight || 0;
        const ratio = h ? (w / h) : 0;
        // 2:3 portrait target ratio = 0.666...
        const target = 3/2;
        const diff = Math.abs(ratio - target);
        resolve({ w, h, ratio, diff });
      };
      img.onerror = () => resolve({ w:0,h:0,ratio:0,diff:999 });
      img.src = url;
    });
  }

  function scoreForMainPoster(item){
    // Lower is better
    const diff = item && typeof item.diff === 'number' ? item.diff : 999;
    let penalty = 0;

    if (isLikelySquareName(item.name)) penalty += 0.75;
    if (isLikelyBannerName(item.name)) penalty += 0.6;
    if (isLikelyPosterName(item.name)) penalty -= 0.25;

    // Prefer higher resolution when diff is similar
    const px = (item.w || 0) * (item.h || 0);
    const resBonus = px > 0 ? (1 / Math.log10(px + 10)) : 1;

    return diff + penalty + resBonus;
  }

  function pickBestMainPoster(images){
    if (!Array.isArray(images) || !images.length) return null;
    const scored = images
      .filter(x => x && x.url)
      .map(x => ({ ...x, _score: scoreForMainPoster(x) }))
      .sort((a,b) => a._score - b._score);
    return scored[0] || null;
  }


   async function addFiles(fileList){

    // If the view hasn't initialised properly yet, fail silently rather than crashing the whole UI
    if (!err || !status || !state) return;

    err.textContent = '';
    status.textContent = '';

    const MAX_BYTES = 13 * 1024 * 1024; // 13MB

    const files = Array.from(fileList || []);
    if (!files.length) return;

    // Split into images vs docs
    const imgs = files.filter(f => (f.type || '').startsWith('image/'));
    const docs = files.filter(f => !(f.type || '').startsWith('image/'));

    // Upload images immediately (re-uses your existing /admin/uploads endpoint)
    for (const f of imgs){
      const tooBig = (f.size || 0) > MAX_BYTES;

      const item = {
        file: f,
        name: f.name,
        type: f.type,
        size: f.size,
        url: '',
        w:0, h:0, ratio:0, diff:999,
        tooBig
      };

      state.images.push(item);
      renderList();

           if (tooBig){

        showOversizeError();

        continue;

      }


      try{
        status.textContent = 'Uploading images…';
        const out = await uploadPoster(f);
        item.url = out.url;
        renderList();

        // capture real image dimensions for poster selection + send to AI
        const meta = await getImageMeta(item.url);
        item.w = meta.w; item.h = meta.h; item.ratio = meta.ratio; item.diff = meta.diff;
        renderList();

          }catch(e){

        const msg = String(e && e.message ? e.message : e).toLowerCase();

        // If backend rejected the file (often shows as 413 / too large / "upload error"),
        // treat it as oversize so the row turns red + message is friendly.
        if (msg.includes('413') || msg.includes('too large') || msg.includes('file too big') || msg.includes('upload error')){
          item.tooBig = true;
          renderList();
          showOversizeError();
        } else {
          // Don’t print raw JSON back to the organiser
          err.textContent = 'Image upload failed for "' + f.name + '".';
        }

      }
    }

    // Read docs as data URLs (sent to server for AI extraction)
    for (const f of docs){
      const tooBig = (f.size || 0) > MAX_BYTES;

      const item = {
        file: f,
        name: f.name,
        type: f.type,
        size: f.size,
        dataUrl: '',
        tooBig
      };

      state.docs.push(item);
      renderList();

          if (tooBig){

        showOversizeError();

        continue;

      }

      try{
        status.textContent = 'Reading documents…';
        item.dataUrl = await readAsDataURL(f);
        renderList();
      }catch(e){
        err.textContent = 'Document read failed for "' + f.name + '": ' + (e.message || e);
      }
    }

    status.textContent = '';
  }

  // Dropzone bindings
  drop.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length) addFiles(fileInput.files);
    fileInput.value = '';
  });

  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.style.borderColor = '#64748b'; });
  drop.addEventListener('dragleave', () => { drop.style.borderColor = ''; });
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.style.borderColor = '';
    if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
  });

  renderList();

  // Analyse button → call backend AI extractor → store draft → send user to Create Show
  btn.addEventListener('click', async () => {
    err.textContent = '';
    result.innerHTML = '';
    status.textContent = '';

    if (!state.images.length && !state.docs.length){
      err.textContent = 'Please add at least one document or image.';
      return;
    }

  btn.disabled = true;
btn.textContent = 'Analysing…';
startAnalysingStatus();
try{
           const best = pickBestMainPoster(state.images);

      const payload = {
        images: state.images
          .filter(x => x.url)
          .map(x => ({
            name: x.name,
            url: x.url,
            width: x.w || null,
            height: x.h || null,
            ratio: x.ratio || null,
            // hinting only (AI still decides)
            likelyPoster: isLikelyPosterName(x.name),
            likelySquare: isLikelySquareName(x.name),
            likelyBanner: isLikelyBannerName(x.name),
          })),
        docs: state.docs
          .filter(x => x.dataUrl)
          .map(x => ({ name: x.name, type: x.type, dataUrl: x.dataUrl })),

        // strong hint for main poster choice
        suggestedMainImageUrl: best ? best.url : null
      };

      const res = await fetch('/admin/ai/extract-show', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const txt = await res.text();
      if (!res.ok) throw new Error(txt || ('HTTP ' + res.status));
      const data = txt ? JSON.parse(txt) : {};
      if (!data.ok || !data.draft) throw new Error('Unexpected AI response');

      const draft = data.draft;
stopAnalysingStatus();
status.textContent = '';

      // Show a quick preview
      result.innerHTML =
        '<div style="border:1px solid var(--border); border-radius:12px; padding:12px;">'
      +   '<div style="font-weight:700; margin-bottom:8px;">AI draft ready</div>'
      +   '<div class="muted" style="margin-bottom:10px;">Review the Create Show form next, edit anything needed, then approve.</div>'
      +   '<div style="font-size:13px; line-height:1.5;">'
      +     '<div><b>Title:</b> ' + esc(draft.title || '') + '</div>'
      +     '<div><b>Start:</b> ' + esc(draft.startDateTime || '') + '</div>'
      +     '<div><b>End:</b> ' + esc(draft.endDateTime || '') + '</div>'
      +     '<div><b>Venue:</b> ' + esc(draft.venueName || '') + '</div>'
      +     '<div><b>Type / Category:</b> ' + esc(draft.eventType || '') + ' / ' + esc(draft.category || '') + '</div>'
      +   '</div>'
      +   '<div class="row" style="margin-top:12px; gap:10px;">'
      +     '<button id="ai_apply" class="btn p">Open Create Show with this draft</button>'
      +   '</div>'
      + '</div>';

      $('#ai_apply').addEventListener('click', () => {
        // Store draft for Create Show to consume
        sessionStorage.setItem('aiShowDraft', JSON.stringify(draft));
        // Navigate to existing Create Show page
        history.pushState({}, '', '/admin/ui/shows/create');
        route();
      });

      status.textContent = '';
    }catch(e){
      err.textContent = 'AI analyse failed: ' + (e.message || e);
      status.textContent = '';
  }finally{
  stopAnalysingStatus();
  btn.disabled = false;
  btn.textContent = 'Analyse & Pre-fill';
}
  });
}

async function createShow(){
    if (!main) return;
    
    // --- New Look: White background for main content area ---
    // Change the root variable in <style> to make the content area white (if not already done globally).
    // The default --bg is #f7f8fb, but we want a cleaner white form area. 
    // We will ensure the main wrapper background is white for a modern look.
    // The .card background is already white (var(--panel):#ffffff), so we mostly update the structure.

    main.innerHTML =
        '<div class="card" style="padding: 24px;">' // Increased padding for more whitespace
        +'<div class="header" style="margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 16px;">'
        +'<div>'
        +'<div class="title" style="font-size: 1.5rem; font-weight: 700;">Create New Event</div>'
        +'<div class="muted">Start setting up your event with core details, categories, and artwork.</div>'
        +'</div>'
        +'</div>'
        
        // Use a single, wider grid column structure for better readability
        +'<div class="grid" style="gap: 20px;">' 
        
        // --- COL 1: Core Details, Category, Venue ---
        +'<div style="flex: 1; padding-right: 20px; border-right: 1px solid var(--border);">'

        // Title
        +'<div class="grid" style="margin-bottom: 20px;">'
        +'<label>Event Title</label>'
+'<input id="sh_title" class="ctl" />'
        +'</div>'

        // Date & Time
       +'<div class="grid" style="margin-bottom: 20px;">'
+'<label>Date & Time</label>'
+'<input id="sh_dt" type="datetime-local" class="ctl" />'
+'</div>'

+'<div class="grid" style="margin-bottom: 20px;">'
+'<label>End Date & Time</label>'
+'<input id="sh_dt_end" type="datetime-local" class="ctl" />'
+'<div class="tip">Optional. Add if you know when the event ends.</div>'
+'</div>'

+'<div class="grid" style="margin-bottom: 20px;">'
+'<label>Venue</label>'
+'<input id="venue_input" class="ctl" placeholder="Start typing a venue…" />'
+'<div class="tip">Pick an existing venue or create a new one.</div>'
+'</div>'

        
// --- NEW: Category and Sub-Category Section ---
+'<div class="grid grid-2" style="margin-bottom: 20px; gap: 16px; align-items: start;">'
  +'<div class="grid" style="gap:4px;">'
    +'<label>Event Type</label>'
    +'<select id="event_type_select" class="ctl">'
      +'<option value="">Select Primary Type</option>'
      +'<option value="comedy">Comedy</option>'
      +'<option value="theatre">Theatre</option>'
      +'<option value="music">Music & Concerts</option>'
      +'<option value="festival">Festivals</option>'
      +'<option value="film">Film & Screenings</option>'
      +'<option value="talks">Talks, Panels & Podcasts</option>'
      +'<option value="workshop">Classes & Workshops</option>'
      +'<option value="corporate">Corporate & Private Events</option>'
      +'<option value="nightlife">Nightlife & Social</option>'
      +'<option value="sport">Sports & Fitness</option>'
      +'<option value="food">Food & Drink</option>'
      +'<option value="community">Community & Charity</option>'
      +'<option value="arts">Arts, Exhibitions & Culture</option>'
      +'<option value="other">Other</option>'
    +'</select>'
  +'</div>'
  +'<div class="grid" style="gap:4px;">'
    +'<label>Category</label>'
+'<select id="event_category_select" class="ctl" disabled>'
      +'<option value="">Select Sub-Category</option>'

      // Original set
      +'<option data-parent="music" value="rock">Rock & Pop</option>'
      +'<option data-parent="music" value="classical">Classical</option>'
      +'<option data-parent="music" value="jazz">Jazz / Blues</option>'
      +'<option data-parent="comedy" value="standup">Stand-Up Comedy</option>'
      +'<option data-parent="comedy" value="improv">Improv / Sketch</option>'
      +'<option data-parent="arts" value="theatre">Theatre / Play</option>'
      +'<option data-parent="arts" value="dance">Dance</option>'
      +'<option data-parent="sport" value="football">Football / Soccer</option>'
      +'<option data-parent="sport" value="running">Running / Marathon</option>'
      +'<option data-parent="conference" value="tech">Tech & IT</option>'
      +'<option data-parent="conference" value="business">Business & Finance</option>'
      +'<option data-parent="family" value="show">Kids Show</option>'
      +'<option data-parent="family" value="activity">Family Activity</option>'
      +'<option data-parent="food" value="festival">Food Festival</option>'
      +'<option data-parent="food" value="tasting">Tasting / Tour</option>'

      // Theatre
      +'<option data-parent="theatre" value="play_drama">Play / Drama</option>'
      +'<option data-parent="theatre" value="panto">Panto</option>'
      +'<option data-parent="theatre" value="musical">Musical Theatre</option>'
      +'<option data-parent="theatre" value="dance">Dance</option>'
      +'<option data-parent="theatre" value="opera">Opera</option>'
      +'<option data-parent="theatre" value="cabaret">Cabaret & Variety</option>'

      // Festivals
      +'<option data-parent="festival" value="comedy_festival">Comedy Festival</option>'
      +'<option data-parent="festival" value="music_festival">Music Festival</option>'
      +'<option data-parent="festival" value="arts_festival">Arts Festival</option>'
      +'<option data-parent="festival" value="food_festival">Food Festival</option>'

      // Film
      +'<option data-parent="film" value="cinema_screening">Cinema Screening</option>'
      +'<option data-parent="film" value="premiere">Premiere</option>'
      +'<option data-parent="film" value="q_and_a">Screening + Q&amp;A</option>'

      // Talks / Panels / Podcasts
      +'<option data-parent="talks" value="live_podcast">Live Podcast</option>'
      +'<option data-parent="talks" value="panel">Panel Discussion</option>'
      +'<option data-parent="talks" value="talk">Talk / Lecture</option>'
      +'<option data-parent="talks" value="book_event">Book Talk / Signing</option>'

      // Corporate / Private
      +'<option data-parent="corporate" value="corporate_night">Corporate Night</option>'
      +'<option data-parent="corporate" value="private_party">Private Party</option>'
      +'<option data-parent="corporate" value="awards">Awards Night</option>'
      +'<option data-parent="corporate" value="fundraiser">Fundraiser</option>'

      // Comedy (extra)
      +'<option data-parent="comedy" value="club_night">Comedy Club Night</option>'
      +'<option data-parent="comedy" value="tour_show">Stand-up Tour Show</option>'
      +'<option data-parent="comedy" value="new_material">New Material Night</option>'
      +'<option data-parent="comedy" value="edinburgh_preview">Edinburgh Preview</option>'
      +'<option data-parent="comedy" value="tv_warmup">TV Warm-up</option>'
      +'<option data-parent="comedy" value="roast_battle">Roast / Battle</option>'

      // Other
      +'<option data-parent="other" value="misc">Miscellaneous</option>'

 +'</select>'
    +'<div class="tip">The list will filter based on Event Type.</div>'
  +'</div>'
+'</div>' // End grid-2

// --- NEW: Doors Open + Age Guidance ---
+'<div class="grid grid-2" style="margin-bottom: 20px; gap: 16px;">'
  +'<div class="grid" style="gap:4px;">'
    +'<label>Doors Open Time</label>'
    +'<input id="doors_open_time" class="ctl" type="time" />'
    +'<div class="tip">Separate from show start time.</div>'
  +'</div>'
  +'<div class="grid" style="gap:4px;">'
+'<label>Age Guidance</label>'
+'<input id="age_guidance" class="ctl" placeholder="e.g. 14+ (minimum age)" />'
+'<div class="tip">Helps reduce customer queries/refunds.</div>'
  +'</div>'
+'</div>'

// --- NEW: End Time / Duration ---
+'<div class="grid" style="margin-bottom: 20px;">'
+'</div>'

// --- NEW: Accessibility ---
+'<div class="grid" style="margin-bottom: 20px;">'
  +'<label>Accessibility</label>'
  +'<div style="border:1px solid var(--border); border-radius:8px; padding:12px; background:#fff;">'
    +'<div class="grid grid-2" style="gap:10px; margin-bottom: 10px;">'
      +'<label style="display:flex; align-items:center; gap:8px; font-weight:500;">'
        +'<input id="acc_wheelchair" type="checkbox" />Wheelchair spaces'
      +'</label>'
      +'<label style="display:flex; align-items:center; gap:8px; font-weight:500;">'
        +'<input id="acc_stepfree" type="checkbox" />Step-free access'
      +'</label>'
      +'<label style="display:flex; align-items:center; gap:8px; font-weight:500;">'
        +'<input id="acc_hearingloop" type="checkbox" />Hearing loop'
      +'</label>'
      +'<label style="display:flex; align-items:center; gap:8px; font-weight:500;">'
        +'<input id="acc_toilet" type="checkbox" />Accessible toilet'
      +'</label>'
    +'</div>'
    +'<div class="grid" style="gap:4px;">'
      +'<label style="font-size:12px; color:#64748b; font-weight:600;">More info (optional)</label>'
      +'<input id="acc_more" class="ctl" placeholder="e.g. Contact venue for access requirements" />'
    +'</div>'
  +'</div>'
+'</div>'

// --- NEW: Tags / Keywords ---
+'<div class="grid" style="margin-bottom: 20px;">'
  +'<label>Tags / Keywords</label>'
  +'<input id="tags" class="ctl" placeholder="Comma-separated (e.g. stand-up, tour, friday, cheltenham)" />'
  +'<div class="tip">Improves internal search and future recommendations.</div>'
+'</div>'





        // Description
        +'<div class="grid" style="margin-bottom: 20px;">'
        +'<label>Description (mandatory)</label>'
        + editorToolbarHtml()
        +'<div id="desc" data-editor contenteditable="true" '
        +'style="min-height:150px; border:1px solid var(--border); border-radius:8px; padding:12px; background: #fff;"></div>'
        +'<div class="muted">Write a compelling description for your attendees.</div>'
        +'</div>'
        
        +'</div>' // End COL 1

        // --- COL 2: Image Uploads ---
        +'<div style="flex: 1;">'

        // Backup / External ticket link
        +'<div class="grid" style="margin-bottom: 24px; background: #f8fafc; padding: 16px; border-radius: 10px; border: 1px solid var(--border);">'
        +'<label style="font-size: 14px; font-weight: 600;">Backup / External ticket link</label>'
        +'<input id="external_ticket_url" class="ctl" type="url" placeholder="https://tickets.example.com/show" />'
        +'<div class="tip">Optional. If set, we can publish using this link or redirect once tickets sell out.</div>'
        +'</div>'
        
        // Main Poster Image
        +'<div class="grid" style="margin-bottom: 24px; background: #f9fafb; padding: 16px; border-radius: 10px; border: 1px solid var(--border);">'
        +'<label style="font-size: 14px; font-weight: 600;">Main Poster Image (Required)</label>'
        +'<div id="drop_main" class="drop" style="min-height: 120px; border-style: solid; border-color: #94a3b8; background: #fff;">'
        +'<p style="margin: 0; font-weight: 500;">Drop image here or click to upload</p>'
        +'<p class="muted" style="margin-top: 4px; font-size: 12px;">Recommended: High-resolution, Aspect Ratio 2:3</p>'
        +'</div>'
        +'<input id="file_main" type="file" accept="image/*" style="display:none" />'
        +'<div class="progress" style="margin-top:8px"><div id="bar_main" class="bar"></div></div>'
        +'<img id="prev_main" class="imgprev" alt="Main Poster Preview" style="max-height: 200px; display: none;" />'
        +'</div>'
        
        // Additional Images (up to 10)
        +'<div class="grid" style="margin-bottom: 24px;">'
        +'<label style="font-size: 14px; font-weight: 600;">Additional Images (Max 10)</label>'
        +'<div id="additional_images_container" style="display: flex; flex-wrap: wrap; gap: 8px; border: 1px solid var(--border); border-radius: 8px; padding: 12px; background: #ffffff;">'
        // Upload button for additional images
        +'<div id="drop_add" class="drop" style="width: 100px; height: 100px; padding: 0; line-height: 100px; margin: 0; font-size: 24px; border: 2px dashed #94a3b8; color: #475569;">+</div>'
        +'<input id="file_add" type="file" accept="image/*" multiple style="display:none" />'
        // Image previews will be appended here
        +'<div id="add_previews" style="display: flex; flex-wrap: wrap; gap: 8px;"></div>'
        +'</div>'
        +'<div class="progress" style="margin-top:8px"><div id="bar_add" class="bar"></div></div>'
        +'<div class="tip">Upload photos of the venue, performers, or past events.</div>'
        +'</div>'

        // Placeholder to display all uploaded image URLs for submission (hidden)
        +'<input type="hidden" id="all_image_urls" value="" />'

        +'</div>' // End COL 2
        
        +'</div>' // End main grid

        // --- Action Button ---
        +'<div class="row" style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border); justify-content: space-between; align-items:center;">'
+  '<label id="ai_approval_wrap" style="display:none; align-items:center; gap:10px;; font-size:13px; color:#334155;">'
+    '<input id="ai_approval" type="checkbox" />'
+    'I’ve checked the AI-filled details (blue borders) and I’m happy to proceed.'
+  '</label>'

+  '<div class="row" style="gap:10px; align-items:center; position:relative;">'
+    '<button id="save" class="btn p" style="padding: 10px 20px; font-size: 16px;">Save Show and Add Unallocated Seating</button>'
+    '<button id="save_dd_btn" class="btn" type="button" aria-label="Change next step" style="padding: 10px 12px; font-size: 16px; width: 44px;">▾</button>'

+    '<div id="save_dd" style="display:none; position:absolute; right:0; top:44px; background:#fff; border:1px solid var(--border); border-radius:12px; box-shadow: var(--shadow); overflow:hidden; min-width:320px; z-index:50;">'
+      '<button type="button" data-mode="UNALLOCATED" class="btn" style="width:100%; justify-content:flex-start; border:0; border-bottom:1px solid var(--border); border-radius:0; padding:12px 14px;">Save Show and Add Unallocated Seating</button>'
+      '<button type="button" data-mode="ALLOCATED" class="btn" style="width:100%; justify-content:flex-start; border:0; border-radius:0; padding:12px 14px;">Save Show and Add Allocated Seating</button>'
+      '<button type="button" data-mode="EXTERNAL" id="save_dd_external" class="btn" style="width:100%; justify-content:flex-start; border:0; border-top:1px solid var(--border); border-radius:0; padding:12px 14px; display:none;">Publish show using backup / external ticket link</button>'
+    '</div>'

+    '<div id="err" class="error"></div>'
+  '</div>'
+'</div>'


        +'</div>';
    
    // Bind editor and venue picker
    bindWysiwyg(main);
mountVenuePicker($('#venue_input'), $('#sh_dt'), { requireApproval: true });

    // --- Category Filtering Logic ---
   const eventTypeSelect = $('#event_type_select');
const categorySelect = $('#event_category_select');
const externalTicketInput = $('#external_ticket_url');
const externalSaveOption = $('#save_dd_external');

const existingShowId = (() => {
  try { return new URLSearchParams(window.location.search).get('showId') || ''; }
  catch { return ''; }
})();


// Cache ALL sub-category options once (from the original HTML)
const allCategoryOptions = Array.from(categorySelect.querySelectorAll('option[data-parent]'));

function updateCategoryOptions() {
  const selectedType = (eventTypeSelect && eventTypeSelect.value) ? eventTypeSelect.value : '';

  // Always reset
  categorySelect.innerHTML = '<option value="">Select Sub-Category</option>';

  // Disable until Event Type chosen
  if (!selectedType) {
    categorySelect.disabled = true;
    categorySelect.value = '';
    return;
  }

  // Enable + populate only matching options
  categorySelect.disabled = false;

  allCategoryOptions.forEach(function(opt){
    if (opt.getAttribute('data-parent') === selectedType) {
      categorySelect.appendChild(opt.cloneNode(true));
    }
  });

  categorySelect.value = '';
}

eventTypeSelect.addEventListener('change', updateCategoryOptions);
updateCategoryOptions();


    // --- Image Upload Logic (Updated for Main & Additional Images) ---
    var dropMain = $('#drop_main');
    var fileMain = $('#file_main');
    var barMain = $('#bar_main');
    var prevMain = $('#prev_main');

    var dropAdd = $('#drop_add');
    var fileAdd = $('#file_add');
    var barAdd = $('#bar_add');
    var addPreviews = $('#add_previews');
    var allImageUrls = $('#all_image_urls');
    
    // Upload function for a single file (used for main image and each additional image)
    async function doUpload(file, barEl, previewEl, isAdditional = false) {
        $('#err').textContent = '';
        barEl.style.width = '15%';

        try {
            var out = await uploadPoster(file); // Reusing existing uploadPoster API

            if (isAdditional) {
                // Add new preview element and update hidden field
                var imgContainer = document.createElement('div');
                imgContainer.style.position = 'relative';
                imgContainer.style.width = '100px';
                imgContainer.style.height = '100px';
                imgContainer.style.overflow = 'hidden';
                imgContainer.style.borderRadius = '6px';
                imgContainer.dataset.url = out.url;

                var img = document.createElement('img');
                img.src = out.url;
                img.alt = 'Additional Image';
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';

                var deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'x';
                deleteBtn.className = 'btn';
                deleteBtn.style.position = 'absolute';
                deleteBtn.style.top = '4px';
                deleteBtn.style.right = '4px';
                deleteBtn.style.width = '24px';
                deleteBtn.style.height = '24px';
                deleteBtn.style.padding = '0';
                deleteBtn.style.borderRadius = '50%';
                deleteBtn.style.lineHeight = '24px';
                deleteBtn.style.fontSize = '12px';
                deleteBtn.style.fontWeight = 'bold';
                deleteBtn.style.background = 'rgba(255, 255, 255, 0.8)';
                deleteBtn.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                deleteBtn.style.cursor = 'pointer';

                deleteBtn.addEventListener('click', function() {
                    imgContainer.remove();
                    updateAllImageUrls();
                });

                imgContainer.appendChild(img);
                imgContainer.appendChild(deleteBtn);
                addPreviews.appendChild(imgContainer);

                updateAllImageUrls();
            } else {
                // Update main image preview
                previewEl.src = out.url;
                previewEl.style.display = 'block';
            }

            barEl.style.width = '100%';
            setTimeout(function() { barEl.style.width = '0%'; }, 800);
            return out.url;
        } catch (e) {
            barEl.style.width = '0%';
            $('#err').textContent = 'Upload failed: ' + (e.message || e);
            throw e; // Re-throw to be caught by the calling function if needed
        }
    }

    // Helper to update the hidden field with all additional image URLs
    function updateAllImageUrls() {
        const urls = $$('#add_previews > div').map(el => el.dataset.url);
        allImageUrls.value = JSON.stringify(urls);
        // Hide/show the drop button if at the 10 image limit
        if (urls.length >= 10) {
            dropAdd.style.display = 'none';
        } else {
            dropAdd.style.display = 'block';
        }
    }

        // --- AI Prefill (one-time) ---
    (function applyAiDraftIfPresent(){
        try{
            var raw = sessionStorage.getItem('aiShowDraft');
            if (!raw) return;

            // One-time consume
            sessionStorage.removeItem('aiShowDraft');

            var draft = JSON.parse(raw || '{}') || {};

            function isoToLocalInput(iso){
                if (!iso) return '';
                var d = new Date(iso);
                if (isNaN(d.getTime())) return '';
                // yyyy-MM-ddTHH:mm
                var pad = (n) => String(n).padStart(2,'0');
                return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate())
                  + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
            }

                        // Flag that this page is AI-filled
            window.__aiPrefill = true;

            // Show approval UI + change button wording
            var aiWrap = $('#ai_approval_wrap');
            if (aiWrap) aiWrap.style.display = 'flex';

            var saveBtn = $('#save');
            if (saveBtn){
              saveBtn.textContent = 'I’ve checked the AI-filled details — Save and add tickets';
            }

            // Bind clear-on-edit for key fields
            bindAiClearOnUserEdit($('#sh_title'));
            bindAiClearOnUserEdit($('#sh_dt'));
            bindAiClearOnUserEdit($('#sh_dt_end'));
            bindAiClearOnUserEdit($('#doors_open_time'));
            bindAiClearOnUserEdit($('#age_guidance'));
            bindAiClearOnUserEdit($('#tags'));
            bindAiClearOnUserEdit(eventTypeSelect);
            bindAiClearOnUserEdit(categorySelect);

            // Contenteditable description
            bindAiClearOnUserEdit($('#desc'), ['input','blur','keyup']);

            // Drops
            bindAiClearOnUserEdit($('#drop_main'), ['click','drop']);
            bindAiClearOnUserEdit($('#drop_add'), ['click']);

            // --- Title (AI) ---
            if (draft.title && $('#sh_title')){
              $('#sh_title').value = draft.title;
              markAi($('#sh_title'));
            }

            // --- Dates ---
            if (draft.startDateTime && $('#sh_dt')){
              $('#sh_dt').value = isoToLocalInput(draft.startDateTime);
              markAi($('#sh_dt'));
            }
            if (draft.endDateTime && $('#sh_dt_end')){
              $('#sh_dt_end').value = isoToLocalInput(draft.endDateTime);
              markAi($('#sh_dt_end'));
            }

            // --- Doors / Age ---
            if (draft.doorsOpenTime && $('#doors_open_time')){
              $('#doors_open_time').value = String(draft.doorsOpenTime).slice(0,5);
              markAi($('#doors_open_time'));
            }
            if (draft.ageGuidance && $('#age_guidance')){
              $('#age_guidance').value = String(draft.ageGuidance);
              markAi($('#age_guidance'));
            }

            // --- Description: use doc text if provided by AI extractor ---
            if (draft.descriptionHtml && $('#desc')){
              $('#desc').innerHTML = draft.descriptionHtml;
              markAi($('#desc'), 'editor');
            }

            // --- Type + Category ---
            if (draft.eventType && eventTypeSelect){
              eventTypeSelect.value = draft.eventType;
              updateCategoryOptions();
              markAi(eventTypeSelect);
            }
            if (draft.category && categorySelect){
              categorySelect.value = draft.category;
              markAi(categorySelect);
            }

            // --- Tags (force showing 10, comma-separated) ---
            if (Array.isArray(draft.tags) && $('#tags')){
              $('#tags').value = draft.tags.filter(Boolean).slice(0,10).join(', ');
              markAi($('#tags'));
            }

            // --- Accessibility ---
            if (draft.accessibility){
              if ($('#acc_wheelchair')) { $('#acc_wheelchair').checked = !!draft.accessibility.wheelchair; markAi($('#acc_wheelchair')); }
              if ($('#acc_stepfree')) { $('#acc_stepfree').checked = !!draft.accessibility.stepFree; markAi($('#acc_stepfree')); }
              if ($('#acc_hearingloop')) { $('#acc_hearingloop').checked = !!draft.accessibility.hearingLoop; markAi($('#acc_hearingloop')); }
              if ($('#acc_toilet')) { $('#acc_toilet').checked = !!draft.accessibility.accessibleToilet; markAi($('#acc_toilet')); }
              if ($('#acc_more')) { $('#acc_more').value = (draft.accessibility.notes || ''); markAi($('#acc_more')); }
            }

            // --- Venue: attempt auto-select existing venue; else open create with address prefilled ---
            if ($('#venue_input')){
              var vin = $('#venue_input');
              bindAiClearOnUserEdit(vin);

              if (draft.venueName){
                vin.value = draft.venueName;
                markAi(vin);

                // If venue picker API is present, try to select best match
                if (vin._venuePicker && typeof searchVenues === 'function'){
                  (async function(){
                    var list = await searchVenues(draft.venueName);
                    if (Array.isArray(list) && list.length){
                      await vin._venuePicker.selectExisting(list[0]);
                      markAi(vin);
                    } else {
                      // No match found: open create venue panel prefilled with address
                      if (draft.venueAddress){
                        vin._venuePicker.openCreate(draft.venueName, draft.venueAddress);
                        markAi(vin);
                      } else {
                        // still force user to confirm manually
                        vin.dispatchEvent(new Event('input', { bubbles:true }));
                      }
                    }
                  })();
                } else {
                  vin.dispatchEvent(new Event('input', { bubbles:true }));
                }
              }
            }

            // --- Images ---
            if (draft.mainImageUrl && prevMain){
              prevMain.src = draft.mainImageUrl;
              prevMain.style.display = 'block';
              markAi($('#drop_main'), 'drop');
            }

            if (Array.isArray(draft.additionalImageUrls) && draft.additionalImageUrls.length && addPreviews){
              addPreviews.innerHTML = '';
              draft.additionalImageUrls.slice(0,10).forEach(function(url){
                var imgContainer = document.createElement('div');
                imgContainer.style.position = 'relative';
                imgContainer.style.width = '100px';
                imgContainer.style.height = '100px';
                imgContainer.style.overflow = 'hidden';
                imgContainer.style.borderRadius = '6px';
                imgContainer.dataset.url = url;

                var img = document.createElement('img');
                img.src = url;
                img.alt = 'Additional Image';
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';

                var deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'x';
                deleteBtn.className = 'btn';
                deleteBtn.style.position = 'absolute';
                deleteBtn.style.top = '4px';
                deleteBtn.style.right = '4px';
                deleteBtn.style.width = '24px';
                deleteBtn.style.height = '24px';
                deleteBtn.style.padding = '0';
                deleteBtn.style.borderRadius = '50%';
                deleteBtn.style.lineHeight = '24px';
                deleteBtn.style.fontSize = '12px';
                deleteBtn.style.fontWeight = 'bold';
                deleteBtn.style.background = 'rgba(255, 255, 255, 0.8)';
                deleteBtn.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                deleteBtn.style.cursor = 'pointer';

                deleteBtn.addEventListener('click', function() {
                  imgContainer.remove();
                  updateAllImageUrls();
                });

                imgContainer.appendChild(img);
                imgContainer.appendChild(deleteBtn);
                addPreviews.appendChild(imgContainer);
              });

              updateAllImageUrls();
              markAi($('#drop_add'), 'drop');
            }

        }catch(e){
            console.warn('[AI draft] apply failed', e);
        }
    })();



    // --- Main Image Event Listeners ---
    dropMain.addEventListener('click', function() { fileMain.click(); });
    dropMain.addEventListener('dragover', function(e) { e.preventDefault(); dropMain.classList.add('drag'); });
    dropMain.addEventListener('dragleave', function() { dropMain.classList.remove('drag'); });
    dropMain.addEventListener('drop', async function(e) {
        e.preventDefault();
        dropMain.classList.remove('drag');
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) await doUpload(f, barMain, prevMain);
    });
    fileMain.addEventListener('change', async function() {
        var f = fileMain.files && fileMain.files[0];
        if (f) await doUpload(f, barMain, prevMain);
    });

    // --- Additional Images Event Listeners ---
    dropAdd.addEventListener('click', function() { 
        // Only open file dialog if we haven't hit the limit
        if ($$('#add_previews > div').length < 10) {
            fileAdd.click(); 
        }
    });
    fileAdd.addEventListener('change', async function() {
        var files = fileAdd.files;
        if (files) {
            let currentCount = $$('#add_previews > div').length;
            let filesToUpload = Array.from(files).slice(0, 10 - currentCount);

            if (filesToUpload.length > 0) {
                // We show one progress bar for simplicity, as multiple simultaneous uploads can be complex
                barAdd.style.width = '15%'; 
                let uploadedCount = 0;
                let total = filesToUpload.length;

                for (const f of filesToUpload) {
                    try {
                        await doUpload(f, barAdd, null, true);
                        uploadedCount++;
                        barAdd.style.width = Math.round((uploadedCount / total) * 100) + '%';
                    } catch (e) {
                        // Error handling is inside doUpload
                    }
                }
                setTimeout(function() { barAdd.style.width = '0%'; }, 800);
            }
        }
        fileAdd.value = ''; // Reset file input so change event fires if the same file is selected again
    });

// --- Save Logic (Updated to remove ticket-specific fields and include new fields) ---

    // Seating mode chooser (defaults to UNALLOCATED)
    var saveMode = 'UNALLOCATED';

    function setSaveMode(mode){
      saveMode = (mode === 'ALLOCATED') ? 'ALLOCATED' : (mode === 'EXTERNAL' ? 'EXTERNAL' : 'UNALLOCATED');
      var saveBtn = $('#save');
      if (saveBtn){
        saveBtn.textContent = (saveMode === 'ALLOCATED')
          ? 'Save Show and Add Allocated Seating'
          : (saveMode === 'EXTERNAL')
            ? 'Publish show using backup / external ticket link'
            : 'Save Show and Add Unallocated Seating';
      }
    }
setSaveMode('UNALLOCATED');

    function externalTicketUrlValue(){
      return externalTicketInput ? externalTicketInput.value.trim() : '';
    }

    function updateExternalSaveOption(){
      if (!externalSaveOption) return;
      var hasUrl = !!externalTicketUrlValue();
      externalSaveOption.style.display = hasUrl ? 'block' : 'none';
      if (!hasUrl && saveMode === 'EXTERNAL') setSaveMode('UNALLOCATED');
    }

    if (externalTicketInput) {
      externalTicketInput.addEventListener('input', updateExternalSaveOption);
      externalTicketInput.addEventListener('blur', updateExternalSaveOption);
    }
    updateExternalSaveOption();

// If we were sent here from seating pages, we may have ?showId=... (edit mode)
if (existingShowId) {
  (async function () {
    try {
      const d = await j('/admin/shows/' + existingShowId);
      const s = (d && (d.item || d.show || d)) || null;
      if (!s) return;

      function isoToLocalInput(iso) {
        if (!iso) return '';
        const dt = new Date(iso);
        if (isNaN(dt.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        return (
          dt.getFullYear() + '-' +
          pad(dt.getMonth() + 1) + '-' +
          pad(dt.getDate()) + 'T' +
          pad(dt.getHours()) + ':' +
          pad(dt.getMinutes())
        );
      }

      // Core fields
      if ($('#sh_title')) $('#sh_title').value = s.title || '';
      if ($('#sh_dt')) $('#sh_dt').value = isoToLocalInput(s.date);
      if ($('#sh_dt_end')) $('#sh_dt_end').value = isoToLocalInput(s.endDate);

      // Venue (mark as approved so Save works without re-approving)
      const vIn = $('#venue_input');
      if (vIn) {
        vIn.value = s.venueText || '';
        if (s.venueId) vIn.dataset.venueId = s.venueId;
        vIn.dataset.venueApproved = '1';
      }
      if ($('#venueApproved')) $('#venueApproved').style.display = 'inline-flex';

      // Type / category
      if (eventTypeSelect) eventTypeSelect.value = s.eventType || '';
      updateCategoryOptions();
      if (categorySelect) categorySelect.value = s.eventCategory || '';

      // Other fields
      if ($('#doors_open_time')) $('#doors_open_time').value = s.doorsOpenTime || '';
      if ($('#age_guidance')) $('#age_guidance').value = s.ageGuidance || '';
      if ($('#end_time_note')) $('#end_time_note').value = s.endTimeNote || '';
      if (externalTicketInput) {
        externalTicketInput.value = s.externalTicketUrl || '';
      }

      // Tags
      if ($('#tags')) {
        const tagsVal = Array.isArray(s.tags) ? s.tags.join(', ') : (s.tags || '');
        $('#tags').value = tagsVal;
      }

      // Accessibility
      let acc = s.accessibility;
      try { if (typeof acc === 'string') acc = JSON.parse(acc); } catch {}
      if (acc && typeof acc === 'object') {
        const setChk = (id, val) => {
          const el = document.getElementById(id);
          if (el) el.checked = !!val;
        };
        setChk('acc_wheelchair', acc.wheelchair);
        setChk('acc_stepfree', acc.stepFree);
        setChk('acc_hearingloop', acc.hearingLoop);
        setChk('acc_toilet', acc.accessibleToilet);
        const more = document.getElementById('acc_more');
        if (more && acc.notes) more.value = String(acc.notes);
      }

      // Description
      if (desc) desc.innerHTML = s.descriptionHtml || '';

      // Main image
      if (s.imageUrl) {
        mainImageUrl = s.imageUrl;
        if (prevMain) { prevMain.src = s.imageUrl; prevMain.style.display = 'block'; }
        if (mainImageInput) mainImageInput.value = s.imageUrl;
      }

      // Additional images
      if (Array.isArray(s.additionalImages) && addPreviews) {
        addPreviews.innerHTML = '';
        s.additionalImages.forEach(function (url) {
          if (!url) return;

          const imgContainer = document.createElement('div');
          imgContainer.style.position = 'relative';
          imgContainer.style.display = 'inline-block';
          imgContainer.dataset.url = url;

          const img = document.createElement('img');
          img.src = url;
          img.style.width = '86px';
          img.style.height = '64px';
          img.style.objectFit = 'cover';
          img.style.borderRadius = '10px';
          img.style.border = '1px solid rgba(148, 163, 184, 0.4)';

          const delBtn = document.createElement('button');
          delBtn.type = 'button';
          delBtn.textContent = '×';
          delBtn.style.position = 'absolute';
          delBtn.style.top = '4px';
          delBtn.style.right = '4px';
          delBtn.style.width = '22px';
          delBtn.style.height = '22px';
          delBtn.style.borderRadius = '999px';
          delBtn.style.border = '1px solid rgba(148, 163, 184, 0.6)';
          delBtn.style.background = 'rgba(255,255,255,0.95)';
          delBtn.style.cursor = 'pointer';
          delBtn.style.fontWeight = '800';
          delBtn.style.lineHeight = '1';

          delBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            imgContainer.remove();
            updateAllImageUrls();
          });

          imgContainer.appendChild(img);
          imgContainer.appendChild(delBtn);
          addPreviews.appendChild(imgContainer);
        });

        updateAllImageUrls();
      }

      // Seating mode (so the CTA matches the show)
      if (typeof s.usesAllocatedSeating === 'boolean') {
        setSaveMode(s.usesAllocatedSeating ? 'ALLOCATED' : 'UNALLOCATED');
      }
      if (s.usesExternalTicketing === true) {
        setSaveMode('EXTERNAL');
      }
      updateExternalSaveOption();
    } catch (e) {
      console.error('createShow: failed to load showId', existingShowId, e);
    }
  })();
}

    (function bindSaveDropdown(){
      var ddBtn = $('#save_dd_btn');
      var dd = $('#save_dd');
      if (!ddBtn || !dd) return;

      ddBtn.addEventListener('click', function(e){
        e.preventDefault(); e.stopPropagation();
        dd.style.display = (dd.style.display === 'block') ? 'none' : 'block';
      });

      dd.querySelectorAll('[data-mode]').forEach(function(b){
        b.addEventListener('click', function(e){
          e.preventDefault();
          setSaveMode(b.getAttribute('data-mode'));
          dd.style.display = 'none';
        });
      });

      document.addEventListener('click', function(){ dd.style.display = 'none'; });
      dd.addEventListener('click', function(e){ e.stopPropagation(); });
    })();

    $('#save').addEventListener('click', async function(){
        var errEl = $('#err');
        errEl.textContent = '';
        try{
                    // If AI prefilled this page, force an explicit approval tick
            if (window.__aiPrefill){
              var okBox = $('#ai_approval');
              if (!okBox || !okBox.checked){
                throw new Error('Please confirm you’ve checked the AI-filled details before continuing.');
              }
            }

            var title = $('#sh_title').value.trim();
            var dtRaw = $('#sh_dt').value;
            var dtEndRaw = $('#sh_dt_end') ? $('#sh_dt_end').value : '';
var endDateIso = dtEndRaw ? new Date(dtEndRaw).toISOString() : null;
            var venueInput = $('#venue_input');
            var venueText = venueInput.value.trim();
            var venueId = venueInput.dataset.venueId || null;
            if (!venueId){
  throw new Error('Please select an existing venue from the list (or create one).');
}
if (venueInput.dataset.venueApproved !== '1'){
  throw new Error('Please approve the venue and date before saving.');
}

            var imageUrl = prevMain.src || null;
            var descHtml = $('#desc').innerHTML.trim();
            var externalTicketUrl = externalTicketInput ? externalTicketInput.value.trim() : '';
            
            // New fields
           var eventType = eventTypeSelect ? eventTypeSelect.value : '';
var eventCategory = categorySelect ? categorySelect.value : '';

// NEW fields (optional)
var doorsOpenTime = $('#doors_open_time') ? $('#doors_open_time').value : '';
var ageGuidance = $('#age_guidance') ? $('#age_guidance').value : '';
var endTimeNote = $('#end_time_note') ? $('#end_time_note').value.trim() : '';

var accessibility = {
  wheelchair: $('#acc_wheelchair') ? !!$('#acc_wheelchair').checked : false,
  stepFree: $('#acc_stepfree') ? !!$('#acc_stepfree').checked : false,
  hearingLoop: $('#acc_hearingloop') ? !!$('#acc_hearingloop').checked : false,
  accessibleToilet: $('#acc_toilet') ? !!$('#acc_toilet').checked : false,
  notes: $('#acc_more') ? $('#acc_more').value.trim() : ''
};

var tags = [];
if ($('#tags') && $('#tags').value) {
  tags = $('#tags').value
    .split(',')
    .map(function(s){ return s.trim(); })
    .filter(Boolean);
}

var additionalImages = [];
if (allImageUrls && allImageUrls.value) {
  try { additionalImages = JSON.parse(allImageUrls.value); } catch(e){}
}

if (externalTicketUrl) {
  try {
    new URL(externalTicketUrl);
  } catch (err) {
    throw new Error('Backup / external ticket link must be a valid URL.');
  }
}

if (saveMode === 'EXTERNAL' && !externalTicketUrl) {
  throw new Error('Backup / external ticket link is required to publish using the external link.');
}


            if (!title || !dtRaw || !venueText || !descHtml || !eventType || !eventCategory || !imageUrl){
                throw new Error('Title, date/time, venue, description, event type, category, and a main image are required.');
            }
            
            var dateIso = new Date(dtRaw).toISOString();
            
            // The logic for first ticket payload is now REMOVED
            // var firstTicketPayload = null; 
            
            var saveUrl = existingShowId ? ('/admin/shows/' + existingShowId) : '/admin/shows';
var saveMethod = existingShowId ? 'PATCH' : 'POST';

var showRes = await j(saveUrl, {
  method: saveMethod,
  headers:{'Content-Type':'application/json'},
  body: JSON.stringify({
    title: title,
    date: dateIso,
    endDate: endDateIso,
    venueText: venueText,
    venueId: venueId,
    imageUrl: imageUrl,
    descriptionHtml: descHtml,
    eventType: eventType,
    eventCategory: eventCategory,
    additionalImages: additionalImages,

    // capture which flow they chose
    usesAllocatedSeating: saveMode === 'ALLOCATED',
    usesExternalTicketing: saveMode === 'EXTERNAL',
    externalTicketUrl: externalTicketUrl || null,
    status: saveMode === 'EXTERNAL' ? 'LIVE' : undefined,

    // extra fields
    doorsOpenTime: doorsOpenTime || null,
    ageGuidance: ageGuidance || null,
    endTimeNote: endTimeNote || null,
    accessibility: accessibility,
    tags: tags
  })
});

            if (showRes && showRes.error){
                throw new Error(showRes.error);
            }
         var showId =
  existingShowId ||
  (showRes && (
    showRes.showId ||
    showRes.id ||
    (showRes.show && showRes.show.id) ||
    (showRes.item && showRes.item.id)
  )) || null;

if (!showId){
  throw new Error('Failed to save show (no id returned from server)');
}

            
           // NEW: Skip seating-choice page and go straight where the organiser chose
if (saveMode === 'ALLOCATED'){
  window.location.href = '/admin/seating/builder/preview/' + showId + '?layout=blank';
} else if (saveMode === 'EXTERNAL') {
  window.location.href = '/admin/ui/shows/' + showId + '/summary';
} else {
  window.location.href = '/admin/seating/unallocated/' + showId;
}

        }catch(e){
            errEl.textContent = e.message || String(e);
        }
    });
}
 // --- LIST SHOWS ---
async function listShows(){
  if (!main) return;

  main.innerHTML =
    '<div class="card">'
      +'<div class="header">'
        +'<div>'
          +'<div class="title">All events</div>'
          +'<div class="muted" style="margin-top:4px">Search, filter by status/time, or narrow by date range.</div>'
        +'</div>'
        +'<button id="refresh" class="btn">Refresh</button>'
      +'</div>'

      // Controls row (under the title)
      +'<div class="grid" style="grid-template-columns: 1.6fr 180px 160px 160px 110px; gap:10px; align-items:end; margin-bottom:12px;">'
        +'<div class="grid" style="gap:6px;">'
          +'<label style="margin:0;">Search</label>'
          +'<input id="shows_search" class="ctl" type="search" placeholder="Search by show or venue…" />'
        +'</div>'

        +'<div class="grid" style="gap:6px;">'
          +'<label style="margin:0;">Filter</label>'
          +'<select id="shows_filter" class="ctl">'
            +'<option value="all">All</option>'
            +'<option value="present">Present (upcoming)</option>'
            +'<option value="past">Past</option>'
            +'<option value="live">Live</option>'
            +'<option value="draft">Draft</option>'
          +'</select>'
        +'</div>'

        +'<div class="grid" style="gap:6px;">'
          +'<label style="margin:0;">From</label>'
          +'<input id="shows_from" class="ctl" type="date" />'
        +'</div>'

        +'<div class="grid" style="gap:6px;">'
          +'<label style="margin:0;">To</label>'
          +'<input id="shows_to" class="ctl" type="date" />'
        +'</div>'

        +'<div class="grid" style="gap:6px;">'
          +'<label style="margin:0;">&nbsp;</label>'
          +'<button id="shows_clear" class="btn">Clear</button>'
        +'</div>'
      +'</div>'

      +'<div id="shows_count" class="muted" style="margin-bottom:10px;font-size:13px;"></div>'

      +'<table>'
        +'<thead><tr>'
          +'<th>Title</th><th>When</th><th>Venue</th>'
          +'<th>Total allocation</th><th>Gross face</th><th>Status</th><th class="promoter-col">Promoter</th><th></th>'
        +'</tr></thead>'
        +'<tbody id="tbody"></tbody>'
      +'</table>'
    +'</div>';

  var tb = $('#tbody');
  var searchEl = $('#shows_search');
  var filterEl = $('#shows_filter');
  var fromEl = $('#shows_from');
  var toEl = $('#shows_to');
  var clearBtn = $('#shows_clear');
  var countEl = $('#shows_count');

  var allItems = [];
  var searchTimer = null;
  var venueExtras = loadVenueExtras();

  function norm(s){ return String(s || '').toLowerCase(); }

  function num(v){
  var n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

  function loadVenueExtras(){
    try{
      var saved = localStorage.getItem('adminVenueExtras');
      return saved ? JSON.parse(saved) : {};
    }catch(e){
      return {};
    }
  }

  function venueInitials(label){
    var text = String(label || '').trim();
    if (!text) return '';
    var parts = text.split(/\s+/).filter(Boolean);
    var first = parts[0] ? parts[0][0] : '';
    var second = parts.length > 1 ? parts[1][0] : '';
    return (first + second).toUpperCase();
  }

  function venueAvatarHtml(venue, opts){
    opts = opts || {};
    var size = opts.size || 36;
    var label = (venue && venue.name) || 'Venue';
    var extras = (venue && venue.id && venueExtras && venueExtras[venue.id]) ? venueExtras[venue.id] : null;
    var imageUrl = extras && extras.image;
    var fontSize = Math.max(12, Math.round(size * 0.42));
    var initials = venueInitials(label);
    var inner = imageUrl
      ? '<img src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(label) + ' photo" style="width:100%;height:100%;object-fit:cover;display:block;" />'
      : '<span style="font-weight:700;color:#0f172a;font-size:' + fontSize + 'px;">' + escapeHtml(initials || '') + '</span>';
    return ''
      + '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:999px;background:#f1f5f9;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;overflow:hidden;">'
      + inner
      + '</div>';
  }

function sumTicketTypeCap(tts){
  if (!Array.isArray(tts)) return null;
  var total = 0;
  var any = false;
  for (var i=0; i<tts.length; i++){
    var a = tts[i] && tts[i].available;
    if (a == null) continue;          // null/undefined means "unlimited" -> can't infer total
    var n = Number(a);
    if (!Number.isFinite(n)) continue;
    total += n;
    any = true;
  }
  return any ? total : null;
}


  function parseISO(d){
    var dt = d ? new Date(d) : null;
    return (dt && !isNaN(dt.getTime())) ? dt : null;
  }

  function startOfDay(d){
    var x = new Date(d);
    x.setHours(0,0,0,0);
    return x;
  }

  function endOfDay(d){
    var x = new Date(d);
    x.setHours(23,59,59,999);
    return x;
  }

  function matchesQuery(s, q){
    if (!q) return true;
    var hay =
      norm(s.title) + ' ' +
      norm(s.venueText) + ' ' +
      norm(s.venue && s.venue.name) + ' ' +
      norm(s.venue && s.venue.city);
    return hay.indexOf(q) !== -1;
  }

  function matchesMode(s, mode){
    mode = mode || 'all';
    var status = (s.status || 'DRAFT');
    var dt = parseISO(s.date);
    var now = new Date();

    if (mode === 'live') return status === 'LIVE';
    if (mode === 'draft') return status !== 'LIVE';

    // Present/Past are based on date/time
    if (mode === 'present'){
      if (!dt) return false;
      return dt.getTime() >= now.getTime();
    }
    if (mode === 'past'){
      if (!dt) return false;
      return dt.getTime() < now.getTime();
    }

    return true; // all
  }

  function matchesDateRange(s, fromVal, toVal){
    if (!fromVal && !toVal) return true;

    var dt = parseISO(s.date);
    if (!dt) return false;

    var fromD = fromVal ? startOfDay(new Date(fromVal)) : null;
    var toD = toVal ? endOfDay(new Date(toVal)) : null;

    if (fromD && dt.getTime() < fromD.getTime()) return false;
    if (toD && dt.getTime() > toD.getTime()) return false;
    return true;
  }

 function statusBadgeHTML(statusLabel){
  statusLabel = statusLabel || 'DRAFT';
  return '<span class="pill" style="background:'
    +(statusLabel === 'LIVE' ? '#e6f7fd' : '#f8fafc')
    +';color:'+(statusLabel === 'LIVE' ? '#0f9cdf' : '#475569')
    +';border:1px solid '+(statusLabel === 'LIVE' ? '#0f9cdf' : '#e2e8f0')
    +';">'+statusLabel+'</span>';
}


  function render(items){
    if (!tb) return;

    if (!items.length){
      tb.innerHTML = '<tr><td colspan="8" class="muted">No matching events</td></tr>';
      return;
    }

    tb.innerHTML = items.map(function(s){
      var when = s.date
        ? new Date(s.date).toLocaleString('en-GB', { dateStyle:'short', timeStyle:'short' })
        : '';

           // Allocation counts (support multiple backend shapes)
      var sold = num(
        (s._alloc && (s._alloc.sold ?? s._alloc.soldCount)) ??
        s.sold ??
        s.soldCount ??
        0
      );

      // "hold" in your UI should represent HELD seats
      var held = num(
        (s._alloc && (s._alloc.held ?? s._alloc.hold ?? s._alloc.heldCount ?? s._alloc.holdCount)) ??
        s.held ??
        s.heldCount ??
        0
      );

      // BLOCKED seats (your Prisma enum supports this)
      var blocked = num(
        (s._alloc && (s._alloc.blocked ?? s._alloc.blockedCount)) ??
        s.blocked ??
        s.blockedCount ??
        0
      );

      // Try hard to derive TOTAL capacity if backend didn't supply it
      var total =
        ((s._alloc && (s._alloc.total ?? s._alloc.capacity)) != null) ? num(s._alloc.total ?? s._alloc.capacity)
        : ((s._alloc && s._alloc.available != null) ? num(s._alloc.available) + sold + held + blocked
        : (s.capacity != null ? num(s.capacity)
        : (sumTicketTypeCap(s.ticketTypes))));

      // If total is still null/undefined, we can't compute available reliably
      var available = (total == null) ? null : Math.max(num(total) - sold - held - blocked, 0);

      var pct = (total && total > 0) ? Math.round((sold / total) * 100) : 0;

     var bar = '<div style="background:#e5e7eb;height:6px;border-radius:999px;overflow:hidden;width:140px">'
        + '<div style="background:#0f9cdf;height:6px;width:'+pct+'%"></div>'
        + '</div>';

      var statusLabel = (s.status || 'DRAFT');
      var venueLabel = (s.venue
        ? (s.venue.name + (s.venue.city ? ' – '+s.venue.city : ''))
        : (s.venueText || '')
      );
      var venueId = s.venue && s.venue.id ? s.venue.id : '';
      var venueAvatar = s.venue ? venueAvatarHtml(s.venue, { size: 36 }) : '';
      var venueCell = venueLabel
        ? ('<div style="display:flex;align-items:center;gap:8px;">'
            + venueAvatar
            + '<span>' + escapeHtml(venueLabel) + '</span>'
          + '</div>')
        : '';
      var venueAttrs = venueId
        ? ' data-venue-id="' + escapeHtml(venueId) + '" data-venue-label="' + escapeHtml(venueLabel) + '" style="cursor:pointer;"'
        : '';

      var promoters = s.promoters || [];
      var primaryPromoter = promoters[0] || null;
      var promoterAvatar = promoterAvatarHtml(primaryPromoter, { size: 36 });
      var usesExternalTicketing = s.usesExternalTicketing === true;
      var allocationHtml = usesExternalTicketing
        ? '<span class="muted">External ticket URL</span>'
        : ('<span class="muted">'
            +'Sold '+sold
            +' · Held '+held
            +' · Blocked '+blocked
            +' · Avail '+(available == null ? '—' : available)
            +(total == null ? '' : (' / '+total))
          +'</span> '+bar);

      return ''
        +'<tr data-row="'+s.id+'" data-status="'+statusLabel+'">'
          +'<td>'+(s.title || '')+'</td>'
          +'<td>'+when+'</td>'
          +'<td'+venueAttrs+'>'+venueCell+'</td>'
          +'<td>'+allocationHtml+'</td>'
          +'<td>£'+(((s._revenue && s._revenue.grossFace) || 0).toFixed(2))+'</td>'
          +'<td>'+statusBadgeHTML(statusLabel)+'</td>'
          +'<td class="promoter-col">'
            +'<button type="button" data-link-promoter="'+s.id+'"'
              +' style="border:none;background:none;padding:0;cursor:pointer;">'
              + promoterAvatar
            +'</button>'
          +'</td>'
          +'<td>'
            +'<div class="kebab">'
              +'<button class="btn" data-kebab="'+s.id+'">⋮</button>'
              +'<div class="menu" id="m-'+s.id+'">'
                +'<a href="#" data-edit="'+s.id+'">Edit</a>'
                +'<a href="#" data-seating="'+s.id+'">Seating map</a>'
                +'<a href="#" data-tickets="'+s.id+'">Tickets</a>'
                +'<a href="#" data-external-link="'+s.id+'">Switch to external link</a>'
                +'<a href="#" data-link-promoter="'+s.id+'">Link promoter</a>'
                +'<a href="#" data-dup="'+s.id+'">Duplicate</a>'
                +(sold === 0 ? '<a href="#" data-delete="'+s.id+'">Delete</a>' : '')
              +'</div>'
            +'</div>'
          +'</td>'
        +'</tr>';
    }).join('');

    // kebab menu open
    $$('[data-kebab]').forEach(function(btn){
      btn.addEventListener('click', function(e){
        e.preventDefault();
        var id = btn.getAttribute('data-kebab');
        var m = $('#m-' + id);
        $$('.menu').forEach(function(x){ x.classList.remove('open'); });
        if (m) m.classList.add('open');
      });
    });

    // close kebab when clicking outside (bind once globally)
    if (!window.__adminKebabCloserBound){
      window.__adminKebabCloserBound = true;
      document.addEventListener('click', function(e){
        var t = e.target;
        if (!t || !t.closest || !t.closest('.kebab')){
          $$('.menu').forEach(function(x){ x.classList.remove('open'); });
        }
      });
    }

    // actions
    $$('[data-edit]').forEach(function(a){
      a.addEventListener('click', function(e){
        e.preventDefault();
        var id = a.getAttribute('data-edit');
        if (id) go('/admin/ui/shows/'+id+'/edit');
      });
    });

    $$('[data-seating]').forEach(function(a){
      a.addEventListener('click', function(e){
        e.preventDefault();
        var id = a.getAttribute('data-seating');
        if (id) window.location.href = '/admin/seating/builder/preview/' + id;
      });
    });

    $$('[data-tickets]').forEach(function(a){
      a.addEventListener('click', function(e){
        e.preventDefault();
        var id = a.getAttribute('data-tickets');
        if (id) go('/admin/ui/shows/'+id+'/tickets');
      });
    });

    $$('[data-external-link]').forEach(function(a){
      a.addEventListener('click', async function(e){
        e.preventDefault();
        var id = a.getAttribute('data-external-link');
        if (!id) return;
        var showItem = (allItems || []).find(function(item){ return item.id === id; });
        var currentUrl = showItem && showItem.externalTicketUrl ? String(showItem.externalTicketUrl) : '';
        var nextUrl = prompt('External ticket link', currentUrl || 'https://');
        if (nextUrl === null) return;
        nextUrl = nextUrl.trim();
        if (!nextUrl) return;
        try{
          new URL(nextUrl);
        }catch(err){
          alert('Please enter a valid URL (including https://).');
          return;
        }

        try{
          await j('/admin/shows/' + id, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              externalTicketUrl: nextUrl,
              usesExternalTicketing: true
            })
          });
          await load();
        }catch(err){
          alert('Failed to switch to external link: ' + (err.message || err));
        }
      });
    });

    $$('[data-dup]').forEach(function(a){
      a.addEventListener('click', async function(e){
        e.preventDefault();
        try{
          var id = a.getAttribute('data-dup');
          if (!id) return;
          var r = await j('/admin/shows/'+id+'/duplicate', { method:'POST' });
          if (r && r.ok && r.newId){
            go('/admin/ui/shows/'+r.newId+'/edit');
          }
        }catch(err){
          alert('Duplicate failed: ' + (err.message || err));
        }
      });
    });

    $$('[data-link-promoter]').forEach(function(a){
      a.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        var id = a.getAttribute('data-link-promoter');
        if (!id) return;
        openPromoterLinker({ showId: id });
      });
    });

    $$('[data-venue-id]').forEach(function(cell){
      cell.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        var id = cell.getAttribute('data-venue-id');
        if (!id) return;
        openVenuePanel({
          venueId: id,
          venueLabel: cell.getAttribute('data-venue-label') || ''
        });
      });
    });

    $$('[data-delete]').forEach(function(a){
      a.addEventListener('click', async function(e){
        e.preventDefault();
        var id = a.getAttribute('data-delete');
        if (!id) return;
        if (!confirm('Delete this event? This cannot be undone.')) return;
        try{
          await j('/admin/shows/' + id, { method:'DELETE' });
          await load();
        }catch(err){
          alert('Delete failed: ' + (err.message || err));
        }
      });
    });

    // row click behaviour (unchanged)
    $$('[data-row]').forEach(function(row){
      row.addEventListener('click', function(e){
        if (e.target && (e.target.closest('a') || e.target.closest('button'))) return;
        var id = row.getAttribute('data-row');
        if (!id) return;
        go('/admin/ui/shows/' + id + '/summary');
      });
    });
  }

  function applyFilters(){
    var q = norm(searchEl && searchEl.value ? searchEl.value.trim() : '');
    var mode = (filterEl && filterEl.value) ? filterEl.value : 'all';
    var fromVal = (fromEl && fromEl.value) ? fromEl.value : '';
    var toVal = (toEl && toEl.value) ? toEl.value : '';

    var filtered = (allItems || []).filter(function(s){
      return matchesQuery(s, q)
        && matchesMode(s, mode)
        && matchesDateRange(s, fromVal, toVal);
    });

    // Helpful count line
    if (countEl){
      countEl.textContent =
        'Showing ' + filtered.length + ' of ' + (allItems ? allItems.length : 0) + ' events';
    }

    render(filtered);
  }

  async function load(){
    if (!tb) return;
    tb.innerHTML =
      '<tr><td colspan="8"><div class="loading-strip" aria-label="Loading"></div></td></tr>';
    if (countEl) countEl.textContent = '';

    try{
      var data = await j('/admin/shows');
      allItems = data.items || [];
      console.log('[Admin UI][shows] sample _alloc:', allItems[0] && allItems[0]._alloc);

      if (!allItems.length){
        tb.innerHTML = '<tr><td colspan="8" class="muted">No shows yet</td></tr>';
        if (countEl) countEl.textContent = 'Showing 0 of 0 events';
        return;
      }
      applyFilters();
    }catch(e){
      tb.innerHTML = '<tr><td colspan="7" class="error">Failed to load shows: '+(e.message||e)+'</td></tr>';
    }
  }

  // Refresh button
  $('#refresh').addEventListener('click', load);

  // Search (debounced typing)
  if (searchEl){
    searchEl.addEventListener('input', function(){
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(applyFilters, 120);
    });
  }

  // Filter + date range (instant)
  if (filterEl) filterEl.addEventListener('change', applyFilters);
  if (fromEl) fromEl.addEventListener('change', applyFilters);
  if (toEl) toEl.addEventListener('change', applyFilters);

  // Clear button
  if (clearBtn){
    clearBtn.addEventListener('click', function(){
      if (searchEl) searchEl.value = '';
      if (filterEl) filterEl.value = 'all';
      if (fromEl) fromEl.value = '';
      if (toEl) toEl.value = '';
      applyFilters();
    });
  }

  load();
}

  // --- EDIT SHOW ---
  async function editShow(id){
    var resp;
    try{
      resp = await j('/admin/shows/' + id);
    }catch(e){
      if (!main) return;
      main.innerHTML = '<div class="card"><div class="error">Failed to load show: '+(e.message||e)+'</div></div>';
      return;
    }
    var item = resp.item || {};
    if (!main) return;

    main.innerHTML =
      '<div class="card">'
        +'<div class="header"><div class="title">Edit show</div></div>'
        +'<div class="grid grid-2">'
          +'<div class="grid">'
            +'<label>Title</label>'
            +'<input id="sh_title" />'
          +'</div>'
          +'<div class="grid">'
            +'<label>Date & time</label>'
            +'<input id="sh_dt" type="datetime-local" />'
          +'</div>'
          +'<div class="grid">'
            +'<label>Venue</label>'
            +'<input id="venue_input" />'
          +'</div>'
          +'<div class="grid">'
            +'<label>Poster image</label>'
            +'<div class="drop" id="drop">Drop image here or click to choose</div>'
            +'<input id="file" type="file" accept="image/*" style="display:none" />'
            +'<div class="progress" style="margin-top:8px"><div id="bar" class="bar"></div></div>'
            +'<img id="prev" class="imgprev" />'
          +'</div>'
        +'</div>'
        +'<div class="grid" style="margin-top:10px">'
          +'<label>Description</label>'
          + editorToolbarHtml()
          +'<div id="desc" data-editor contenteditable="true" '
            +'style="min-height:120px;border:1px solid var(--border);border-radius:8px;padding:10px"></div>'
          +'<div class="muted">Event description (required). Use the toolbar to format.</div>'
        +'</div>'
        +'<div class="row" style="margin-top:10px">'
          +'<button id="save" class="btn p">Save changes</button>'
          +'<a class="btn" href="#" id="goSeating">Seating map</a>'
          +'<a class="btn" href="#" id="goTickets">Tickets</a>'
          +'<div id="err" class="error"></div>'
        +'</div>'
      +'</div>';

    bindWysiwyg(main);
    mountVenuePicker($('#venue_input'));

    $('#sh_title').value = item.title || '';
    var vInput = $('#venue_input');
    vInput.value =
      (item.venue && item.venue.name) ||
      item.venueText ||
      '';
    if (item.date){
      var dt = new Date(item.date);
      $('#sh_dt').value = dt.toISOString().slice(0,16);
    }
    $('#desc').innerHTML = item.description || '';

    var drop = $('#drop');
    var file = $('#file');
    var bar  = $('#bar');
    var prev = $('#prev');

    if (item.imageUrl){
      prev.src = item.imageUrl;
      prev.style.display = 'block';
    }

    async function doUpload(f){
      $('#err').textContent = '';
      bar.style.width = '15%';
      try{
        var out = await uploadPoster(f);
        prev.src = out.url;
        prev.style.display = 'block';
        bar.style.width = '100%';
        setTimeout(function(){ bar.style.width='0%'; }, 800);
      }catch(e){
        bar.style.width = '0%';
        $('#err').textContent = 'Upload failed: '+(e.message||e);
      }
    }

    drop.addEventListener('click', function(){ file.click(); });
    drop.addEventListener('dragover', function(e){ e.preventDefault(); drop.classList.add('drag'); });
    drop.addEventListener('dragleave', function(){ drop.classList.remove('drag'); });
    drop.addEventListener('drop', async function(e){
      e.preventDefault(); drop.classList.remove('drag');
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) await doUpload(f);
    });
    file.addEventListener('change', async function(){
      var f = file.files && file.files[0];
      if (f) await doUpload(f);
    });

    $('#goSeating').addEventListener('click', function(e){
      e.preventDefault();
      go('/admin/ui/shows/' + id + '/seating');
    });
    $('#goTickets').addEventListener('click', function(e){
      e.preventDefault();
      go('/admin/ui/shows/' + id + '/tickets');
    });

    $('#save').addEventListener('click', async function(){
      var errEl = $('#err');
      errEl.textContent = '';
      try{
        var payload = {
          title: $('#sh_title').value.trim(),
          date: $('#sh_dt').value
            ? new Date($('#sh_dt').value).toISOString()
            : null,
          venueText: vInput.value.trim(),
          venueId: vInput.dataset.venueId || null,
          imageUrl: prev.src || null,
          descriptionHtml: $('#desc').innerHTML.trim(),
          status: item.status
        };
        if (!payload.title || !payload.date || !payload.venueText || !payload.descriptionHtml){
          throw new Error('Title, date/time, venue and description are required');
        }
        var r = await j('/admin/shows/' + id, {
          method:'PATCH',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(payload)
        });
        if (r && r.ok){
          alert('Saved');
        }else{
          throw new Error((r && r.error) || 'Failed to save');
        }
      }catch(e){
        errEl.textContent = e.message || String(e);
      }
    });
  }

  // --- SUMMARY PAGE ---
// [src/routes/admin-ui.ts - Replace the summaryPage function]

async function summaryPage(id){
  if (!main) return;
  main.innerHTML = '<div class="card"><div class="title">Loading summary…</div></div>';
  let resp;
  try{
    resp = await j('/admin/shows/' + id);
  }catch(e){
    main.innerHTML = '<div class="card"><div class="error">Failed to load show: '+(e.message||e)+'</div></div>';
    return;
  }
  const show = resp.item || {};
  const ticketTypes = show.ticketTypes || [];
  const when = show.date
    ? new Date(show.date).toLocaleString('en-GB', { dateStyle:'full', timeStyle:'short' })
    : '';
  const venueName = show.venue
    ? (show.venue.name + (show.venue.city ? ' – ' + show.venue.city : ''))
    : (show.venueText || '');
  
  const statusLabel = show.status || 'DRAFT';
  const isLive = statusLabel === 'LIVE';
  const usesAllocatedSeating = show.usesAllocatedSeating === true;

    // --- Links Configuration ---

  const storefront = show.organiser?.storefrontSlug || '';
  const showSlug = show.slug || '';
  const externalTicketUrl = (show.externalTicketUrl || '').trim();
  const usesExternalTicketing = show.usesExternalTicketing === true;

  // Preferred pretty URL: /public/<storefront>/<slug>
  const prettyUrl = (storefront && showSlug)
    ? (window.location.origin + '/public/' + storefront + '/' + showSlug)
    : '';

  // Fallback (only used if pretty URL cannot be formed)
  const legacyUrl = window.location.origin + '/public/event/' + id;

  // The URL we actually show + open
  const publicBookingUrl = (usesExternalTicketing && externalTicketUrl)
    ? externalTicketUrl
    : (prettyUrl || legacyUrl);
  const bookingLabel = (usesExternalTicketing && externalTicketUrl)
    ? 'External ticket link'
    : 'Public booking page';

  // Storefront landing page (optional extra link)
  const storefrontUrl = storefront
    ? (window.location.origin + '/public/' + storefront)
    : '';

  let linksHtml = '';
  
  if (isLive) {
    linksHtml = ''
    + '<div class="grid">'
    +   '<div style="margin-bottom:8px">'
    +     '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;color:#64748b">'+bookingLabel+'</label>'
    +     '<div style="display:flex;gap:8px">'
    +       '<input readonly value="'+publicBookingUrl+'" style="flex:1;background:#f8fafc;color:#334155;border:1px solid #e2e8f0;border-radius:6px;padding:8px" onclick="this.select()">'
    +       '<a href="'+publicBookingUrl+'" target="_blank" class="btn" style="color:#0284c7;border-color:#0284c7;text-decoration:none">Open ↗</a>'
    +     '</div>'
    +   '</div>'
    + '</div>'
    + '<div class="muted" style="margin-top:12px;font-size:13px">Your event is live. Copy these links to share.</div>';
  } else {
    linksHtml = ''
    + '<div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;padding:12px;color:#9f1239;font-size:13px;line-height:1.4">'
    +   '<strong>Event is not live.</strong><br/>'
    +   'Please configure tickets and click "Publish Show" in the <a href="#" id="linkToBuilder" style="color:inherit;text-decoration:underline">Seating Builder</a> to generate shareable links.'
    + '</div>';
  }

  main.innerHTML = ''
    +'<div class="card">'
    +'<div class="header">'
    +'<div>'
    +'<div class="title">'+(show.title || 'Untitled show')+'</div>'
    +'<div class="muted">'+(when ? when + ' · ' : '')+venueName+'</div>'
    +'<div style="margin-top:6px">'
    +'<span class="pill" style="background:'+(isLive ? '#ecfdf3' : '#f8fafc')+';color:'+(isLive ? '#166534' : '#475569')+';border:1px solid '+(isLive ? '#bbf7d0' : '#e2e8f0')+'">'+statusLabel+'</span>'
    +(show.publishedAt ? '<span class="muted" style="margin-left:8px">Published '+new Date(show.publishedAt).toLocaleString('en-GB')+'</span>' : '')
    +'</div>'
    +'</div>'
    +'<div class="row">'
    +'<button class="btn" id="summarySeating">Edit seating</button>'
    +'<button class="btn" id="summaryTickets">Manage tickets</button>'
    +'</div>'
    +'</div>'
    +(show.imageUrl ? '<div style="margin-bottom:16px"><img src="'+show.imageUrl+'" alt="Poster" style="max-height:220px;border-radius:12px;border:1px solid var(--border)" /></div>' : '')
    +'<div class="grid grid-2" style="margin-bottom:16px">'
    
    // SHAREABLE LINKS CARD
    +'<div class="card" style="margin:0">'
    +'<div class="title" style="margin-bottom:12px">Shareable links</div>'
    + linksHtml
    +'</div>'

    +'<div class="card" style="margin:0">'
    +'<div class="title" style="margin-bottom:6px">Key details</div>'
    +'<div class="grid">'
    +'<div><div class="muted">Date & time</div><div>'+(when || 'TBC')+'</div></div>'
    +'<div><div class="muted">Venue</div><div>'+(venueName || 'TBC')+'</div></div>'
    +'</div>'
    +'</div>'
    +'</div>'
    +'<div class="card" style="margin:0">'
    +'<div class="title" style="margin-bottom:8px">Ticket types</div>'
    +(ticketTypes.length === 0
      ? '<div class="muted">No ticket types yet. Use "Manage tickets" to add them.</div>'
      : '<table><thead><tr><th>Name</th><th>Price</th><th>Available</th></tr></thead><tbody>'
      + ticketTypes.map(function(t){
          return '<tr><td>'+t.name+'</td><td>£'+((t.pricePence || 0)/100).toFixed(2)+'</td><td>'+(t.available == null ? '—' : t.available)+'</td></tr>';
        }).join('')
      +'</tbody></table>')
    +'</div>'
    +'<div class="card" style="margin:0">'
    +  '<div class="header">'
    +    '<div class="title">Promoters</div>'
    +    '<button class="btn" id="showPromotersManage">Manage promoters</button>'
    +  '</div>'
    +  '<div id="showPromotersList" class="muted">Loading promoters…</div>'
    +'</div>'
    +'</div>';

  var summarySeating = $('#summarySeating');
  var summaryTickets = $('#summaryTickets');
  var linkToBuilder = $('#linkToBuilder');
  var promotersList = $('#showPromotersList');
  var promotersManage = $('#showPromotersManage');

  async function loadShowPromoters(){
    if (!promotersList) return;
    promotersList.innerHTML = '<div class="muted">Loading promoters…</div>';
    try{
      var res = await j('/admin/shows/' + encodeURIComponent(id) + '/promoters');
      var items = (res && res.promoters) ? res.promoters : [];
      if (!items.length){
        promotersList.innerHTML = '<div class="muted">No promoters linked yet.</div>';
        return;
      }
      promotersList.innerHTML = items.map(function(p){
        var label = p.tradingName || p.name || 'Promoter';
        var meta = p.email ? (' · ' + p.email) : '';
        return '<div style="padding:6px 0;border-bottom:1px solid var(--border);"><strong>'
          + escapeHtml(label) + '</strong><span class="muted" style="font-size:12px;">'
          + escapeHtml(meta) + '</span></div>';
      }).join('');
    }catch(e){
      promotersList.innerHTML = '<div class="error">Failed to load promoters: ' + escapeHtml(parseErr(e)) + '</div>';
    }
  }

  if (summarySeating){
    summarySeating.addEventListener('click', function(){
      window.location.href = '/admin/seating/builder/preview/' + id;
    });
  }
  if (summaryTickets){
    summaryTickets.addEventListener('click', function(){
      if (usesAllocatedSeating){
        window.location.href = '/admin/seating/builder/preview/' + id + '?tab=tickets';
        return;
      }
      window.location.href = '/admin/seating-choice/' + id;
    });
  }
  if (linkToBuilder){
    linkToBuilder.addEventListener('click', function(e){
      e.preventDefault();
      window.location.href = '/admin/seating/builder/preview/' + id;
    });
  }
  if (promotersManage){
    promotersManage.addEventListener('click', function(){
      openPromoterLinker({ showId: id, showTitle: show.title, onUpdated: loadShowPromoters });
    });
  }

  loadShowPromoters();
}

  // --- TICKETS PAGE ---
  async function ticketsPage(id){
    if (!main) return;
    main.innerHTML = '<div class="card"><div class="title">Loading tickets…</div></div>';

    var showResp;
    try{
      showResp = await j('/admin/shows/' + id);
    }catch(e){
      main.innerHTML = '<div class="card"><div class="error">Failed to load show: '+(e.message||e)+'</div></div>';
      return;
    }
    var show = showResp.item || {};
    var when = show.date
      ? new Date(show.date).toLocaleString('en-GB', { dateStyle:'full', timeStyle:'short' })
      : '';
    var venueName = show.venue
      ? (show.venue.name + (show.venue.city ? ' – ' + show.venue.city : ''))
      : (show.venueText || '');

    main.innerHTML =
      '<div class="card">'
        +'<div class="header">'
          +'<div>'
            +'<div class="title">Tickets for '+(show.title || 'Untitled show')+'</div>'
            +'<div class="muted">'+(when ? when + ' · ' : '') + venueName +'</div>'
          +'</div>'
          +'<div class="row">'
            +'<button class="btn" id="backToShows">Back to all events</button>'
            +'<button class="btn" id="editShowBtn">Edit show</button>'
          +'</div>'
        +'</div>'

        +'<div class="grid grid-2" style="margin-bottom:16px">'
          +'<div class="card" style="margin:0">'
            +'<div class="title" style="margin-bottom:4px">Ticket structure</div>'
            +'<div class="muted" style="margin-bottom:8px">'
              +'Tickets can be free (price £0) or paid, and can be sold as general admission or allocated seating.'
            +'</div>'
            +'<div class="row" style="margin-bottom:8px">'
              +'<span class="pill" id="structureGeneral">General admission</span>'
              +'<span class="pill" id="structureAllocated">Allocated seating</span>'
            +'</div>'
            +'<div class="muted" style="font-size:12px">'
              +'Allocated seating uses a seating map for this venue. You can reuse an existing map or create a new one just for this show.'
            +'</div>'
          +'</div>'

          +'<div class="card" style="margin:0">'
            +'<div class="title" style="margin-bottom:4px">Seat maps for this show</div>'
            +'<div class="muted" id="seatMapsSummary">Loading seat maps…</div>'
            +'<div id="seatMapsList" style="margin-top:8px"></div>'
            +'<div class="row" style="margin-top:8px">'
              +'<button class="btn" id="refreshSeatMaps">Refresh seat maps</button>'
              +'<button class="btn" id="editSeatMaps">Create / edit seat map</button>'
            +'</div>'
          +'</div>'
        +'</div>'

        +'<div class="card" style="margin:0">'
          +'<div class="header">'
            +'<div class="title">Ticket types</div>'
            +'<button class="btn" id="addTypeBtn">Add ticket type</button>'
          +'</div>'
          +'<div class="muted" style="margin-bottom:8px">'
// [Fixed Code]
+'Set up the tickets you want to sell for this show. A £0 price will be treated as a free ticket.'
+'</div>'
          +'<div id="ticketTypesEmpty" class="muted" style="display:none">No ticket types yet. Use “Add ticket type” to create one.</div>'
          +'<table>'
            +'<thead><tr><th>Name</th><th>Price</th><th>Available</th><th></th></tr></thead>'
            +'<tbody id="ticketTypesBody"><tr><td colspan="4"><div class="loading-strip" aria-label="Loading"></div></td></tr></tbody>'
          +'</table>'
          +'<div id="addTypeForm" style="margin-top:12px;display:none">'
            +'<div class="grid grid-3">'
              +'<div class="grid"><label>Name</label><input id="tt_name" placeholder="e.g. Standard" /></div>'
              +'<div class="grid"><label>Price (£)</label><input id="tt_price" type="number" min="0" step="0.01" placeholder="e.g. 15" /></div>'
              +'<div class="grid"><label>Available (optional)</label><input id="tt_available" type="number" min="0" step="1" placeholder="Leave blank for unlimited" /></div>'
            +'</div>'
            +'<div class="row" style="margin-top:8px">'
              +'<button class="btn p" id="tt_save">Save ticket type</button>'
              +'<button class="btn" id="tt_cancel">Cancel</button>'
              +'<div id="tt_err" class="error"></div>'
            +'</div>'
          +'</div>'
        +'</div>'
      +'</div>';

    $('#backToShows').addEventListener('click', function(){ go('/admin/ui/shows/current'); });
    $('#editShowBtn').addEventListener('click', function(){ go('/admin/ui/shows/' + id + '/edit'); });

    var addTypeForm = $('#addTypeForm');
    var ticketTypesBody = $('#ticketTypesBody');
    var ticketTypesEmpty = $('#ticketTypesEmpty');

    $('#addTypeBtn').addEventListener('click', function(){
      addTypeForm.style.display = 'block';
      $('#tt_name').focus();
    });
    $('#tt_cancel').addEventListener('click', function(){
      addTypeForm.style.display = 'none';
      $('#tt_err').textContent = '';
    });

    async function loadTicketTypes(){
      try{
        var res = await j('/admin/shows/' + id + '/ticket-types');
        var items = res.ticketTypes || [];
        if (!items.length){
          ticketTypesBody.innerHTML = '<tr><td colspan="4" class="muted">No ticket types yet.</td></tr>';
          ticketTypesEmpty.style.display = 'block';
        }else{
          ticketTypesEmpty.style.display = 'none';
          ticketTypesBody.innerHTML = items.map(function(tt){
            var price = (tt.pricePence || 0) / 100;
            var priceLabel = price === 0 ? 'Free' : '£' + price.toFixed(2);
var availLabel = tt.available == null ? 'NOT SET' : String(tt.available);
            return ''
              +'<tr>'
                +'<td>'+(tt.name || '')+'</td>'
                +'<td>'+priceLabel+'</td>'
                +'<td>'+availLabel+'</td>'
                +'<td><button class="btn" data-del="'+tt.id+'">Delete</button></td>'
              +'</tr>';
          }).join('');

          $$('[data-del]', ticketTypesBody).forEach(function(btn){
            btn.addEventListener('click', async function(e){
              e.preventDefault();
              var toDel = btn.getAttribute('data-del');
              if (!toDel) return;
              if (!confirm('Delete this ticket type?')) return;
              try{
                await j('/admin/ticket-types/' + toDel, { method:'DELETE' });
                loadTicketTypes();
              }catch(err){
                alert('Failed to delete: ' + (err.message || err));
              }
            });
          });
        }
      }catch(e){
        ticketTypesBody.innerHTML = '<tr><td colspan="4" class="error">Failed to load ticket types: '+(e.message||e)+'</td></tr>';
      }
    }

    $('#tt_save').addEventListener('click', async function(){
      var errEl = $('#tt_err');
      errEl.textContent = '';
      var name = $('#tt_name').value.trim();
      var priceStr = $('#tt_price').value.trim();
      var availStr = $('#tt_available').value.trim();

if (!availStr){
  errEl.textContent = 'Available is required (this is your show capacity)';
  return;
}

var a = Number(availStr);
if (!Number.isFinite(a) || a < 1){
  errEl.textContent = 'Available must be a whole number of 1 or more';
  return;
}

var available = Math.trunc(a);

      try{
        await j('/admin/shows/' + id + '/ticket-types', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ name:name, pricePence:pricePence, available:available })
        });
        $('#tt_name').value = '';
        $('#tt_price').value = '';
        $('#tt_available').value = '';
        addTypeForm.style.display = 'none';
        loadTicketTypes();
      }catch(err){
        errEl.textContent = err.message || String(err);
      }
    });

    loadTicketTypes();

    // seat map summary
    var seatMapsSummary = $('#seatMapsSummary');
    var seatMapsList = $('#seatMapsList');
    var venueId = show.venue && show.venue.id ? show.venue.id : null;

    async function loadSeatMaps(){
      seatMapsSummary.textContent = 'Loading seat maps…';
      seatMapsList.innerHTML = '';
      try{
        var url = '/admin/seatmaps?showId=' + encodeURIComponent(id);
        if (venueId) url += '&venueId=' + encodeURIComponent(venueId);
        var maps = await j(url);
        if (!Array.isArray(maps) || !maps.length){
          seatMapsSummary.textContent = 'No seat maps yet for this show/venue.';
          seatMapsList.innerHTML = '<div class="muted" style="font-size:13px">You can create a seat map using the “Create / edit seat map” button.</div>';
          return;
        }
        seatMapsSummary.textContent = maps.length + ' seat map' + (maps.length > 1 ? 's' : '') + ' found.';
        seatMapsList.innerHTML = maps.map(function(m){
          var def = m.isDefault ? ' · <strong>Default</strong>' : '';
          return '<div class="row" style="margin-bottom:4px;justify-content:space-between">'
              +'<div><strong>'+m.name+'</strong> <span class="muted">v'+(m.version || 1)+'</span>'+def+'</div>'
              +'<div class="row" style="gap:4px">'+(!m.isDefault ? '<button class="btn" data-make-default="'+m.id+'">Make default</button>' : '')+'</div>'
            +'</div>';
        }).join('');

        $$('[data-make-default]', seatMapsList).forEach(function(btn){
          btn.addEventListener('click', async function(e){
            e.preventDefault();
            var mid = btn.getAttribute('data-make-default');
            if (!mid) return;
            try{
              await j('/admin/seatmaps/' + mid + '/default', {
                method:'PATCH',
                headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ isDefault:true })
              });
              loadSeatMaps();
            }catch(err){
              alert('Failed to update default: ' + (err.message || err));
            }
          });
        });
      }catch(e){
        seatMapsSummary.textContent = 'Failed to load seat maps.';
        seatMapsList.innerHTML = '<div class="error" style="font-size:13px">'+(e.message||e)+'</div>';
      }
    }

    $('#refreshSeatMaps').addEventListener('click', loadSeatMaps);
    $('#editSeatMaps').addEventListener('click', function(){
      go('/admin/ui/shows/' + id + '/seating');
    });

    loadSeatMaps();

    // ticket structure pill toggle (visual only for now)
    var structureGeneral = $('#structureGeneral');
    var structureAllocated = $('#structureAllocated');
    function setStructure(mode){
      if (mode === 'allocated'){
        structureAllocated.style.background = '#111827';
        structureAllocated.style.color = '#ffffff';
        structureGeneral.style.background = '#f9fafb';
        structureGeneral.style.color = '#111827';
      }else{
        structureGeneral.style.background = '#111827';
        structureGeneral.style.color = '#ffffff';
        structureAllocated.style.background = '#f9fafb';
        structureAllocated.style.color = '#111827';
      }
    }
    structureGeneral.addEventListener('click', function(){ setStructure('general'); });
    structureAllocated.addEventListener('click', function(){ setStructure('allocated'); });
    setStructure(show.usesAllocatedSeating ? 'allocated' : 'general');
  }

  // --- SEATING PAGE (temporary stub UI) ---
  async function seatingPage(showId){
    if (!main) return;
    main.innerHTML =
      '<div class="card">'
        +'<div class="header">'
          +'<div class="title">Seating for show '+showId+'</div>'
          +'<button class="btn" id="backToTickets">Back to tickets</button>'
        +'</div>'
        +'<div class="muted" style="margin-bottom:8px">'
          +'This is a placeholder for the full Eventbrite-style seating builder. '
          +'Your existing seatmaps API remains intact – we are just not rendering the editor here yet.'
        +'</div>'
        +'<div class="muted" style="font-size:13px">'
          +'Once we finish the seating-choice wizard and builder, this page will let you create and edit detailed seat layouts, '
          +'attach them to shows, and map ticket types to seats.'
        +'</div>'
      +'</div>';
    var btn = $('#backToTickets');
    if (btn){
      btn.addEventListener('click', function(){
        go('/admin/ui/shows/' + showId + '/tickets');
      });
    }
  }

  // --- CUSTOMERS (MVP structure) ---
  function customers(){
    if (!main) return;

    var currency = new Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP' });
    var dayMs = 24 * 60 * 60 * 1000;

 var customersData = [];
var liveShows = [];
var loadingCustomers = true;

      function computeLiveShows(data){
      try{
        return Array.from(new Set((data || []).flatMap(function(c){
          return (c.orders || []).filter(function(o){ return o && o.isLive; }).map(function(o){ return o.show; });
        }).filter(Boolean)));
      }catch(e){
        return [];
      }
    }

    function normaliseCustomers(items){
      return (items || []).map(function(c){
        var rawOrders = (c.orders || c.orderHistory || c.purchases || []);
        var orders = (rawOrders || []).map(function(o){
          var showTitle = o.show || o.showTitle || (o.event && o.event.title) || o.eventTitle || '';
          var dateVal = o.date || o.createdAt || o.purchasedAt || '';
          var qtyVal = (o.qty != null ? o.qty : (o.quantity != null ? o.quantity : (o.tickets != null ? o.tickets : 0)));
          var totalVal = (o.total != null ? o.total : (o.amount != null ? o.amount : (o.gross != null ? o.gross : 0)));
          var statusVal = o.status || o.orderStatus || '';
          var isLiveVal = (o.isLive != null) ? o.isLive : (o.showStatus ? (String(o.showStatus).toUpperCase() === 'LIVE') : !!o.live);
        return {
  ref: o.ref || o.reference || o.id || o.orderRef || '',
  showId: o.showId || o.showID || o.eventId || '',
  show: showTitle,
  date: dateVal,
  qty: qtyVal,
  total: totalVal,
  status: statusVal,
  isLive: isLiveVal,
  eventType: o.eventType || o.type || '',
  eventCategory: o.eventCategory || o.category || '',
};
        });

        var totalOrders = (c.totalOrders != null) ? c.totalOrders : ((c.ordersCount != null) ? c.ordersCount : orders.length);
        var totalTickets = (c.totalTickets != null) ? c.totalTickets : ((c.ticketsCount != null) ? c.ticketsCount : orders.reduce(function(s,o){ return s + (o.qty || 0); }, 0));
        var totalSpend = (c.totalSpend != null) ? c.totalSpend : ((c.spendTotal != null) ? c.spendTotal : orders.reduce(function(s,o){ return s + (o.total || 0); }, 0));

        var lastPurchase = c.lastPurchase || c.lastPurchaseDate || null;
        if (!lastPurchase && orders.length){
          var dates = orders.map(function(o){ return new Date(o.date); }).filter(function(d){ return !isNaN(d.getTime()); });
          if (dates.length) lastPurchase = new Date(Math.max.apply(null, dates.map(function(d){ return d.getTime(); }))).toISOString().slice(0,10);
        }

        var name = c.name || [c.firstName, c.lastName].filter(Boolean).join(' ');
        return {
          id: c.id || c.customerId || c.publicId || '',
          name: name || 'Customer',
          email: c.email || '',
          phone: c.phone || c.telephone || '',
          totalOrders: totalOrders,
          totalTickets: totalTickets,
          totalSpend: totalSpend,
          lastPurchase: lastPurchase,
          showsBought: c.showsBought,
          lastShow: c.lastShow || c.lastShowTitle,
          loyalty: c.loyalty || c.segment || '',
          marketingConsent: (c.marketingConsent != null) ? c.marketingConsent : !!c.marketingOptIn,
          notes: c.notes || c.note || '',
          tags: c.tags || c.labels || [],
          orders: orders,
        };
      });
    }

    var liveShows = computeLiveShows(customersData);

    async function hydrateCustomers(){
      try{
        var res = await j('/admin/customers');
        var items = (res && (res.items || res.customers || res.data)) || [];
        if (!Array.isArray(items)) items = [];
        if (items.length){
          customersData = normaliseCustomers(items);
          liveShows = computeLiveShows(customersData);
          populateShowFilter();
          renderTable();
        }
      }catch(e){
        // Keep mock customersData as a fallback until the endpoint is live
        console.warn('[admin-ui][customers] hydrate failed', e);
      }
    }


    var state = { search:'', show:'', range:'30', status:'any' };

    main.innerHTML = ''
      + '<div class="card" id="customersCard">'
      +   '<div class="header" style="align-items:flex-start;gap:12px;">'
      +     '<div>'
      +       '<div class="title">Customers</div>'
      +       '<div class="muted">Relationship-focused overview of people who keep coming back.</div>'
      +     '</div>'
      +     '<div class="row" style="gap:8px;flex-wrap:wrap;justify-content:flex-end;">'
      +       '<input id="customerSearch" class="ctl" placeholder="Search name, email, order ref, customer ID" style="min-width:220px;" />'
      +       '<select id="customerShowFilter" class="ctl" style="min-width:190px;"><option value="">All live shows</option></select>'
      +       '<select id="customerDateRange" class="ctl" style="min-width:150px;">'
      +         '<option value="30">Last 30 days</option>'
      +         '<option value="90">Last 90 days</option>'
      +         '<option value="365">Last 365 days</option>'
      +         '<option value="any">All time</option>'
      +       '</select>'
      +       '<select id="customerStatus" class="ctl" style="min-width:170px;">'
      +         '<option value="any">Any status</option>'
      +         '<option value="PAID">Paid</option>'
      +         '<option value="REFUNDED">Refunded</option>'
      +         '<option value="CANCELLED">Cancelled</option>'
      +       '</select>'
      +     '</div>'
      +   '</div>'
      +   '<div class="muted" style="margin:6px 0 10px;">One row per customer, grouped across orders.</div>'
      +   '<div class="table-wrap">'
      +     '<table>'
      +       '<thead><tr>'
      +         '<th>Customer</th>'
      +         '<th>Customer ID</th>'
      +         '<th>Contact</th>'
      +         '<th>Total orders</th>'
      +         '<th>Total tickets</th>'
      +         '<th>Total spend</th>'
      +         '<th>Last purchase</th>'
      +         '<th>Shows bought</th>'
      +         '<th></th>'
      +       '</tr></thead>'
      +       '<tbody id="customerTableBody"></tbody>'
      +     '</table>'
      +   '</div>'
      +   '<div id="customerEmpty" class="muted" style="display:none;margin-top:10px;">No customers match your filters yet.</div>'
      + '</div>'
      + '<div class="drawer-overlay" id="customerDrawerOverlay"></div>'
      + '<aside class="drawer" id="customerDrawer" aria-hidden="true">'
      +   '<div class="drawer-header">'
      +     '<div>'
      +       '<div class="title" id="drawerName">Customer</div>'
      +       '<div class="muted" id="drawerMeta"></div>'
      +     '</div>'
      +     '<button class="drawer-close" id="drawerClose" aria-label="Close profile">Close</button>'
      +   '</div>'
      +   '<div id="customerDrawerBody"></div>'
      + '</aside>';

    var search = $('#customerSearch');
    var showFilter = $('#customerShowFilter');
    var dateRange = $('#customerDateRange');
    var statusFilter = $('#customerStatus');
    var tableBody = $('#customerTableBody');
    var empty = $('#customerEmpty');
    var drawer = $('#customerDrawer');
    var drawerBody = $('#customerDrawerBody');
    var drawerName = $('#drawerName');
    var drawerMeta = $('#drawerMeta');
    var drawerClose = $('#drawerClose');
    var overlay = $('#customerDrawerOverlay');

       function populateShowFilter(){
      if (!showFilter) return;
      var current = showFilter.value || '';
      showFilter.innerHTML = '<option value="">All live shows</option>';
      liveShows.forEach(function(show){
        var opt = document.createElement('option');
        opt.value = show;
        opt.textContent = show;
        showFilter.appendChild(opt);
      });
      if (current && liveShows.indexOf(current) !== -1){
        showFilter.value = current;
      }else if (current){
        state.show = '';
        showFilter.value = '';
      }
    }

    populateShowFilter();

    if (search){
      search.addEventListener('input', function(){ state.search = search.value || ''; renderTable(); });
    }
    if (showFilter){
      showFilter.addEventListener('change', function(){ state.show = showFilter.value || ''; renderTable(); });
    }
    if (dateRange){
      dateRange.addEventListener('change', function(){ state.range = dateRange.value || 'any'; renderTable(); });
    }
    if (statusFilter){
      statusFilter.addEventListener('change', function(){ state.status = statusFilter.value || 'any'; renderTable(); });
    }
    if (drawerClose){
      drawerClose.addEventListener('click', function(){ closeDrawer(); });
    }
    if (overlay){
      overlay.addEventListener('click', function(){ closeDrawer(); });
    }

    function fmtDate(str){
      if (!str) return '-';
      var d = new Date(str);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
    }

    function lastPurchaseDate(c){
      if (!c) return null;
      if (c.lastPurchase) return new Date(c.lastPurchase);
      var dates = (c.orders || []).map(function(o){ return new Date(o.date); }).filter(function(d){ return !isNaN(d.getTime()); });
      if (!dates.length) return null;
      return new Date(Math.max.apply(null, dates.map(function(d){ return d.getTime(); })));
    }

    function firstPurchaseDate(c){
      var dates = (c.orders || []).map(function(o){ return new Date(o.date); }).filter(function(d){ return !isNaN(d.getTime()); });
      if (!dates.length) return null;
      return new Date(Math.min.apply(null, dates.map(function(d){ return d.getTime(); })));
    }

    function countShows(c){
      return new Set((c.orders || []).map(function(o){ return o.show; }).filter(Boolean)).size || (c.showsBought || 0);
    }

    function matchSearch(c){
      if (!state.search) return true;
      var q = state.search.toLowerCase();
      var haystack = [
        c.name,
        c.email,
        c.phone,
        c.id,
        (c.orders || []).map(function(o){ return o.ref + ' ' + o.show; }).join(' '),
      ].join(' ').toLowerCase();
      return haystack.indexOf(q) !== -1;
    }

    function matchShow(c){
      if (!state.show) return true;
      return (c.orders || []).some(function(o){ return o.show === state.show && o.isLive; });
    }

    function matchDateRange(c){
      if (state.range === 'any') return true;
      var last = lastPurchaseDate(c);
      if (!last) return true;
      var days = (Date.now() - last.getTime()) / dayMs;
      return days <= Number(state.range);
    }

    function matchStatus(c){
      if (state.status === 'any') return true;
      return (c.orders || []).some(function(o){ return o.status === state.status; });
    }

    function renderTable(){
      if (!tableBody) return;
      closeMenus();
      var filtered = customersData.filter(function(c){
        return matchSearch(c) && matchShow(c) && matchDateRange(c) && matchStatus(c);
      });
      if (!filtered.length){
        tableBody.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
      }
      if (empty) empty.style.display = 'none';
      tableBody.innerHTML = filtered.map(renderRow).join('');
      attachRowHandlers();
    }

    function renderRow(c){
      var shows = countShows(c);
      var last = lastPurchaseDate(c);
      var loyaltyClass = (c.loyalty || '').toLowerCase();
      return ''
        + '<tr>'
        +   '<td>'
        +     '<div style="font-weight:700;">'+c.name+'</div>'
        +     '<div class="muted" style="font-size:12px;">'+(c.loyalty ? '<span class="loyalty '+loyaltyClass+'">'+c.loyalty+'</span>' : '')+'</div>'
        +   '</td>'
        +   '<td>'+c.id+'</td>'
        +   '<td>'+(c.email || '-')+'<br/><span class="muted" style="font-size:12px;">'+(c.phone || '')+'</span></td>'
        +   '<td>'+c.totalOrders+'</td>'
        +   '<td>'+c.totalTickets+'</td>'
        +   '<td>'+currency.format(c.totalSpend || 0)+'</td>'
        +   '<td>'+fmtDate(last)+'<br/><span class="muted" style="font-size:12px;">'+(c.lastShow || '-')+'</span></td>'
        +   '<td>'+shows+' show'+(shows === 1 ? '' : 's')+'</td>'
        +   '<td>'
        +     '<div class="kebab">'
        +       '<button class="btn" data-kebab="'+c.id+'" aria-haspopup="menu" aria-expanded="false" title="Actions">⋮</button>'
+       '<div class="menu" data-menu="'+c.id+'">'
+         '<a href="#" data-open-profile="'+c.id+'">Open profile</a>'
+         '<a href="#" data-view-orders="'+c.id+'">3 recent orders</a>'
+       '</div>'

        
        +     '</div>'
        +   '</td>'
        + '</tr>';
    }

    function closeMenus(){
      $$('.menu', tableBody).forEach(function(menu){ menu.classList.remove('open'); });
    }

  function attachRowHandlers(){

  // kebab open + flip up near bottom
  $$('[data-kebab]', tableBody).forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();

      var id = btn.getAttribute('data-kebab');
      var menu = tableBody && tableBody.querySelector('[data-menu="'+id+'"]');
      if (!menu) return;

      var wasOpen = menu.classList.contains('open');
      closeMenus();

      if (!wasOpen){
        menu.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');

        // flip up if we’re near the bottom
        requestAnimationFrame(function(){
          var btnRect = btn.getBoundingClientRect();
          var menuHeight = menu.offsetHeight || 160;
          var spaceBelow = window.innerHeight - btnRect.bottom;
          var spaceAbove = btnRect.top;

          menu.classList.toggle('up', spaceBelow < menuHeight && spaceAbove > menuHeight);
        });
      } else {
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  });

  // Open profile -> MUST call renderDrawer (openDrawer isn't in this page)
  $$('[data-open-profile]', tableBody).forEach(function(link){
    link.addEventListener('click', function(e){
      e.preventDefault();

      var id = link.getAttribute('data-open-profile') || '';
      var customer = customersData.find(function(c){ return c.id === id; });

      closeMenus();
      if (customer) renderDrawer(customer);
    });
  });

  // 3 recent orders -> open drawer then jump to Recent purchases section
  $$('[data-view-orders]', tableBody).forEach(function(link){
    link.addEventListener('click', function(e){
      e.preventDefault();

      var id = link.getAttribute('data-view-orders') || '';
      var customer = customersData.find(function(c){ return c.id === id; });

      closeMenus();
      if (!customer) return;

      renderDrawer(customer);

      setTimeout(function(){
        var el = document.getElementById('drawerRecentPurchases');
        if (el) el.scrollIntoView({ behavior:'smooth', block:'start' });
      }, 0);
    });
  });

  // Close menus when clicking elsewhere (bind once)
  if (!window.__customersMenuCloserBound){
    window.__customersMenuCloserBound = true;

    document.addEventListener('click', function(e){
      var t = e.target;
      if (!t || !t.closest || !t.closest('.kebab')) closeMenus();
    });

    document.addEventListener('scroll', function(){ closeMenus(); }, true);
    window.addEventListener('resize', function(){ closeMenus(); });
  }

}

    function loyaltyLabel(c){
      var cls = (c.loyalty || '').toLowerCase();
      var label = c.loyalty || 'New';
      return '<span class="loyalty '+cls+'">'+label+'</span>';
    }

    function humaniseKey(s){
  s = String(s || '').trim();
  if (!s) return '';
  return s
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, function(m){ return m.toUpperCase(); });
}

function computeInterestCounts(customer){
  var orders = (customer && customer.orders) ? customer.orders : [];
  var seen = Object.create(null);
  var counts = Object.create(null);

  orders.forEach(function(o){
    if (!o) return;

    var t = String(o.eventType || '').trim();
    var c = String(o.eventCategory || '').trim();
    if (!t && !c) return;

    // count unique shows (not multiple orders) where possible
    var sid = String(o.showId || '').trim();
    var uniq = (sid || String(o.ref || '')) + '|' + t + '|' + c;
    if (seen[uniq]) return;
    seen[uniq] = true;

    var key = (t || 'Other') + '|' + (c || 'Other');
    counts[key] = (counts[key] || 0) + 1;
  });

  return Object.keys(counts).map(function(key){
    var parts = key.split('|');
    return { eventType: parts[0], eventCategory: parts[1], count: counts[key] };
  }).sort(function(a,b){
    return (b.count || 0) - (a.count || 0);
  });
}

function renderInterests(customer){
  var items = computeInterestCounts(customer);
  if (!items.length) return '';

  var rows = items.map(function(x, idx){
    var label = humaniseKey(x.eventType) + ' · ' + humaniseKey(x.eventCategory);
    var border = (idx === items.length - 1) ? '' : 'border-bottom:1px solid var(--border);';
    return ''
      + '<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;'+border+'">'
      +   '<div style="font-weight:650;">'+label+'</div>'
      +   '<div class="muted" style="font-weight:700;">'+(x.count || 0)+'</div>'
      + '</div>';
  }).join('');

  return ''
    + '<div class="mini-card">'
    +   '<div class="muted" style="margin-bottom:6px;">Category / sub-category breakdown</div>'
    +   rows
    + '</div>';
}


    function renderOrder(o){
      var statusClass = (o.status || '').toLowerCase();
      return ''
        + '<div class="mini-card">'
        +   '<div class="row" style="justify-content:space-between;align-items:flex-start;">'
        +     '<div>'
        +       '<div style="font-weight:700;">'+o.show+'</div>'
        +       '<div class="muted" style="font-size:12px;">'+fmtDate(o.date)+' · '+(o.qty || 0)+' tickets</div>'
        +       '<div class="muted" style="font-size:12px;">Order '+o.ref+'</div>'
        +     '</div>'
        +     '<div style="text-align:right;">'
        +       '<div>'+currency.format(o.total || 0)+'</div>'
        +       '<div><span class="status-badge '+statusClass+'">'+(o.status || '').toLowerCase()+'</span></div>'
        +     '</div>'
        +   '</div>'
        +   '<div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap;">'
        +     '<button class="btn p" data-order-action="reissue" data-order-ref="'+o.ref+'">Reissue tickets email</button>'
        +     '<button class="btn p" data-order-action="refund" data-order-ref="'+o.ref+'">Refund</button>'
        +     '<button class="btn" data-order-action="view" data-order-ref="'+o.ref+'">View order</button>'
        +   '</div>'
        + '</div>';
    }

    function renderDrawer(customer){
      if (!drawerBody || !drawer || !drawerName || !drawerMeta) return;
      var first = firstPurchaseDate(customer);
      var last = lastPurchaseDate(customer);
      var orders = (customer.orders || []).slice().sort(function(a,b){
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      drawerName.textContent = customer.name;
      drawerMeta.innerHTML = '' + customer.id + ' · ' + (customer.email || '') + (customer.phone ? ' · ' + customer.phone : '');

      var shows = countShows(customer);
      var orderList = orders.map(renderOrder).join('');
      var tags = (customer.tags || []).map(function(t){ return '<span class="tag">'+t+'</span>'; }).join(' ');

      drawerBody.innerHTML = ''
        + '<div class="drawer-section">'
        +   '<div class="row" style="justify-content:space-between;align-items:center;">'
        +     '<div class="title" style="margin:0;">Overview</div>'
        +     loyaltyLabel(customer)
        +   '</div>'
        +   '<div class="mini-grid" style="margin-top:8px;">'
        +     '<div class="mini-card"><div class="muted">Total spend</div><div style="font-weight:800;">'+currency.format(customer.totalSpend || 0)+'</div></div>'
        +     '<div class="mini-card"><div class="muted">Orders</div><div style="font-weight:800;">'+customer.totalOrders+'</div></div>'
        +     '<div class="mini-card"><div class="muted">Tickets</div><div style="font-weight:800;">'+customer.totalTickets+'</div></div>'
        +     '<div class="mini-card"><div class="muted">Shows bought</div><div style="font-weight:800;">'+shows+'</div></div>'
        +   '</div>'
        +   '<div class="mini-grid" style="margin-top:8px;">'
        +     '<div class="mini-card"><div class="muted">First purchase</div><div style="font-weight:700;">'+fmtDate(first)+'</div></div>'
        +   +     '<div class="mini-card"><div class="muted">Last show</div><div style="font-weight:700;">'+(customer.lastShow || '-')+'</div></div>'
+   '</div>'
+ '</div>'

+ '<div class="drawer-section">'
+   '<div class="title" style="margin-bottom:6px;">Event interests</div>'
+   (renderInterests(customer) || '<div class="muted">No event categories captured yet.</div>')
+ '</div>'

+ '<div id="drawerRecentPurchases" class="drawer-section">'
+   '<div class="title">Recent purchases</div>'

        +   '<div class="muted" style="margin-bottom:6px;">Orders list with quick actions.</div>'
        +   (orderList || '<div class="muted">No orders yet.</div>')
        + '</div>'

        + '<div class="drawer-section">'
        +   '<div class="title" style="margin-bottom:6px;">Notes & tags</div>'
        +   (customer.notes ? '<div class="mini-card">'+customer.notes+'</div>' : '<div class="muted">No notes captured yet.</div>')
        +   (tags ? '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">'+tags+'</div>' : '')
        + '</div>'

        + '<div class="drawer-section">'
        +   '<div class="title" style="margin-bottom:6px;">Purchase history</div>'
        +   '<div class="mini-card">'
        +     '<div class="muted">Shows attended / purchased over time</div>'
        +     '<div style="margin-top:6px;">'+orders.map(function(o){ return '<div style="display:flex;justify-content:space-between;gap:6px;">'
        +       '<div>'+o.show+'</div><div class="muted" style="font-size:12px;">'+fmtDate(o.date)+'</div>'
        +     '</div>'; }).join('')+'</div>'
        +   '</div>'
        + '</div>';

      drawer.classList.add('open');
      if (overlay) overlay.classList.add('open');
      drawer.setAttribute('aria-hidden', 'false');
    }

    function closeDrawer(){
      if (drawer) drawer.classList.remove('open');
      if (overlay) overlay.classList.remove('open');
      if (drawer) drawer.setAttribute('aria-hidden', 'true');
    }

        if (drawerBody){
      drawerBody.addEventListener('click', async function(e){
        var btn = e.target && e.target.closest('[data-order-action]');
        if (!btn) return;

        e.preventDefault();

        var action = btn.getAttribute('data-order-action');
        var ref = btn.getAttribute('data-order-ref');

        if (!action || !ref){
          alert('Missing order reference.');
          return;
        }

        // --- REISSUE ---
        if (action === 'reissue'){
          if (!confirm('Reissue tickets email for order ' + ref + '?')) return;

          var prevText = btn.textContent;
          btn.disabled = true;
          btn.textContent = 'Sending…';

          try{
            var r = await j(
              '/admin/orders/' + encodeURIComponent(ref) + '/reissue-email',
              {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body: JSON.stringify({})
              }
            );

            alert((r && r.message) ? r.message : 'Reissue email sent.');
          }catch(err){
            alert('Reissue failed: ' + (err.message || err));
          }finally{
            btn.disabled = false;
            btn.textContent = prevText;
          }

          return;
        }

        // Keep other actions as placeholders for now
        alert((action ? action.toUpperCase() : 'Action') + ' for ' + (ref || 'order') + ' coming soon.');
      });
    }

    renderTable();
    hydrateCustomers();
  }

  // --- OTHER SIMPLE PAGES ---
  function debounce(fn, wait){
    var t;
    return function(){
      var args = arguments;
      clearTimeout(t);
      t = setTimeout(function(){ fn.apply(null, args); }, wait);
    };
  }

  function orders(){
    if (!main) return;
    main.innerHTML = ''
      + '<div class="card">'
      +   '<div class="orders-toolbar">'
      +     '<div>'
      +       '<div class="title">Orders</div>'
      +       '<div class="muted">All orders across your shows with server-side filters, KPIs, and bulk actions.</div>'
      +     '</div>'
      +     '<div class="row" style="gap:8px;align-items:center;">'
      +       '<button class="btn" id="ordersRefreshBtn">Refresh</button>'
      +       '<div class="orders-columns">'
      +         '<button class="btn" id="ordersColumnsBtn">Columns</button>'
      +         '<div class="orders-columns-panel" id="ordersColumnsPanel"></div>'
      +       '</div>'
      +     '</div>'
      +   '</div>'

      +   '<div class="orders-filters">'
      +     '<label>Show<select id="ordersFilterShow"><option value="">All shows</option></select></label>'
      +     '<label>Venue<select id="ordersFilterVenue"><option value="">All venues</option></select></label>'
      +     '<label>Order date from<input id="ordersFilterOrderFrom" type="date" /></label>'
      +     '<label>Order date to<input id="ordersFilterOrderTo" type="date" /></label>'
      +     '<label>Show date from<input id="ordersFilterShowFrom" type="date" /></label>'
      +     '<label>Show date to<input id="ordersFilterShowTo" type="date" /></label>'
      +     '<label>Status<select id="ordersFilterStatus">'
      +       '<option value="">All statuses</option>'
      +       '<option value="PENDING">Pending</option>'
      +       '<option value="PAID">Paid</option>'
      +       '<option value="REFUNDED">Refunded</option>'
      +       '<option value="CANCELLED">Cancelled</option>'
      +     '</select></label>'
      +     '<label>Email delivery<select id="ordersFilterEmail">'
      +       '<option value="">Any</option>'
      +       '<option value="SENT">Sent</option>'
      +       '<option value="FAILED">Failed</option>'
      +       '<option value="SKIPPED">Skipped</option>'
      +       '<option value="UNKNOWN">Unknown</option>'
      +     '</select></label>'
      +     '<label>PDF attached<select id="ordersFilterPdf">'
      +       '<option value="">Any</option>'
      +       '<option value="attached">Attached</option>'
      +       '<option value="missing">Missing</option>'
      +     '</select></label>'
      +     '<label>Ticket type<select id="ordersFilterTicketType"><option value="">All ticket types</option></select></label>'
      +     '<label>Search<input id="ordersFilterSearch" placeholder="Name, email, order ref, Stripe ref" /></label>'
      +     '<label>Per page<select id="ordersFilterTake">'
      +       '<option value="10">10</option>'
      +       '<option value="25" selected>25</option>'
      +       '<option value="50">50</option>'
      +       '<option value="100">100</option>'
      +     '</select></label>'
      +   '</div>'

      +   '<div class="orders-kpis" id="ordersKpis"></div>'

      +   '<div class="orders-actions">'
      +     '<label style="display:flex;align-items:center;gap:6px;font-weight:700;">'
      +       '<input type="checkbox" id="ordersSelectAll" /> Select page'
      +     '</label>'
      +     '<select id="ordersBulkAction">'
      +       '<option value="">Bulk actions</option>'
      +       '<option value="resend_emails">Resend emails</option>'
      +       '<option value="apply_tags">Apply tags</option>'
      +       '<option value="add_note">Add internal note</option>'
      +     '</select>'
      +     '<input id="ordersBulkTags" class="bulk-input" placeholder="Tags (comma-separated)" style="display:none;" />'
      +     '<input id="ordersBulkNote" class="bulk-input" placeholder="Internal note" style="display:none;" />'
      +     '<button class="btn p" id="ordersBulkApply">Apply</button>'
      +     '<button class="btn" id="ordersExportDoor">Export door list</button>'
      +     '<button class="btn" id="ordersExportFinance">Export finance CSV</button>'
      +   '</div>'

      +   '<div class="orders-table-wrap">'
      +     '<table class="orders-table" id="ordersTable">'
      +       '<thead>'
      +         '<tr>'
      +           '<th data-col="select" class="col-select"></th>'
      +           '<th data-col="order" data-sort="createdAt">Order</th>'
      +           '<th data-col="buyer" data-sort="email">Buyer</th>'
      +           '<th data-col="show" data-sort="showDate">Show</th>'
      +           '<th data-col="venue">Venue</th>'
      +           '<th data-col="showDate" data-sort="showDate">Show date</th>'
      +           '<th data-col="createdAt" data-sort="createdAt">Ordered</th>'
      +           '<th data-col="status" data-sort="status">Status</th>'
      +           '<th data-col="delivery">Delivery</th>'
      +           '<th data-col="tickets">Tickets</th>'
      +           '<th data-col="gross" data-sort="amount">Gross</th>'
      +           '<th data-col="fees">Fees</th>'
      +           '<th data-col="net">Net</th>'
      +           '<th data-col="tags">Tags</th>'
      +         '</tr>'
      +       '</thead>'
      +       '<tbody id="ordersTbody"></tbody>'
      +     '</table>'
      +   '</div>'

      +   '<div class="orders-pagination" id="ordersPagination"></div>'
      + '</div>'
      + '<div class="orders-drawer-backdrop" id="ordersDrawerBackdrop"></div>'
      + '<div class="orders-drawer" id="ordersDrawer"></div>';

    var filters = {
      showId: '',
      venueId: '',
      orderFrom: '',
      orderTo: '',
      showFrom: '',
      showTo: '',
      status: '',
      emailStatus: '',
      pdfStatus: '',
      ticketTypeId: '',
      q: '',
      take: 25,
    };

    var state = {
      page: 1,
      sortBy: 'createdAt',
      sortDir: 'desc',
      total: 0,
      items: [],
      selected: new Set(),
      filterOptionsLoaded: false,
    };

    var columnDefaults = [
      'select',
      'order',
      'buyer',
      'show',
      'venue',
      'showDate',
      'createdAt',
      'status',
      'delivery',
      'tickets',
      'gross',
      'fees',
      'net',
      'tags',
    ];

    var columnLabels = {
      order: 'Order',
      buyer: 'Buyer',
      show: 'Show',
      venue: 'Venue',
      showDate: 'Show date',
      createdAt: 'Ordered',
      status: 'Status',
      delivery: 'Delivery',
      tickets: 'Tickets',
      gross: 'Gross',
      fees: 'Fees',
      net: 'Net',
      tags: 'Tags',
    };

    function loadColumns(){
      try{
        var raw = localStorage.getItem('ordersColumns');
        var parsed = raw ? JSON.parse(raw) : null;
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }catch(e){}
      return columnDefaults.slice();
    }

    function saveColumns(cols){
      try{ localStorage.setItem('ordersColumns', JSON.stringify(cols || [])); }catch(e){}
    }

    var visibleColumns = loadColumns();

    var els = {
      show: $('#ordersFilterShow'),
      venue: $('#ordersFilterVenue'),
      orderFrom: $('#ordersFilterOrderFrom'),
      orderTo: $('#ordersFilterOrderTo'),
      showFrom: $('#ordersFilterShowFrom'),
      showTo: $('#ordersFilterShowTo'),
      status: $('#ordersFilterStatus'),
      emailStatus: $('#ordersFilterEmail'),
      pdfStatus: $('#ordersFilterPdf'),
      ticketType: $('#ordersFilterTicketType'),
      search: $('#ordersFilterSearch'),
      take: $('#ordersFilterTake'),
      refresh: $('#ordersRefreshBtn'),
      tbody: $('#ordersTbody'),
      kpis: $('#ordersKpis'),
      pagination: $('#ordersPagination'),
      selectAll: $('#ordersSelectAll'),
      bulkAction: $('#ordersBulkAction'),
      bulkTags: $('#ordersBulkTags'),
      bulkNote: $('#ordersBulkNote'),
      bulkApply: $('#ordersBulkApply'),
      exportDoor: $('#ordersExportDoor'),
      exportFinance: $('#ordersExportFinance'),
      columnsBtn: $('#ordersColumnsBtn'),
      columnsPanel: $('#ordersColumnsPanel'),
      drawer: $('#ordersDrawer'),
      drawerBackdrop: $('#ordersDrawerBackdrop'),
    };

    function fmtMoney(pence){
      var val = typeof pence === 'number' ? pence : 0;
      return '£' + (val / 100).toFixed(2);
    }

    function fmtDateTime(value){
      if (!value) return '—';
      var d = new Date(value);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    }

    function fmtDate(value){
      if (!value) return '—';
      var d = new Date(value);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
    }

    function toCsvParam(obj){
      var params = new URLSearchParams();
      Object.keys(obj || {}).forEach(function(key){
        var val = obj[key];
        if (val === undefined || val === null || val === '') return;
        params.set(key, String(val));
      });
      return params.toString();
    }

    function applyVisibleColumns(){
      var cols = visibleColumns;
      $$('#ordersTable [data-col]').forEach(function(cell){
        var col = cell.getAttribute('data-col');
        if (!col) return;
        var hidden = cols.indexOf(col) === -1;
        cell.classList.toggle('col-hidden', hidden);
      });
    }

    function renderColumnChooser(){
      if (!els.columnsPanel) return;
      var html = '';
      columnDefaults.forEach(function(col){
        if (col === 'select') return;
        var checked = visibleColumns.indexOf(col) !== -1 ? 'checked' : '';
        html += '<label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-weight:600;">'
          + '<input type="checkbox" data-col="' + col + '" ' + checked + ' />'
          + escapeHtml(columnLabels[col] || col)
          + '</label>';
      });
      els.columnsPanel.innerHTML = html;
      $$('input[data-col]', els.columnsPanel).forEach(function(input){
        input.addEventListener('change', function(){
          var col = input.getAttribute('data-col');
          if (!col) return;
          var idx = visibleColumns.indexOf(col);
          if (input.checked){
            if (idx === -1) visibleColumns.push(col);
          }else{
            if (idx !== -1) visibleColumns.splice(idx, 1);
          }
          saveColumns(visibleColumns);
          applyVisibleColumns();
        });
      });
    }

    function toggleColumnsPanel(show){
      if (!els.columnsPanel) return;
      var open = els.columnsPanel.classList.contains('open');
      if (typeof show === 'boolean') open = !show;
      els.columnsPanel.classList.toggle('open', !open);
    }

    if (els.columnsBtn && els.columnsPanel){
      els.columnsBtn.addEventListener('click', function(e){
        e.stopPropagation();
        toggleColumnsPanel();
      });
      document.addEventListener('click', function(e){
        if (!els.columnsPanel || !els.columnsPanel.classList.contains('open')) return;
        if (els.columnsPanel.contains(e.target) || els.columnsBtn.contains(e.target)) return;
        els.columnsPanel.classList.remove('open');
      });
    }

    function syncFilters(){
      if (els.show) els.show.value = filters.showId || '';
      if (els.venue) els.venue.value = filters.venueId || '';
      if (els.orderFrom) els.orderFrom.value = filters.orderFrom || '';
      if (els.orderTo) els.orderTo.value = filters.orderTo || '';
      if (els.showFrom) els.showFrom.value = filters.showFrom || '';
      if (els.showTo) els.showTo.value = filters.showTo || '';
      if (els.status) els.status.value = filters.status || '';
      if (els.emailStatus) els.emailStatus.value = filters.emailStatus || '';
      if (els.pdfStatus) els.pdfStatus.value = filters.pdfStatus || '';
      if (els.ticketType) els.ticketType.value = filters.ticketTypeId || '';
      if (els.search) els.search.value = filters.q || '';
      if (els.take) els.take.value = String(filters.take || 25);
    }

    function buildQuery(includeFilters){
      var params = {
        page: state.page,
        take: filters.take || 25,
        sortBy: state.sortBy,
        sortDir: state.sortDir,
        showId: filters.showId,
        venueId: filters.venueId,
        orderFrom: filters.orderFrom,
        orderTo: filters.orderTo,
        showFrom: filters.showFrom,
        showTo: filters.showTo,
        status: filters.status,
        emailStatus: filters.emailStatus,
        pdfStatus: filters.pdfStatus,
        ticketTypeId: filters.ticketTypeId,
        q: filters.q,
        includeFilters: includeFilters ? '1' : '',
      };
      return toCsvParam(params);
    }

    function renderKpis(kpis){
      if (!els.kpis) return;
      var data = kpis || {};
      var items = [
        { label:'Orders', value: data.orders || 0 },
        { label:'Tickets sold', value: data.ticketsSold || 0 },
        { label:'Gross', value: fmtMoney(data.gross || 0) },
        { label:'Fees', value: fmtMoney(data.fees || 0) },
        { label:'Net', value: fmtMoney(data.net || 0) },
        { label:'Refunds', value: fmtMoney(data.refunds || 0) },
      ];
      els.kpis.innerHTML = items.map(function(item){
        return '<div class="orders-kpi">'
          + '<div class="label">' + escapeHtml(item.label) + '</div>'
          + '<div class="value">' + escapeHtml(String(item.value)) + '</div>'
          + '</div>';
      }).join('');
    }

    function renderTable(items){
      if (!els.tbody) return;
      els.tbody.innerHTML = '';
      if (!items || !items.length){
        els.tbody.innerHTML = '<tr><td colspan="14" class="muted">No orders found.</td></tr>';
        return;
      }
      var rows = items.map(function(order){
        var buyerName = [order.buyerFirstName, order.buyerLastName].filter(Boolean).join(' ').trim();
        var buyerDisplay = buyerName || order.email || '—';
        var showTitle = order.show && order.show.title ? order.show.title : 'Untitled show';
        var showDate = order.show && order.show.date ? order.show.date : null;
        var venueName = order.show && order.show.venue && order.show.venue.name ? order.show.venue.name : '—';
        var status = String(order.status || 'PENDING').toLowerCase();
        var deliveryStatus = String(order.emailDeliveryStatus || 'UNKNOWN').toLowerCase();
        var pdfAttached = order.emailPdfAttached === true;
        var ticketCount = order.ticketCount || 0;
        var tags = Array.isArray(order.tags) ? order.tags : [];
        var fees = (order.platformFeePence || 0) + (order.paymentFeePence || 0);
        var net = typeof order.netPayoutPence === 'number'
          ? order.netPayoutPence
          : (order.amountPence || 0) - fees;

        var tagHtml = tags.length
          ? tags.map(function(tag){ return '<span class="orders-tag">' + escapeHtml(tag) + '</span>'; }).join('')
          : '<span class="muted">—</span>';

        return ''
          + '<tr data-order-id="' + escapeHtml(order.id) + '">'
          +   '<td data-col="select"><input type="checkbox" class="order-select" data-id="' + escapeHtml(order.id) + '" /></td>'
          +   '<td data-col="order"><div style="font-weight:700;">' + escapeHtml(order.id) + '</div></td>'
          +   '<td data-col="buyer"><div style="font-weight:700;">' + escapeHtml(buyerDisplay) + '</div>'
          +     (order.email && buyerName ? '<div class="muted">' + escapeHtml(order.email) + '</div>' : '') + '</td>'
          +   '<td data-col="show"><div style="font-weight:700;">' + escapeHtml(showTitle) + '</div>'
          +     '<div class="muted">' + escapeHtml(order.show && order.show.id ? order.show.id : '') + '</div></td>'
          +   '<td data-col="venue">' + escapeHtml(venueName) + '</td>'
          +   '<td data-col="showDate">' + escapeHtml(fmtDate(showDate)) + '</td>'
          +   '<td data-col="createdAt">' + escapeHtml(fmtDateTime(order.createdAt)) + '</td>'
          +   '<td data-col="status"><span class="orders-status ' + escapeHtml(status) + '">' + escapeHtml(order.status || '') + '</span></td>'
          +   '<td data-col="delivery">'
          +     '<div class="orders-delivery">'
          +       '<span class="pill ' + escapeHtml(deliveryStatus) + '">📧 ' + escapeHtml((order.emailDeliveryStatus || 'UNKNOWN')) + '</span>'
          +       '<span class="pill ' + (pdfAttached ? 'good' : 'bad') + '">PDF ' + (pdfAttached ? 'Attached' : 'Missing') + '</span>'
          +     '</div>'
          +   '</td>'
          +   '<td data-col="tickets">' + escapeHtml(String(ticketCount)) + '</td>'
          +   '<td data-col="gross">' + escapeHtml(fmtMoney(order.amountPence || 0)) + '</td>'
          +   '<td data-col="fees">' + escapeHtml(fmtMoney(fees)) + '</td>'
          +   '<td data-col="net">' + escapeHtml(fmtMoney(net)) + '</td>'
          +   '<td data-col="tags">' + tagHtml + '</td>'
          + '</tr>';
      }).join('');
      els.tbody.innerHTML = rows;

      $$('.order-select', els.tbody).forEach(function(input){
        input.addEventListener('change', function(e){
          var id = input.getAttribute('data-id');
          if (!id) return;
          if (input.checked) state.selected.add(id);
          else state.selected.delete(id);
        });
      });

      $$('#ordersTbody tr').forEach(function(row){
        row.addEventListener('click', function(e){
          if (e.target && (e.target.tagName === 'INPUT' || e.target.closest('button'))) return;
          var id = row.getAttribute('data-order-id');
          if (!id) return;
          openDrawer(id);
        });
      });

      if (els.selectAll){
        els.selectAll.checked = false;
      }

      applyVisibleColumns();
    }

    function renderPagination(){
      if (!els.pagination) return;
      var total = state.total || 0;
      var totalPages = Math.max(1, Math.ceil(total / (filters.take || 25)));
      var canPrev = state.page > 1;
      var canNext = state.page < totalPages;
      els.pagination.innerHTML = ''
        + '<div class="muted">Page ' + state.page + ' of ' + totalPages + ' • ' + total + ' orders</div>'
        + '<div class="row" style="gap:8px;">'
        +   '<button class="btn" id="ordersPrev" ' + (canPrev ? '' : 'disabled') + '>Prev</button>'
        +   '<button class="btn" id="ordersNext" ' + (canNext ? '' : 'disabled') + '>Next</button>'
        + '</div>';
      var prevBtn = $('#ordersPrev');
      var nextBtn = $('#ordersNext');
      if (prevBtn){
        prevBtn.addEventListener('click', function(){
          if (!canPrev) return;
          state.page -= 1;
          loadOrders(false);
        });
      }
      if (nextBtn){
        nextBtn.addEventListener('click', function(){
          if (!canNext) return;
          state.page += 1;
          loadOrders(false);
        });
      }
    }

    async function loadOrders(includeFilters){
      if (!els.tbody) return;
      els.tbody.innerHTML =
        '<tr><td colspan="14"><div class="loading-strip" aria-label="Loading orders"></div></td></tr>';
      var qs = buildQuery(includeFilters);
      try{
        var res = await j('/admin/api/orders?' + qs);
        state.items = (res && res.items) || [];
        state.total = res.total || 0;
        state.selected = new Set();
        renderKpis(res.kpis);
        renderTable(state.items);
        renderPagination();
        if (includeFilters && res.filters){
          hydrateFilterOptions(res.filters);
          state.filterOptionsLoaded = true;
        }
      }catch(e){
        els.tbody.innerHTML = '<tr><td colspan="14" class="error">Failed to load orders: ' + escapeHtml(e.message || e) + '</td></tr>';
      }
    }

    function hydrateFilterOptions(data){
      if (!data) return;
      if (els.show && Array.isArray(data.shows)){
        els.show.innerHTML = '<option value="">All shows</option>'
          + data.shows.map(function(show){
            var label = (show.title || 'Untitled') + (show.date ? (' • ' + fmtDate(show.date)) : '');
            return '<option value="' + escapeHtml(show.id) + '">' + escapeHtml(label) + '</option>';
          }).join('');
      }
      if (els.venue && Array.isArray(data.venues)){
        els.venue.innerHTML = '<option value="">All venues</option>'
          + data.venues.map(function(venue){
            var label = (venue.name || 'Venue') + (venue.city ? (' • ' + venue.city) : '');
            return '<option value="' + escapeHtml(venue.id) + '">' + escapeHtml(label) + '</option>';
          }).join('');
      }
      if (els.ticketType && Array.isArray(data.ticketTypes)){
        els.ticketType.innerHTML = '<option value="">All ticket types</option>'
          + data.ticketTypes.map(function(tt){
            var label = tt.name || 'Ticket type';
            if (tt.showTitle) label += ' • ' + tt.showTitle;
            return '<option value="' + escapeHtml(tt.id) + '">' + escapeHtml(label) + '</option>';
          }).join('');
      }
      syncFilters();
    }

    function onFilterChange(){
      state.page = 1;
      filters.showId = els.show && els.show.value || '';
      filters.venueId = els.venue && els.venue.value || '';
      filters.orderFrom = els.orderFrom && els.orderFrom.value || '';
      filters.orderTo = els.orderTo && els.orderTo.value || '';
      filters.showFrom = els.showFrom && els.showFrom.value || '';
      filters.showTo = els.showTo && els.showTo.value || '';
      filters.status = els.status && els.status.value || '';
      filters.emailStatus = els.emailStatus && els.emailStatus.value || '';
      filters.pdfStatus = els.pdfStatus && els.pdfStatus.value || '';
      filters.ticketTypeId = els.ticketType && els.ticketType.value || '';
      filters.q = els.search && els.search.value.trim() || '';
      filters.take = els.take ? Number(els.take.value) : 25;
      loadOrders(false);
    }

    function currentSelectedIds(){
      return Array.from(state.selected || []);
    }

    async function applyBulkAction(){
      var action = els.bulkAction && els.bulkAction.value;
      if (!action) return alert('Select a bulk action');
      var ids = currentSelectedIds();
      if (!ids.length) return alert('Select at least one order');

      var payload = { action: action, orderIds: ids };
      if (action === 'apply_tags'){
        var tags = els.bulkTags && els.bulkTags.value ? els.bulkTags.value.split(',').map(function(t){ return t.trim(); }).filter(Boolean) : [];
        if (!tags.length) return alert('Enter at least one tag');
        payload.tags = tags;
        payload.mode = 'append';
      }
      if (action === 'add_note'){
        var note = els.bulkNote && els.bulkNote.value ? els.bulkNote.value.trim() : '';
        if (!note) return alert('Enter a note');
        payload.note = note;
      }

      try{
        await j('/admin/api/orders/bulk', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(payload)
        });
        state.selected = new Set();
        if (els.bulkTags) els.bulkTags.value = '';
        if (els.bulkNote) els.bulkNote.value = '';
        loadOrders(false);
      }catch(e){
        alert('Bulk action failed: ' + (e.message || e));
      }
    }

    function exportCsv(type){
      var params = buildQuery(false);
      var ids = currentSelectedIds();
      if (ids.length){
        params += (params ? '&' : '') + 'orderIds=' + encodeURIComponent(ids.join(','));
      }
      params += (params ? '&' : '') + 'type=' + encodeURIComponent(type);
      window.location.href = '/admin/api/orders/export?' + params;
    }

    function updateBulkInputs(){
      var action = els.bulkAction && els.bulkAction.value;
      if (els.bulkTags) els.bulkTags.style.display = action === 'apply_tags' ? 'inline-flex' : 'none';
      if (els.bulkNote) els.bulkNote.style.display = action === 'add_note' ? 'inline-flex' : 'none';
    }

    if (els.selectAll){
      els.selectAll.addEventListener('change', function(){
        var checked = els.selectAll.checked;
        state.selected = new Set();
        $$('.order-select', els.tbody).forEach(function(input){
          input.checked = checked;
          if (checked && input.getAttribute('data-id')) state.selected.add(input.getAttribute('data-id'));
        });
      });
    }

    if (els.bulkAction) els.bulkAction.addEventListener('change', updateBulkInputs);
    if (els.bulkApply) els.bulkApply.addEventListener('click', applyBulkAction);
    if (els.exportDoor) els.exportDoor.addEventListener('click', function(){ exportCsv('door'); });
    if (els.exportFinance) els.exportFinance.addEventListener('click', function(){ exportCsv('finance'); });

    if (els.refresh) els.refresh.addEventListener('click', function(){ loadOrders(false); });

    var filterInputs = [
      els.show, els.venue, els.orderFrom, els.orderTo,
      els.showFrom, els.showTo, els.status, els.emailStatus,
      els.pdfStatus, els.ticketType, els.take
    ];
    filterInputs.forEach(function(input){
      if (!input) return;
      input.addEventListener('change', onFilterChange);
    });
    if (els.search){
      els.search.addEventListener('input', debounce(onFilterChange, 300));
    }

    $$('#ordersTable th[data-sort]').forEach(function(th){
      th.addEventListener('click', function(){
        var sortKey = th.getAttribute('data-sort');
        if (!sortKey) return;
        if (state.sortBy === sortKey){
          state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        }else{
          state.sortBy = sortKey;
          state.sortDir = 'desc';
        }
        loadOrders(false);
      });
    });

    function openDrawer(orderId){
      if (!els.drawer || !els.drawerBackdrop) return;
      els.drawer.classList.add('open');
      els.drawerBackdrop.classList.add('open');
      renderDrawerLoading();
      loadOrderDetail(orderId);
    }

    function closeDrawer(){
      if (!els.drawer || !els.drawerBackdrop) return;
      els.drawer.classList.remove('open');
      els.drawerBackdrop.classList.remove('open');
    }

    function renderDrawerLoading(){
      if (!els.drawer) return;
      els.drawer.innerHTML = '<div class="row" style="justify-content:space-between;align-items:center;">'
        + '<h3>Order</h3>'
        + '<button class="close-btn" id="ordersDrawerClose">Close</button>'
        + '</div>'
        + '<div class="muted" style="margin-top:10px;">Loading order details…</div>';
      var closeBtn = $('#ordersDrawerClose');
      if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    }

    async function loadOrderDetail(orderId){
      if (!els.drawer) return;
      try{
        var res = await j('/admin/api/orders/' + encodeURIComponent(orderId));
        renderDrawer(res.order, res.timeline || []);
      }catch(e){
        els.drawer.innerHTML = '<div class="row" style="justify-content:space-between;align-items:center;">'
          + '<h3>Order</h3>'
          + '<button class="close-btn" id="ordersDrawerClose">Close</button>'
          + '</div>'
          + '<div class="error" style="margin-top:10px;">Failed to load order: ' + escapeHtml(e.message || e) + '</div>';
        var closeBtn = $('#ordersDrawerClose');
        if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
      }
    }

    function renderDrawer(order, timeline){
      if (!els.drawer) return;
      if (!order){
        renderDrawerLoading();
        return;
      }
      var buyerName = [order.buyerFirstName, order.buyerLastName].filter(Boolean).join(' ').trim();
      var tags = Array.isArray(order.tags) ? order.tags : [];
      var tickets = order.tickets || [];
      var fees = (order.platformFeePence || 0) + (order.paymentFeePence || 0);
      var net = typeof order.netPayoutPence === 'number'
        ? order.netPayoutPence
        : (order.amountPence || 0) - fees;

      var ticketHtml = tickets.length
        ? tickets.map(function(t){
            var seat = t.seatRef || t.seatId || 'Unallocated';
            var holder = t.holderName ? ' • ' + t.holderName : '';
            var type = t.ticketType && t.ticketType.name ? t.ticketType.name : 'Ticket';
            return '<div class="row" style="justify-content:space-between;gap:8px;">'
              + '<div><strong>' + escapeHtml(type) + '</strong><div class="muted">Seat: ' + escapeHtml(seat) + holder + '</div></div>'
              + '<div class="muted">#' + escapeHtml(t.serial || t.id || '') + '</div>'
              + '</div>';
          }).join('')
        : '<div class="muted">No tickets on this order.</div>';

      var refunds = order.refunds || [];
      var refundHtml = refunds.length
        ? refunds.map(function(r){
            var amt = fmtMoney(r.amountPence || r.amount || 0);
            return '<div class="row" style="justify-content:space-between;gap:8px;">'
              + '<div>' + escapeHtml(r.reason || 'Refund') + '</div>'
              + '<div>' + escapeHtml(amt) + '</div>'
              + '</div>';
          }).join('')
        : '<div class="muted">No refunds recorded.</div>';

      var timelineHtml = timeline.length
        ? timeline.map(function(item){
            return '<div style="border-bottom:1px solid var(--border);padding:8px 0;">'
              + '<div style="font-weight:700;">' + escapeHtml(item.title || item.action || 'Update') + '</div>'
              + '<div class="muted">' + escapeHtml(item.detail || '') + '</div>'
              + '<div class="muted" style="font-size:12px;">' + escapeHtml(fmtDateTime(item.createdAt)) + '</div>'
              + '</div>';
          }).join('')
        : '<div class="muted">No activity yet.</div>';

      var tagHtml = tags.length
        ? tags.map(function(tag){ return '<span class="orders-tag">' + escapeHtml(tag) + '</span>'; }).join('')
        : '<div class="muted">No tags yet.</div>';

      els.drawer.innerHTML = ''
        + '<div class="row" style="justify-content:space-between;align-items:center;">'
        +   '<h3>Order ' + escapeHtml(order.id) + '</h3>'
        +   '<button class="close-btn" id="ordersDrawerClose">Close</button>'
        + '</div>'
        + '<div class="muted">' + escapeHtml(order.show && order.show.title ? order.show.title : '') + '</div>'

        + '<div class="section">'
        +   '<div class="section-title">Customer</div>'
        +   '<div><strong>' + escapeHtml(buyerName || order.email || '—') + '</strong></div>'
        +   (order.email ? '<div class="muted">' + escapeHtml(order.email) + '</div>' : '')
        + '</div>'

        + '<div class="section">'
        +   '<div class="section-title">Order details</div>'
        +   '<div class="row" style="justify-content:space-between;gap:8px;">'
        +     '<div>Status</div>'
        +     '<div><span class="orders-status ' + escapeHtml(String(order.status || 'PENDING').toLowerCase()) + '">' + escapeHtml(order.status || '') + '</span></div>'
        +   '</div>'
        +   '<div class="row" style="justify-content:space-between;gap:8px;">'
        +     '<div>Created</div>'
        +     '<div>' + escapeHtml(fmtDateTime(order.createdAt)) + '</div>'
        +   '</div>'
        +   '<div class="row" style="justify-content:space-between;gap:8px;">'
        +     '<div>Show date</div>'
        +     '<div>' + escapeHtml(fmtDate(order.show && order.show.date)) + '</div>'
        +   '</div>'
        + '</div>'

        + '<div class="section">'
        +   '<div class="section-title">Payment</div>'
        +   '<div class="row" style="justify-content:space-between;gap:8px;"><div>Gross</div><div>' + escapeHtml(fmtMoney(order.amountPence || 0)) + '</div></div>'
        +   '<div class="row" style="justify-content:space-between;gap:8px;"><div>Platform fee</div><div>' + escapeHtml(fmtMoney(order.platformFeePence || 0)) + '</div></div>'
        +   '<div class="row" style="justify-content:space-between;gap:8px;"><div>Payment fee</div><div>' + escapeHtml(fmtMoney(order.paymentFeePence || 0)) + '</div></div>'
        +   '<div class="row" style="justify-content:space-between;gap:8px;"><div>Net</div><div>' + escapeHtml(fmtMoney(net)) + '</div></div>'
        +   '<div class="muted" style="margin-top:6px;">Stripe ID: ' + escapeHtml(order.stripeId || '—') + '</div>'
        +   '<div class="muted">Checkout session: ' + escapeHtml(order.stripeCheckoutSessionId || '—') + '</div>'
        + '</div>'

        + '<div class="section">'
        +   '<div class="section-title">Tickets</div>'
        +   ticketHtml
        + '</div>'

        + '<div class="section">'
        +   '<div class="section-title">Refunds</div>'
        +   refundHtml
        + '</div>'

        + '<div class="section">'
        +   '<div class="section-title">Tags</div>'
        +   '<div>' + tagHtml + '</div>'
        +   '<div class="row" style="gap:8px;margin-top:8px;">'
        +     '<input id="orderTagInput" placeholder="Add tags" style="flex:1;" />'
        +     '<button class="btn" id="orderAddTags">Apply</button>'
        +   '</div>'
        + '</div>'

        + '<div class="section">'
        +   '<div class="section-title">Internal notes</div>'
        +   '<div class="row" style="gap:8px;margin-bottom:6px;">'
        +     '<input id="orderNoteInput" placeholder="Add a note" style="flex:1;" />'
        +     '<button class="btn" id="orderAddNote">Save</button>'
        +   '</div>'
        + '</div>'

        + '<div class="section">'
        +   '<div class="section-title">Actions</div>'
        +   '<div class="row" style="gap:8px;flex-wrap:wrap;">'
        +     '<button class="btn p" id="orderResend">Resend confirmation</button>'
        +     '<button class="btn" id="orderExportReceipt">Export receipt</button>'
        +   '</div>'
        + '</div>'

        + '<div class="section">'
        +   '<div class="section-title">Timeline</div>'
        +   timelineHtml
        + '</div>';

      var closeBtn = $('#ordersDrawerClose');
      if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

      var resendBtn = $('#orderResend');
      if (resendBtn){
        resendBtn.addEventListener('click', async function(){
          resendBtn.disabled = true;
          resendBtn.textContent = 'Sending…';
          try{
            await j('/admin/api/orders/' + encodeURIComponent(order.id) + '/resend', { method:'POST' });
            loadOrders(false);
            openDrawer(order.id);
          }catch(e){
            alert('Resend failed: ' + (e.message || e));
          }finally{
            resendBtn.disabled = false;
            resendBtn.textContent = 'Resend confirmation';
          }
        });
      }

      var receiptBtn = $('#orderExportReceipt');
      if (receiptBtn){
        receiptBtn.addEventListener('click', function(){
          window.location.href = '/admin/api/orders/export?type=receipt&orderIds=' + encodeURIComponent(order.id);
        });
      }

      var addTagsBtn = $('#orderAddTags');
      if (addTagsBtn){
        addTagsBtn.addEventListener('click', async function(){
          var input = $('#orderTagInput');
          var tagsValue = input && input.value ? input.value.trim() : '';
          if (!tagsValue) return;
          var tags = tagsValue.split(',').map(function(t){ return t.trim(); }).filter(Boolean);
          if (!tags.length) return;
          try{
            await j('/admin/api/orders/bulk', {
              method:'POST',
              headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ action:'apply_tags', orderIds:[order.id], tags: tags, mode:'append' })
            });
            if (input) input.value = '';
            loadOrders(false);
            openDrawer(order.id);
          }catch(e){
            alert('Failed to update tags: ' + (e.message || e));
          }
        });
      }

      var addNoteBtn = $('#orderAddNote');
      if (addNoteBtn){
        addNoteBtn.addEventListener('click', async function(){
          var input = $('#orderNoteInput');
          var note = input && input.value ? input.value.trim() : '';
          if (!note) return;
          try{
            await j('/admin/api/orders/bulk', {
              method:'POST',
              headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ action:'add_note', orderIds:[order.id], note: note })
            });
            if (input) input.value = '';
            loadOrders(false);
            openDrawer(order.id);
          }catch(e){
            alert('Failed to add note: ' + (e.message || e));
          }
        });
      }
    }

    if (els.drawerBackdrop) els.drawerBackdrop.addEventListener('click', closeDrawer);

    renderColumnChooser();
    syncFilters();
    loadOrders(true);
  }
  function venues(){
    if (!main) return;

    main.innerHTML = ''
      + '<div class="card" id="venuesCard">'
      +   '<div class="header">'
      +     '<div>'
      +       '<div class="title">Venues</div>'
      +       '<div class="muted">Keep venue photos, spaces, contacts, and booking fees in one place.</div>'
      +     '</div>'
      +     '<div class="row" style="gap:8px;align-items:center;">'
      +       '<input id="venueSearch" placeholder="Search venues" style="min-width:200px;" />'
      +       '<button class="btn p" id="addVenueBtn" title="Add new venue">+ Add venue</button>'
      +       '<div class="row" style="gap:4px;align-items:center;">'
      +         '<button class="btn" id="venueViewGrid" title="Grid view" style="padding:6px 8px;">'
      +           '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
      +             '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect>'
      +             '<rect x="3" y="14" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect>'
      +           '</svg>'
      +         '</button>'
      +         '<button class="btn" id="venueViewRows" title="Row view" style="padding:6px 8px;">'
      +           '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
      +             '<rect x="3" y="4" width="18" height="4"></rect>'
      +             '<rect x="3" y="10" width="18" height="4"></rect>'
      +             '<rect x="3" y="16" width="18" height="4"></rect>'
      +           '</svg>'
      +         '</button>'
      +       '</div>'
      +     '</div>'
      +   '</div>'
      +   '<div class="error" id="venueErr" style="margin-top:6px;"></div>'

      +   '<div class="card" id="newVenueForm" style="margin-top:12px;display:none;">'
      +     '<div class="header">'
      +       '<div>'
      +         '<div class="title">Add a new venue</div>'
      +         '<div class="muted">We will also show venues created from new shows.</div>'
      +       '</div>'
      +       '<button class="btn" id="cancelNewVenue">Cancel</button>'
      +     '</div>'
      +     '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">'
      +       '<label style="display:grid;gap:6px;">Venue name<input id="nv_name" required /></label>'
      +       '<label style="display:grid;gap:6px;">Address<textarea id="nv_address" rows="2" style="resize:vertical;"></textarea></label>'
      +       '<label style="display:grid;gap:6px;">City<input id="nv_city" /></label>'
      +       '<label style="display:grid;gap:6px;">Postcode<input id="nv_postcode" /></label>'
      +       '<label style="display:grid;gap:6px;">Capacity<input id="nv_capacity" type="number" min="1" /></label>'
      +     '</div>'
      +     '<div class="row" style="justify-content:flex-end;gap:8px;margin-top:10px;">'
      +       '<button class="btn p" id="saveNewVenue">Save venue</button>'
      +     '</div>'
      +     '<div class="error" id="newVenueError" style="margin-top:6px;"></div>'
      +   '</div>'

      +   '<div class="muted" id="venueEmpty" style="display:none;margin-top:12px;">No venues yet. Create one with the + button to get started.</div>'
      +   '<div id="venueGrid" class="grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:12px;margin-top:12px;"></div>'
      + '</div>';

    var search = $('#venueSearch');
    var grid = $('#venueGrid');
    var err = $('#venueErr');
    var empty = $('#venueEmpty');
    var addBtn = $('#addVenueBtn');
    var form = $('#newVenueForm');
    var formErr = $('#newVenueError');
    var extras = loadVenueExtras();
    var viewGridBtn = $('#venueViewGrid');
    var viewRowsBtn = $('#venueViewRows');
    var venueView = (localStorage.getItem('adminVenuesView') === 'rows') ? 'rows' : 'grid';
    var currentItems = [];

    var formFields = {
      name: $('#nv_name'),
      address: $('#nv_address'),
      city: $('#nv_city'),
      postcode: $('#nv_postcode'),
      capacity: $('#nv_capacity'),
      cancel: $('#cancelNewVenue'),
      save: $('#saveNewVenue'),
    };

    function loadVenueExtras(){
      try{
        var saved = localStorage.getItem('adminVenueExtras');
        return saved ? JSON.parse(saved) : {};
      }catch(e){
        return {};
      }
    }

    function saveVenueExtras(){
      try{ localStorage.setItem('adminVenueExtras', JSON.stringify(extras || {})); }catch(e){}
    }

    function toggleForm(show){ if (form) form.style.display = show ? 'block' : 'none'; }

    function updateVenueViewControls(){
      if (viewGridBtn) viewGridBtn.style.background = venueView === 'grid' ? '#111827' : '';
      if (viewGridBtn) viewGridBtn.style.color = venueView === 'grid' ? '#ffffff' : '';
      if (viewRowsBtn) viewRowsBtn.style.background = venueView === 'rows' ? '#111827' : '';
      if (viewRowsBtn) viewRowsBtn.style.color = venueView === 'rows' ? '#ffffff' : '';
    }

    function setVenueView(next){
      venueView = next === 'rows' ? 'rows' : 'grid';
      try{ localStorage.setItem('adminVenuesView', venueView); }catch(e){}
      updateVenueViewControls();
      renderVenues(currentItems || []);
    }

    if (addBtn){
      addBtn.addEventListener('click', function(){ toggleForm(true); if (formFields.name) formFields.name.focus(); });
    }
    if (viewGridBtn){
      viewGridBtn.addEventListener('click', function(){ setVenueView('grid'); });
    }
    if (viewRowsBtn){
      viewRowsBtn.addEventListener('click', function(){ setVenueView('rows'); });
    }
    if (formFields.cancel){
      formFields.cancel.addEventListener('click', function(){ toggleForm(false); });
    }
    if (formFields.save){
      formFields.save.addEventListener('click', async function(){
        if (!formErr) return;
        formErr.textContent = '';
        var payload = {
          name: (formFields.name && formFields.name.value.trim()) || '',
          address: (formFields.address && formFields.address.value.trim()) || null,
          city: (formFields.city && formFields.city.value.trim()) || null,
          postcode: (formFields.postcode && formFields.postcode.value.trim()) || null,
          capacity: formFields.capacity && formFields.capacity.value ? Number(formFields.capacity.value) : null,
        };
        if (!payload.name){
          formErr.textContent = 'Name is required';
          return;
        }
        try{
          await j('/admin/venues', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify(payload)
          });
          toggleForm(false);
          if (formFields.name) formFields.name.value = '';
          if (formFields.address) formFields.address.value = '';
          if (formFields.city) formFields.city.value = '';
          if (formFields.postcode) formFields.postcode.value = '';
          if (formFields.capacity) formFields.capacity.value = '';
          loadVenues(search && search.value ? search.value : '');
        }catch(e){
          formErr.textContent = (e && e.message) || 'Failed to create venue';
        }
      });
    }

    var debouncedLoad = debounce(function(){
      loadVenues(search ? search.value : '');
    }, 250);

    if (search){
      search.addEventListener('input', debouncedLoad);
    }

    updateVenueViewControls();
    loadVenues('');

    async function loadVenues(q){
      if (!grid) return;
      grid.innerHTML = '<div class="muted">Loading venues…</div>';
      if (err) err.textContent = '';
      try{
        var res = await j('/admin/venues?q=' + encodeURIComponent(q || ''));
        var items = (res && res.items) || [];
        currentItems = items;
        renderVenues(items);
      }catch(e){
        if (err) err.textContent = e.message || 'Failed to load venues';
        grid.innerHTML = '';
      }
    }

    function renderVenues(items){
      if (!grid) return;
      grid.innerHTML = '';
      grid.setAttribute('data-view', venueView);
      grid.style.gridTemplateColumns = venueView === 'rows'
        ? 'minmax(0, 1fr)'
        : 'repeat(auto-fit,minmax(340px,1fr))';
      if (empty) empty.style.display = items && items.length ? 'none' : 'block';
      (items || []).forEach(function(v){
        var card = document.createElement('div');
        card.className = 'card';
        card.style.margin = '0';

        var ext = extras && extras[v.id] ? extras[v.id] : {};
        var spaces = Array.isArray(ext.spaces)
          ? ext.spaces.map(function(space){
              if (typeof space === 'string') return { name: space, capacity: null };
              return {
                name: space && space.name ? String(space.name) : '',
                capacity: space && space.capacity != null ? Number(space.capacity) : null,
              };
            })
          : [];
        var maps = Array.isArray(ext.maps)
          ? ext.maps.map(function(map){
              if (typeof map === 'string') return { name: map, space: '' };
              return {
                name: map && map.name ? String(map.name) : '',
                space: map && map.space ? String(map.space) : '',
              };
            })
          : [];

        var deleteBtnHtml = venueView === 'grid'
          ? '<button class="btn" data-action="deleteVenue" title="Delete venue" style="padding:6px 8px;">'
            + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
              + '<polyline points="3 6 5 6 21 6"></polyline>'
              + '<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>'
              + '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>'
              + '<line x1="10" y1="11" x2="10" y2="17"></line>'
              + '<line x1="14" y1="11" x2="14" y2="17"></line>'
            + '</svg>'
          + '</button>'
          : '';

        var menuHtml = venueView === 'rows'
          ? '<div style="position:relative;">'
            + '<button class="btn" data-action="venueMenu" title="Venue actions" style="padding:6px 8px;">'
              + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
                + '<line x1="3" y1="6" x2="21" y2="6"></line>'
                + '<line x1="3" y1="12" x2="21" y2="12"></line>'
                + '<line x1="3" y1="18" x2="21" y2="18"></line>'
              + '</svg>'
            + '</button>'
            + '<div data-menu="venueMenu" style="display:none;position:absolute;right:0;top:36px;background:#fff;border:1px solid var(--border);border-radius:8px;box-shadow:0 6px 18px rgba(15,23,42,0.12);min-width:160px;z-index:10;">'
              + '<button class="btn" data-action="deleteVenue" style="width:100%;justify-content:flex-start;border:none;border-radius:8px;">Delete venue</button>'
            + '</div>'
          + '</div>'
          : '';

        card.innerHTML = ''
          + '<div class="header">'
          +   '<div>'
          +     '<div class="title">' + escapeHtml(v.name || 'Untitled venue') + '</div>'
          +     '<div class="muted">' + escapeHtml([v.city, v.postcode].filter(Boolean).join(' • ')) + '</div>'
          +   '</div>'
          +   '<div class="row" style="gap:6px;align-items:center;">'
          +     deleteBtnHtml
          +     menuHtml
          +   '</div>'
          + '</div>'

          + '<div class="grid" style="gap:10px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));">'
          +   '<div class="grid" style="gap:6px;">'
          +     '<label style="margin:0;font-weight:600;font-size:13px;">Venue photo</label>'
          +     '<div class="row" style="gap:12px;align-items:center;flex-wrap:wrap;">'
          +       '<div class="venue-photo" style="border:1px solid var(--border);border-radius:999px;height:88px;width:88px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#f9fafb;">'
          +         (ext.image ? '<img src="' + escapeHtml(ext.image) + '" alt="Preview" style="width:100%;height:100%;object-fit:cover;" />' : '<div class="muted" style="font-size:12px;">No image</div>')
          +       '</div>'
          +       '<div class="grid" style="gap:6px;">'
          +         '<input type="file" accept="image/*" data-field="imageFile" />'
          +         '<div class="row" style="gap:8px;align-items:center;">'
          +           '<button class="btn" data-action="uploadImage">Upload photo</button>'
          +           '<input type="hidden" data-field="image" value="' + escapeHtml(ext.image || '') + '" />'
          +         '</div>'
          +         '<div class="muted" style="font-size:12px;">Square images work best.</div>'
          +         '<div class="error" data-error="image"></div>'
          +       '</div>'
          +     '</div>'
          +   '</div>'

          +   '<div class="grid" style="gap:6px;">'
          +     '<label style="margin:0;font-weight:600;font-size:13px;">Contact name<input data-field="contactName" value="' + escapeHtml(ext.contactName || '') + '" placeholder="Venue manager" /></label>'
          +     '<label style="margin:0;font-weight:600;font-size:13px;">Contact email<input data-field="contactEmail" type="email" value="' + escapeHtml(ext.contactEmail || '') + '" placeholder="manager@example.com" /></label>'
          +     '<label style="margin:0;font-weight:600;font-size:13px;">Contact phone<input data-field="contactPhone" value="' + escapeHtml(ext.contactPhone || '') + '" placeholder="+44 20 1234 5678" /></label>'
          +   '</div>'

          +   '<div class="grid" style="gap:6px;">'
          +     '<label style="margin:0;font-weight:600;font-size:13px;" data-capacity-row="true">Capacity<input type="number" min="1" data-field="capacity" value="' + escapeHtml(String(ext.capacity || v.capacity || '')) + '" /></label>'
          +     '<label style="margin:0;font-weight:600;font-size:13px;">Ticket contra (£)<input type="number" min="0" step="0.01" data-field="contra" value="' + escapeHtml(ext.contra ? String(ext.contra) : '') + '" placeholder="e.g. 250" /></label>'
          +     '<label style="margin:0;font-weight:600;font-size:13px;">Booking fee (%)<input type="number" min="10" step="0.5" data-field="fee" value="' + escapeHtml(ext.fee ? String(ext.fee) : '10') + '" /></label>'
          +     '<div class="muted" style="font-size:12px;">Fees must be at least 10%. We recommend 10–15%.</div>'
          +   '</div>'
          + '</div>'

          + '<div class="grid" style="gap:10px;margin-top:10px;">'
          +   '<div class="grid" style="gap:6px;">'
          +     '<div class="row" style="justify-content:space-between;align-items:center;gap:8px;">'
          +       '<div style="font-weight:600;font-size:13px;">Spaces inside this venue</div>'
          +       '<button class="btn" data-action="addSpace" style="padding:6px 10px;">+ Space</button>'
          +     '</div>'
          +     '<div class="muted" style="font-size:12px;">Add areas like studio, foyer or main room.</div>'
          +     '<div class="grid" style="gap:6px;" data-list="spaces"></div>'
          +     '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:6px;">'
          +       '<input data-input="spaceName" placeholder="Space name" />'
          +       '<input data-input="spaceCapacity" type="number" min="1" placeholder="Capacity" />'
          +     '</div>'
          +   '</div>'

          +   '<div class="grid" style="gap:6px;">'
          +     '<div class="row" style="justify-content:space-between;align-items:center;gap:8px;">'
          +       '<div style="font-weight:600;font-size:13px;">Seating maps</div>'
          +       '<button class="btn" data-action="addMap" style="padding:6px 10px;">+ Map</button>'
          +     '</div>'
          +     '<div class="muted" style="font-size:12px;">Create and link seating maps to specific spaces.</div>'
          +     '<div class="grid" style="gap:6px;" data-list="maps"></div>'
          +     '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:6px;">'
          +       '<input data-input="mapName" placeholder="Seating map name" />'
          +       '<select data-input="mapSpace"></select>'
          +     '</div>'
          +   '</div>'
          + '</div>'

          + '<div class="row" style="justify-content:space-between;align-items:center;margin-top:12px;gap:8px;">'
          +   '<div class="muted" style="font-size:12px;">Save to keep booking fees, spaces and contacts linked to this venue.</div>'
          +   '<div class="row" style="gap:8px;align-items:center;">'
          +     '<div class="muted" data-status="' + escapeHtml(v.id) + '" style="font-size:12px;"></div>'
          +     '<button class="btn p" data-save="' + escapeHtml(v.id) + '">Save details</button>'
          +   '</div>'
          + '</div>';

        grid.appendChild(card);

        var imgInput = card.querySelector('input[data-field="image"]');
        var imgFileInput = card.querySelector('input[data-field="imageFile"]');
        var uploadBtn = card.querySelector('[data-action="uploadImage"]');
        var imgErr = card.querySelector('[data-error="image"]');
        var preview = card.querySelector('.venue-photo');
        if (uploadBtn && imgFileInput && imgInput && preview){
          uploadBtn.addEventListener('click', async function(){
            if (imgErr) imgErr.textContent = '';
            var file = imgFileInput.files && imgFileInput.files[0];
            if (!file){
              if (imgErr) imgErr.textContent = 'Choose an image to upload.';
              return;
            }
            uploadBtn.disabled = true;
            uploadBtn.textContent = 'Uploading…';
            try{
              var upload = await uploadPoster(file);
              imgInput.value = upload.url || '';
              preview.innerHTML = upload.url
                ? '<img src="' + escapeHtml(upload.url) + '" alt="Preview" style="width:100%;height:100%;object-fit:cover;" />'
                : '<div class="muted" style="font-size:12px;">No image</div>';
            }catch(e){
              if (imgErr) imgErr.textContent = parseErr(e);
            }finally{
              uploadBtn.disabled = false;
              uploadBtn.textContent = 'Upload photo';
            }
          });
        }

        var spaceInput = card.querySelector('input[data-input="spaceName"]');
        var spaceCapacityInput = card.querySelector('input[data-input="spaceCapacity"]');
        var mapInput = card.querySelector('input[data-input="mapName"]');
        var mapSpaceInput = card.querySelector('select[data-input="mapSpace"]');
        var spaceList = card.querySelector('[data-list="spaces"]');
        var mapList = card.querySelector('[data-list="maps"]');
        var capacityRow = card.querySelector('[data-capacity-row="true"]');

        function updateCapacityRow(){
          if (!capacityRow) return;
          capacityRow.style.display = spaces.length ? 'none' : '';
        }

        function renderSpaces(){
          if (!spaceList) return;
          spaceList.innerHTML = '';
          if (!spaces.length){
            var emptySpace = document.createElement('div');
            emptySpace.className = 'muted';
            emptySpace.style.fontSize = '12px';
            emptySpace.textContent = 'Nothing added yet';
            spaceList.appendChild(emptySpace);
            updateCapacityRow();
            renderMapSpaces();
            return;
          }
          spaces.forEach(function(space, idx){
            var row = document.createElement('div');
            row.style.display = 'grid';
            row.style.gridTemplateColumns = 'minmax(120px,1fr) minmax(120px,140px) auto';
            row.style.gap = '8px';
            row.style.alignItems = 'center';
            row.style.padding = '6px 0';
            row.style.borderBottom = '1px solid var(--border)';
            row.innerHTML = ''
              + '<input data-space-name="' + idx + '" value="' + escapeHtml(space.name || '') + '" placeholder="Space name" />'
              + '<input data-space-capacity="' + idx + '" type="number" min="1" placeholder="Capacity" value="' + (space.capacity != null ? escapeHtml(String(space.capacity)) : '') + '" />'
              + '<button class="btn" data-space-remove="' + idx + '">Remove</button>';
            spaceList.appendChild(row);
          });

          $$('[data-space-name]', spaceList).forEach(function(input){
            input.addEventListener('input', function(){
              var idx = Number(input.getAttribute('data-space-name'));
              if (!isNaN(idx) && spaces[idx]) spaces[idx].name = input.value.trim();
              renderMapSpaces();
              renderMaps();
            });
          });
          $$('[data-space-capacity]', spaceList).forEach(function(input){
            input.addEventListener('input', function(){
              var idx = Number(input.getAttribute('data-space-capacity'));
              if (isNaN(idx) || !spaces[idx]) return;
              var raw = input.value.trim();
              spaces[idx].capacity = raw ? Number(raw) : null;
            });
          });
          $$('[data-space-remove]', spaceList).forEach(function(btn){
            btn.addEventListener('click', function(){
              var idx = Number(btn.getAttribute('data-space-remove'));
              if (isNaN(idx)) return;
              spaces.splice(idx, 1);
              renderSpaces();
            });
          });
          updateCapacityRow();
          renderMapSpaces();
        }

        function renderMapSpaces(){
          if (!mapSpaceInput) return;
          var options = spaces.filter(function(space){ return space.name; });
          mapSpaceInput.innerHTML = '<option value="">Link to space…</option>'
            + options.map(function(space){
              return '<option value="' + escapeHtml(space.name) + '">' + escapeHtml(space.name) + '</option>';
            }).join('');
        }

        function renderMaps(){
          if (!mapList) return;
          mapList.innerHTML = '';
          if (!maps.length){
            var emptyMap = document.createElement('div');
            emptyMap.className = 'muted';
            emptyMap.style.fontSize = '12px';
            emptyMap.textContent = 'Nothing added yet';
            mapList.appendChild(emptyMap);
            return;
          }
          maps.forEach(function(map, idx){
            var row = document.createElement('div');
            row.style.display = 'grid';
            row.style.gridTemplateColumns = 'minmax(140px,1fr) minmax(140px,1fr) auto';
            row.style.gap = '8px';
            row.style.alignItems = 'center';
            row.style.padding = '6px 0';
            row.style.borderBottom = '1px solid var(--border)';
            row.innerHTML = ''
              + '<input data-map-name="' + idx + '" value="' + escapeHtml(map.name || '') + '" placeholder="Map name" />'
              + '<select data-map-space="' + idx + '"></select>'
              + '<button class="btn" data-map-remove="' + idx + '">Remove</button>';
            mapList.appendChild(row);
          });
          $$('[data-map-name]', mapList).forEach(function(input){
            input.addEventListener('input', function(){
              var idx = Number(input.getAttribute('data-map-name'));
              if (!isNaN(idx) && maps[idx]) maps[idx].name = input.value.trim();
            });
          });
          $$('[data-map-space]', mapList).forEach(function(select){
            var idx = Number(select.getAttribute('data-map-space'));
            if (isNaN(idx) || !maps[idx]) return;
            var options = spaces.filter(function(space){ return space.name; });
            select.innerHTML = '<option value="">Link to space…</option>'
              + options.map(function(space){
                var selected = maps[idx].space === space.name ? ' selected' : '';
                return '<option value="' + escapeHtml(space.name) + '"' + selected + '>' + escapeHtml(space.name) + '</option>';
              }).join('');
            select.addEventListener('change', function(){
              maps[idx].space = select.value;
            });
          });
          $$('[data-map-remove]', mapList).forEach(function(btn){
            btn.addEventListener('click', function(){
              var idx = Number(btn.getAttribute('data-map-remove'));
              if (isNaN(idx)) return;
              maps.splice(idx, 1);
              renderMaps();
            });
          });
        }

        renderSpaces();
        renderMaps();

        function addSpaceFromInputs(){
          if (!spaceInput) return;
          var name = (spaceInput.value || '').trim();
          var capRaw = spaceCapacityInput ? (spaceCapacityInput.value || '').trim() : '';
          if (!name) return;
          var cap = capRaw ? Number(capRaw) : null;
          spaces.push({ name: name, capacity: cap && !isNaN(cap) ? cap : null });
          spaceInput.value = '';
          if (spaceCapacityInput) spaceCapacityInput.value = '';
          renderSpaces();
        }

        function addMapFromInputs(){
          if (!mapInput) return;
          var name = (mapInput.value || '').trim();
          if (!name) return;
          var space = mapSpaceInput ? mapSpaceInput.value : '';
          maps.push({ name: name, space: space || '' });
          mapInput.value = '';
          if (mapSpaceInput) mapSpaceInput.value = '';
          renderMaps();
        }

        if (spaceInput){
          spaceInput.addEventListener('keydown', function(e){
            if (e.key === 'Enter'){ e.preventDefault(); addSpaceFromInputs(); }
          });
        }
        if (spaceCapacityInput){
          spaceCapacityInput.addEventListener('keydown', function(e){
            if (e.key === 'Enter'){ e.preventDefault(); addSpaceFromInputs(); }
          });
        }
        if (mapInput){
          mapInput.addEventListener('keydown', function(e){
            if (e.key === 'Enter'){ e.preventDefault(); addMapFromInputs(); }
          });
        }

        var addSpaceBtn = card.querySelector('[data-action="addSpace"]');
        if (addSpaceBtn){
          addSpaceBtn.addEventListener('click', function(){
            addSpaceFromInputs();
            if (spaceInput) spaceInput.focus();
          });
        }

        var addMapBtn = card.querySelector('[data-action="addMap"]');
        if (addMapBtn){
          addMapBtn.addEventListener('click', function(){
            addMapFromInputs();
            if (mapInput) mapInput.focus();
          });
        }

        var menuToggle = card.querySelector('[data-action="venueMenu"]');
        var menu = card.querySelector('[data-menu="venueMenu"]');
        if (menuToggle && menu){
          menuToggle.addEventListener('click', function(e){
            e.stopPropagation();
            var open = menu.style.display === 'block';
            menu.style.display = open ? 'none' : 'block';
          });
          document.addEventListener('click', function(){
            menu.style.display = 'none';
          });
        }

        card.querySelectorAll('[data-action="deleteVenue"]').forEach(function(btn){
          btn.addEventListener('click', async function(e){
            e.preventDefault();
            e.stopPropagation();
            if (!confirm('Delete this venue?')) return;
            try{
              await j('/admin/venues/' + encodeURIComponent(v.id), { method:'DELETE' });
              loadVenues(search && search.value ? search.value : '');
            }catch(err){
              alert('Failed to delete venue: ' + parseErr(err));
            }
          });
        });

        var feeInput = card.querySelector('input[data-field="fee"]');
        if (feeInput){
          feeInput.addEventListener('change', function(){
            var v = Number(feeInput.value || 0);
            if (!v || v < 10){
              feeInput.value = '10';
            }
          });
        }

        var saveBtn = card.querySelector('[data-save]');
        if (saveBtn){
          saveBtn.addEventListener('click', function(){
            var data = {
              image: imgInput ? imgInput.value.trim() : '',
              contactName: valueOf('contactName'),
              contactEmail: valueOf('contactEmail'),
              contactPhone: valueOf('contactPhone'),
              capacity: numberOf('capacity'),
              contra: numberOf('contra'),
              fee: Math.max(10, numberOf('fee') || 10),
              spaces: spaces.slice(),
              maps: maps.slice(),
            };
            extras = extras || {};
            extras[v.id] = data;
            saveVenueExtras();
            var status = card.querySelector('[data-status="' + v.id + '"]');
            if (status){
              status.textContent = 'Saved';
              status.style.color = '#059669';
              setTimeout(function(){ status.textContent = ''; }, 2000);
            }
          });
        }

        function valueOf(field){
          var el = card.querySelector('input[data-field="' + field + '"]');
          return el ? el.value.trim() : '';
        }
        function numberOf(field){
          var raw = valueOf(field);
          if (!raw) return null;
          var num = Number(raw);
          return isNaN(num) ? null : num;
        }
      });
    }

  }
  function promotersList(){
    if (!main) return;

    main.innerHTML = ''
      + '<div class="card" id="promotersCard">'
      +   '<div class="header">'
      +     '<div>'
      +       '<div class="title">Promoters</div>'
      +       '<div class="muted">Promoters that we work with</div>'
      +     '</div>'
      +     '<div class="row" style="gap:8px;align-items:center;">'
      +       '<input id="promoterSearch" placeholder="Search promoters" style="min-width:200px;" />'
      +       '<button class="btn p" id="addPromoterBtn" title="Add new promoter">+ Add promoter</button>'
      +     '</div>'
      +   '</div>'
      +   '<div class="error" id="promoterErr" style="margin-top:6px;"></div>'
      +   '<div class="muted" id="promoterEmpty" style="display:none;margin-top:12px;">No promoters yet. Create one with the + button to get started.</div>'
      +   '<div id="promoterGrid" class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;margin-top:12px;"></div>'
      + '</div>';

    var search = $('#promoterSearch');
    var grid = $('#promoterGrid');
    var err = $('#promoterErr');
    var empty = $('#promoterEmpty');
    var addBtn = $('#addPromoterBtn');

    function formatStatus(s){
      var map = {
        PROSPECT: 'Prospect',
        ACTIVE: 'Active',
        DORMANT: 'Dormant',
        BLOCKED: 'Blocked'
      };
      return map[s] || 'Prospect';
    }

    function toggleEmpty(show){
      if (empty) empty.style.display = show ? 'block' : 'none';
    }

    if (addBtn){
      addBtn.addEventListener('click', function(){ go('/admin/ui/promoters/new'); });
    }

    var debouncedLoad = debounce(function(){
      loadPromoters(search ? search.value : '');
    }, 250);

    if (search){
      search.addEventListener('input', debouncedLoad);
    }

    loadPromoters('');

    async function loadPromoters(q){
      if (!grid) return;
      grid.innerHTML = '<div class="muted">Loading promoters…</div>';
      if (err) err.textContent = '';
      try{
        var res = await j('/admin/promoters?q=' + encodeURIComponent(q || ''));
        var items = (res && res.items) || [];
        renderPromoters(items);
      }catch(e){
        if (err) err.textContent = parseErr(e);
        grid.innerHTML = '';
      }
    }

    function renderPromoters(items){
      if (!grid) return;
      grid.innerHTML = '';
      toggleEmpty(!(items && items.length));
      (items || []).forEach(function(p){
        var card = document.createElement('div');
        card.className = 'card';
        card.style.margin = '0';

        var statusLabel = formatStatus(p.status);
        card.innerHTML = ''
          + '<div class="header">'
          +   '<div class="row" style="gap:12px;align-items:center;">'
          +     promoterAvatarHtml(p, { size: 56 })
          +     '<div>'
          +       '<div class="title">' + escapeHtml(p.name || 'Untitled promoter') + '</div>'
          +       '<div class="muted">' + escapeHtml(p.tradingName || p.email || '') + '</div>'
          +     '</div>'
          +   '</div>'
          +   '<div class="row" style="gap:8px;align-items:center;">'
          +     '<span class="status-badge">' + escapeHtml(statusLabel) + '</span>'
          +     '<a class="btn" href="/admin/ui/promoters/' + encodeURIComponent(p.id) + '" data-view="/admin/ui/promoters/' + encodeURIComponent(p.id) + '">Open profile</a>'
          +   '</div>'
          + '</div>';

        grid.appendChild(card);
      });
    }
  }

  function promoterCreate(){
    if (!main) return;

    main.innerHTML = ''
      + '<div class="card">'
      +   '<div class="header">'
      +     '<div>'
      +       '<div class="title">Add promoter</div>'
      +       '<div class="muted">Capture the core details for a new promoter.</div>'
      +     '</div>'
      +     '<div class="row" style="gap:8px;">'
      +       '<a class="btn" href="/admin/ui/promoters" data-view="/admin/ui/promoters">Cancel</a>'
      +       '<button class="btn p" id="savePromoterCreate">Save promoter</button>'
      +     '</div>'
      +   '</div>'
      +   '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">'
      +     '<label style="display:grid;gap:6px;">Promoter name<input id="pc_name" required /></label>'
      +     '<label style="display:grid;gap:6px;">Trading name<input id="pc_tradingName" /></label>'
      +     '<label style="display:grid;gap:6px;">Email<input id="pc_email" type="email" /></label>'
      +     '<label style="display:grid;gap:6px;">Phone<input id="pc_phone" /></label>'
      +     '<label style="display:grid;gap:6px;">Status'
      +       '<select id="pc_status">'
      +         '<option value="PROSPECT">Prospect</option>'
      +         '<option value="ACTIVE">Active</option>'
      +         '<option value="DORMANT">Dormant</option>'
      +         '<option value="BLOCKED">Blocked</option>'
      +       '</select>'
      +     '</label>'
      +   '</div>'
      +   '<div style="margin-top:10px;">'
      +     '<label style="display:grid;gap:6px;">Notes<textarea id="pc_notes" rows="3" style="resize:vertical;"></textarea></label>'
      +   '</div>'
      +   '<div class="row" style="justify-content:flex-end;gap:8px;margin-top:10px;">'
      +     '<div class="error" id="pc_error"></div>'
      +   '</div>'
      + '</div>';

    var saveBtn = $('#savePromoterCreate');
    if (saveBtn){
      saveBtn.addEventListener('click', async function(){
        var err = $('#pc_error');
        if (err) err.textContent = '';
        var payload = {
          name: ($('#pc_name').value || '').trim(),
          tradingName: ($('#pc_tradingName').value || '').trim() || null,
          email: ($('#pc_email').value || '').trim() || null,
          phone: ($('#pc_phone').value || '').trim() || null,
          status: ($('#pc_status').value || 'PROSPECT'),
          notes: ($('#pc_notes').value || '').trim() || null,
        };
        if (!payload.name){
          if (err) err.textContent = 'Promoter name is required.';
          return;
        }
        try{
          var res = await j('/admin/promoters', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify(payload)
          });
          if (res && res.promoter && res.promoter.id){
            go('/admin/ui/promoters/' + res.promoter.id);
          }else{
            throw new Error('Promoter created, but missing response data.');
          }
        }catch(e){
          if (err) err.textContent = parseErr(e);
        }
      });
    }
  }

  function promoterProfile(promoterId){
    if (!main) return;
    var activeTab = 'overview';

    loadPromoter();

    async function loadPromoter(){
      main.innerHTML = '<div class="card"><div class="title">Loading promoter…</div></div>';
      try{
        var res = await j('/admin/promoters/' + encodeURIComponent(promoterId));
        if (!res || !res.promoter) throw new Error('Promoter not found');
        renderPromoter(res.promoter);
      }catch(e){
        main.innerHTML = '<div class="card"><div class="error">Failed to load promoter: ' + escapeHtml(parseErr(e)) + '</div></div>';
      }
    }

    function renderPromoter(promoter){
      var statusValue = promoter.status || 'PROSPECT';
      main.innerHTML = ''
        + '<div class="card" id="promoterProfileCard">'
        +   '<div class="header">'
        +     '<div>'
        +       '<div class="title">' + escapeHtml(promoter.name || 'Promoter') + '</div>'
        +       '<div class="muted">' + escapeHtml(promoter.tradingName || promoter.email || 'Promoter profile') + '</div>'
        +     '</div>'
        +     '<div class="row" style="gap:8px;align-items:center;">'
        +       '<a class="btn" href="/admin/ui/promoters" data-view="/admin/ui/promoters">Back to list</a>'
        +     '</div>'
        +   '</div>'
        +   '<div class="tabs" id="promoterTabs">'
        +     '<button class="tab-btn" data-tab="overview">Overview</button>'
        +     '<button class="tab-btn" data-tab="contacts">Contacts</button>'
        +     '<button class="tab-btn" data-tab="documents">Documents</button>'
        +     '<button class="tab-btn" data-tab="venues">Venues</button>'
        +     '<button class="tab-btn" data-tab="shows">Shows</button>'
        +     '<button class="tab-btn" data-tab="deals">Deals</button>'
        +     '<button class="tab-btn" data-tab="invoicing">Invoicing</button>'
        +     '<button class="tab-btn" data-tab="activity">Activity</button>'
        +   '</div>'

        +   '<div class="tab-panel" data-panel="overview">'
        +     '<div class="row" style="gap:16px;align-items:center;margin-bottom:12px;flex-wrap:wrap;">'
        +       '<div id="po_logo_preview">' + promoterAvatarHtml(promoter, { size: 72 }) + '</div>'
        +       '<div class="grid" style="gap:8px;">'
        +         '<label style="display:grid;gap:6px;">Business logo<input id="po_logo_file" type="file" accept="image/*" /></label>'
        +         '<div class="row" style="gap:8px;align-items:center;">'
        +           '<button class="btn" id="po_logo_upload">Upload logo</button>'
        +           '<input type="hidden" id="po_logoUrl" value="' + escapeHtml(promoter.logoUrl || '') + '" />'
        +         '</div>'
        +         '<div class="muted" style="font-size:12px;">Square images work best.</div>'
        +         '<div class="error" id="po_logo_error"></div>'
        +       '</div>'
        +     '</div>'
        +     '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">'
        +       '<label style="display:grid;gap:6px;">Promoter name<input id="po_name" value="' + escapeHtml(promoter.name || '') + '" required /></label>'
        +       '<label style="display:grid;gap:6px;">Trading name<input id="po_tradingName" value="' + escapeHtml(promoter.tradingName || '') + '" /></label>'
        +       '<label style="display:grid;gap:6px;">Email<input id="po_email" type="email" value="' + escapeHtml(promoter.email || '') + '" /></label>'
        +       '<label style="display:grid;gap:6px;">Phone<input id="po_phone" value="' + escapeHtml(promoter.phone || '') + '" /></label>'
        +       '<label style="display:grid;gap:6px;">Status'
        +         '<select id="po_status">'
        +           '<option value="PROSPECT"' + (statusValue === 'PROSPECT' ? ' selected' : '') + '>Prospect</option>'
        +           '<option value="ACTIVE"' + (statusValue === 'ACTIVE' ? ' selected' : '') + '>Active</option>'
        +           '<option value="DORMANT"' + (statusValue === 'DORMANT' ? ' selected' : '') + '>Dormant</option>'
        +           '<option value="BLOCKED"' + (statusValue === 'BLOCKED' ? ' selected' : '') + '>Blocked</option>'
        +         '</select>'
        +       '</label>'
        +     '</div>'
        +     '<div style="margin-top:10px;">'
        +       '<label style="display:grid;gap:6px;">Notes<textarea id="po_notes" rows="3" style="resize:vertical;">' + escapeHtml(promoter.notes || '') + '</textarea></label>'
        +     '</div>'
        +     '<div class="row" style="justify-content:flex-end;gap:8px;margin-top:10px;">'
        +       '<button class="btn p" id="po_save">Save overview</button>'
        +       '<div class="error" id="po_error"></div>'
        +     '</div>'
        +   '</div>'

        +   '<div class="tab-panel" data-panel="contacts">'
        +     '<div id="promoterContactsList"></div>'
        +     '<div class="card" style="margin-top:12px;">'
        +       '<div class="title">Add contact</div>'
        +       '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-top:10px;">'
        +         '<label style="display:grid;gap:6px;">Name<input id="pc_add_name" /></label>'
        +         '<label style="display:grid;gap:6px;">Role<input id="pc_add_role" /></label>'
        +         '<label style="display:grid;gap:6px;">Email<input id="pc_add_email" type="email" /></label>'
        +         '<label style="display:grid;gap:6px;">Phone<input id="pc_add_phone" /></label>'
        +         '<label style="display:grid;gap:6px;">Tags (comma separated)<input id="pc_add_tags" /></label>'
        +       '</div>'
        +       '<div class="row" style="gap:12px;margin-top:10px;flex-wrap:wrap;">'
        +         '<label class="row" style="gap:6px;"><input type="checkbox" id="pc_add_finance" />Primary finance contact</label>'
        +         '<label class="row" style="gap:6px;"><input type="checkbox" id="pc_add_marketing" />Primary marketing contact</label>'
        +       '</div>'
        +       '<div class="row" style="justify-content:flex-end;gap:8px;margin-top:10px;">'
        +         '<button class="btn p" id="pc_add_save">Add contact</button>'
        +         '<div class="error" id="pc_add_error"></div>'
        +       '</div>'
        +     '</div>'
        +   '</div>'

        +   '<div class="tab-panel" data-panel="documents">'
        +     '<div class="card">'
        +       '<div class="title">Upload document</div>'
        +       '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-top:10px;">'
        +         '<label style="display:grid;gap:6px;">Document type'
        +           '<select id="pd_type">'
        +             '<option value="PRS_CERTIFICATE">PRS certificate</option>'
        +             '<option value="PPL_MUSIC_LICENSING">PPL / music licensing</option>'
        +             '<option value="PUBLIC_LIABILITY_INSURANCE">Public liability insurance</option>'
        +             '<option value="RISK_ASSESSMENT">Risk assessment</option>'
        +             '<option value="TECH_SPEC">Tech spec</option>'
        +             '<option value="MARKETING_SPEC">Marketing spec</option>'
        +             '<option value="ACCESSIBILITY_INFO">Accessibility info</option>'
        +             '<option value="BRANDING_GUIDELINES">Branding guidelines / logo pack</option>'
        +             '<option value="OTHER">Other</option>'
        +           '</select>'
        +         '</label>'
        +         '<label style="display:grid;gap:6px;">Title<input id="pd_title" /></label>'
        +         '<label style="display:grid;gap:6px;">Expiry date<input id="pd_expiry" type="date" /></label>'
        +         '<label style="display:grid;gap:6px;">File<input id="pd_file" type="file" /></label>'
        +       '</div>'
        +       '<div class="row" style="justify-content:flex-end;gap:8px;margin-top:10px;">'
        +         '<button class="btn p" id="pd_upload">Upload document</button>'
        +         '<div class="error" id="pd_error"></div>'
        +       '</div>'
        +     '</div>'
        +     '<div id="promoterDocumentsList" style="margin-top:12px;"></div>'
        +   '</div>'

        +   '<div class="tab-panel" data-panel="venues">'
        +     '<div class="card"><div class="title">Venues</div><div class="muted">Coming next.</div></div>'
        +   '</div>'
        +   '<div class="tab-panel" data-panel="shows">'
        +     '<div class="card">'
        +       '<div class="header">'
        +         '<div class="title">Linked shows</div>'
        +         '<button class="btn" id="promoterShowsRefresh">Refresh</button>'
        +       '</div>'
        +       '<div id="promoterShowsList" class="muted">Loading shows…</div>'
        +     '</div>'
        +     '<div class="card" style="margin-top:12px;">'
        +       '<div class="title">Add to show</div>'
        +       '<div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px;">'
        +         '<select id="promoterShowSelect" class="ctl" style="min-width:240px;"></select>'
        +         '<button class="btn p" id="promoterShowAdd">Link show</button>'
        +       '</div>'
        +       '<div class="error" id="promoterShowErr" style="margin-top:6px;"></div>'
        +     '</div>'
        +   '</div>'
        +   '<div class="tab-panel" data-panel="deals">'
        +     '<div class="card"><div class="title">Deals</div><div class="muted">Coming next.</div></div>'
        +   '</div>'
        +   '<div class="tab-panel" data-panel="invoicing">'
        +     '<div class="card"><div class="title">Invoicing</div><div class="muted">Coming next.</div></div>'
        +   '</div>'
        +   '<div class="tab-panel" data-panel="activity">'
        +     '<div id="promoterActivityList"></div>'
        +   '</div>'
        + '</div>';

      setupTabs();
      renderContacts(promoter);
      renderDocuments(promoter);
      renderShows();
      renderActivity(promoter);
      bindOverviewSave(promoter);
      bindLogoUpload(promoter);
      bindContactAdd();
      bindDocumentUpload();
    }

    function setupTabs(){
      var tabButtons = $$('#promoterTabs .tab-btn');
      function activate(tabId){
        activeTab = tabId;
        tabButtons.forEach(function(btn){
          btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
        });
        $$('.tab-panel').forEach(function(panel){
          panel.classList.toggle('active', panel.getAttribute('data-panel') === tabId);
        });
      }
      tabButtons.forEach(function(btn){
        btn.addEventListener('click', function(){
          activate(btn.getAttribute('data-tab'));
        });
      });
      activate(activeTab || 'overview');
    }

    function buildOverviewPayload(){
      return {
        name: ($('#po_name').value || '').trim(),
        tradingName: ($('#po_tradingName').value || '').trim() || null,
        email: ($('#po_email').value || '').trim() || null,
        phone: ($('#po_phone').value || '').trim() || null,
        status: ($('#po_status').value || 'PROSPECT'),
        notes: ($('#po_notes').value || '').trim() || null,
        logoUrl: ($('#po_logoUrl') && ($('#po_logoUrl').value || '').trim()) || null,
      };
    }

    function bindOverviewSave(){
      var saveBtn = $('#po_save');
      if (!saveBtn) return;
      saveBtn.addEventListener('click', async function(){
        var err = $('#po_error');
        if (err) err.textContent = '';
        var payload = buildOverviewPayload();
        if (!payload.name){
          if (err) err.textContent = 'Promoter name is required.';
          return;
        }
        try{
          await j('/admin/promoters/' + encodeURIComponent(promoterId), {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify(payload)
          });
          await loadPromoter();
        }catch(e){
          if (err) err.textContent = parseErr(e);
        }
      });
    }

    function bindLogoUpload(promoter){
      var uploadBtn = $('#po_logo_upload');
      var fileInput = $('#po_logo_file');
      if (!uploadBtn || !fileInput) return;
      uploadBtn.addEventListener('click', async function(){
        var err = $('#po_logo_error');
        if (err) err.textContent = '';
        var file = fileInput.files && fileInput.files[0];
        if (!file){
          if (err) err.textContent = 'Choose an image to upload.';
          return;
        }
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading…';
        try{
          var upload = await uploadPoster(file);
          var logoInput = $('#po_logoUrl');
          if (logoInput) logoInput.value = upload.url || '';
          var preview = $('#po_logo_preview');
          if (preview){
            preview.innerHTML = promoterAvatarHtml({
              name: $('#po_name').value || promoter.name,
              tradingName: $('#po_tradingName').value || promoter.tradingName,
              logoUrl: upload.url,
            }, { size: 72 });
          }
          var payload = buildOverviewPayload();
          if (!payload.name){
            if (err) err.textContent = 'Promoter name is required.';
            return;
          }
          await j('/admin/promoters/' + encodeURIComponent(promoterId), {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify(payload)
          });
          await loadPromoter();
        }catch(e){
          if (err) err.textContent = parseErr(e);
        }finally{
          uploadBtn.disabled = false;
          uploadBtn.textContent = 'Upload logo';
        }
      });
    }

    function renderContacts(promoter){
      var list = $('#promoterContactsList');
      if (!list) return;
      list.innerHTML = '';
      var contacts = promoter.contacts || [];
      if (!contacts.length){
        list.innerHTML = '<div class="muted">No contacts yet.</div>';
        return;
      }
      contacts.forEach(function(c){
        var card = document.createElement('div');
        card.className = 'card';
        card.style.margin = '0 0 12px 0';
        card.innerHTML = ''
          + '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;">'
          +   '<label style="display:grid;gap:6px;">Name<input data-field="name" value="' + escapeHtml(c.name || '') + '" /></label>'
          +   '<label style="display:grid;gap:6px;">Role<input data-field="role" value="' + escapeHtml(c.role || '') + '" /></label>'
          +   '<label style="display:grid;gap:6px;">Email<input data-field="email" type="email" value="' + escapeHtml(c.email || '') + '" /></label>'
          +   '<label style="display:grid;gap:6px;">Phone<input data-field="phone" value="' + escapeHtml(c.phone || '') + '" /></label>'
          +   '<label style="display:grid;gap:6px;">Tags (comma separated)<input data-field="tags" value="' + escapeHtml((c.tags || []).join(', ')) + '" /></label>'
          + '</div>'
          + '<div class="row" style="gap:12px;margin-top:10px;flex-wrap:wrap;">'
          +   '<label class="row" style="gap:6px;"><input type="checkbox" data-field="primaryFinance"' + (c.isPrimaryFinance ? ' checked' : '') + ' />Primary finance contact</label>'
          +   '<label class="row" style="gap:6px;"><input type="checkbox" data-field="primaryMarketing"' + (c.isPrimaryMarketing ? ' checked' : '') + ' />Primary marketing contact</label>'
          + '</div>'
          + '<div class="row" style="justify-content:flex-end;gap:8px;margin-top:10px;">'
          +   '<button class="btn p" data-action="save">Save</button>'
          +   '<button class="btn" data-action="delete">Delete</button>'
          + '</div>'
          + '<div class="error" data-error></div>';

        list.appendChild(card);

        var saveBtn = card.querySelector('[data-action="save"]');
        var deleteBtn = card.querySelector('[data-action="delete"]');
        var err = card.querySelector('[data-error]');

        if (saveBtn){
          saveBtn.addEventListener('click', async function(){
            if (err) err.textContent = '';
            var payload = {
              name: valueOf(card, 'name'),
              role: valueOf(card, 'role') || null,
              email: valueOf(card, 'email') || null,
              phone: valueOf(card, 'phone') || null,
              tags: parseTags(valueOf(card, 'tags')),
              isPrimaryFinance: checkboxOf(card, 'primaryFinance'),
              isPrimaryMarketing: checkboxOf(card, 'primaryMarketing'),
            };
            if (!payload.name){
              if (err) err.textContent = 'Contact name is required.';
              return;
            }
            try{
              await j('/admin/promoters/' + encodeURIComponent(promoterId) + '/contacts/' + encodeURIComponent(c.id), {
                method:'PATCH',
                headers:{'Content-Type':'application/json'},
                body: JSON.stringify(payload)
              });
              await loadPromoter();
            }catch(e){
              if (err) err.textContent = parseErr(e);
            }
          });
        }

        if (deleteBtn){
          deleteBtn.addEventListener('click', async function(){
            if (!confirm('Delete this contact?')) return;
            if (err) err.textContent = '';
            try{
              await j('/admin/promoters/' + encodeURIComponent(promoterId) + '/contacts/' + encodeURIComponent(c.id), {
                method:'DELETE'
              });
              await loadPromoter();
            }catch(e){
              if (err) err.textContent = parseErr(e);
            }
          });
        }
      });
    }

    function bindContactAdd(){
      var saveBtn = $('#pc_add_save');
      if (!saveBtn) return;
      saveBtn.addEventListener('click', async function(){
        var err = $('#pc_add_error');
        if (err) err.textContent = '';
        var payload = {
          name: ($('#pc_add_name').value || '').trim(),
          role: ($('#pc_add_role').value || '').trim() || null,
          email: ($('#pc_add_email').value || '').trim() || null,
          phone: ($('#pc_add_phone').value || '').trim() || null,
          tags: parseTags(($('#pc_add_tags').value || '').trim()),
          isPrimaryFinance: $('#pc_add_finance').checked,
          isPrimaryMarketing: $('#pc_add_marketing').checked,
        };
        if (!payload.name){
          if (err) err.textContent = 'Contact name is required.';
          return;
        }
        try{
          await j('/admin/promoters/' + encodeURIComponent(promoterId) + '/contacts', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify(payload)
          });
          resetContactForm();
          await loadPromoter();
        }catch(e){
          if (err) err.textContent = parseErr(e);
        }
      });
    }

    function resetContactForm(){
      $('#pc_add_name').value = '';
      $('#pc_add_role').value = '';
      $('#pc_add_email').value = '';
      $('#pc_add_phone').value = '';
      $('#pc_add_tags').value = '';
      $('#pc_add_finance').checked = false;
      $('#pc_add_marketing').checked = false;
    }

    function renderDocuments(promoter){
      var list = $('#promoterDocumentsList');
      if (!list) return;
      list.innerHTML = '';
      var documents = promoter.documents || [];
      if (!documents.length){
        list.innerHTML = '<div class="muted">No documents uploaded yet.</div>';
        return;
      }
      documents.forEach(function(doc){
        var card = document.createElement('div');
        card.className = 'card';
        card.style.margin = '0 0 12px 0';
        var statusLabel = documentStatus(doc);
        card.innerHTML = ''
          + '<div class="header">'
          +   '<div>'
          +     '<div class="title">' + escapeHtml(doc.title || 'Document') + '</div>'
          +     '<div class="muted">' + escapeHtml(docTypeLabel(doc.type)) + (doc.expiresAt ? ' • Expires ' + escapeHtml(formatDate(doc.expiresAt)) : '') + '</div>'
          +   '</div>'
          +   '<div class="row" style="gap:8px;align-items:center;">'
          +     '<span class="status-badge">' + escapeHtml(statusLabel) + '</span>'
          +     '<a class="btn" href="' + escapeHtml(doc.fileUrl || '#') + '" target="_blank" rel="noreferrer">Open</a>'
          +     '<button class="btn" data-action="delete">Remove</button>'
          +   '</div>'
          + '</div>';
        list.appendChild(card);

        var delBtn = card.querySelector('[data-action="delete"]');
        if (delBtn){
          delBtn.addEventListener('click', async function(){
            if (!confirm('Remove this document?')) return;
            try{
              await j('/admin/promoters/' + encodeURIComponent(promoterId) + '/documents/' + encodeURIComponent(doc.id), {
                method:'DELETE'
              });
              await loadPromoter();
            }catch(e){
              alert(parseErr(e));
            }
          });
        }
      });
    }

    function renderShows(){
      var list = $('#promoterShowsList');
      var select = $('#promoterShowSelect');
      var addBtn = $('#promoterShowAdd');
      var err = $('#promoterShowErr');
      var refreshBtn = $('#promoterShowsRefresh');

      if (!list || !select) return;

      var allShows = [];
      var linkedShows = [];

      function renderLinked(){
        if (!list) return;
        if (!linkedShows.length){
          list.innerHTML = '<div class="muted">No shows linked yet.</div>';
          return;
        }
        list.innerHTML = linkedShows.map(function(s){
          return ''
            + '<div class="row" style="justify-content:space-between;border-bottom:1px solid var(--border);padding:6px 0;">'
            +   '<div>'
            +     '<strong>' + escapeHtml(formatShowLabel(s)) + '</strong>'
            +   '</div>'
            +   '<button class="btn" data-unlink-show="'+escapeHtml(s.id)+'">Remove</button>'
            + '</div>';
        }).join('');

        $$('[data-unlink-show]', list).forEach(function(btn){
          btn.addEventListener('click', async function(e){
            e.preventDefault();
            var showId = btn.getAttribute('data-unlink-show');
            if (!showId) return;
            if (err) err.textContent = '';
            try{
              await j('/admin/promoters/' + encodeURIComponent(promoterId) + '/shows/' + encodeURIComponent(showId), {
                method:'DELETE',
              });
              await refresh();
            }catch(e){
              if (err) err.textContent = parseErr(e);
            }
          });
        });
      }

      function renderSelect(){
        var linkedIds = new Set(linkedShows.map(function(s){ return s.id; }));
        var options = allShows.filter(function(s){ return !linkedIds.has(s.id); });
        select.innerHTML = '<option value="">Select a show…</option>'
          + options.map(function(s){
            var label = formatShowLabel(s);
            return '<option value="'+escapeHtml(s.id)+'">'+escapeHtml(label)+'</option>';
          }).join('');

        if (!options.length){
          select.innerHTML = '<option value="">No available shows</option>';
        }
      }

      async function loadShows(){
        var res = await j('/admin/shows');
        allShows = (res && res.items) ? res.items : [];
      }

      async function loadLinked(){
        var res = await j('/admin/promoters/' + encodeURIComponent(promoterId) + '/shows');
        linkedShows = (res && res.shows) ? res.shows : [];
      }

      async function refresh(){
        if (err) err.textContent = '';
        if (list) list.innerHTML = '<div class="muted">Loading shows…</div>';
        try{
          await Promise.all([loadShows(), loadLinked()]);
          renderLinked();
          renderSelect();
        }catch(e){
          if (list) list.innerHTML = '';
          if (err) err.textContent = parseErr(e);
        }
      }

      if (addBtn){
        addBtn.addEventListener('click', async function(){
          if (!select.value) return;
          if (err) err.textContent = '';
          try{
            await j('/admin/promoters/' + encodeURIComponent(promoterId) + '/shows', {
              method:'POST',
              headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ showId: select.value })
            });
            await refresh();
          }catch(e){
            if (err) err.textContent = parseErr(e);
          }
        });
      }

      if (refreshBtn){
        refreshBtn.addEventListener('click', function(){
          refresh();
        });
      }

      refresh();
    }

    function bindDocumentUpload(){
      var uploadBtn = $('#pd_upload');
      if (!uploadBtn) return;
      uploadBtn.addEventListener('click', async function(){
        var err = $('#pd_error');
        if (err) err.textContent = '';
        var fileInput = $('#pd_file');
        var file = fileInput && fileInput.files ? fileInput.files[0] : null;
        var title = ($('#pd_title').value || '').trim();
        var type = ($('#pd_type').value || 'OTHER');
        var expiry = ($('#pd_expiry').value || '').trim();
        if (!title){
          if (err) err.textContent = 'Document title is required.';
          return;
        }
        if (!file){
          if (err) err.textContent = 'Choose a file to upload.';
          return;
        }
        try{
          uploadBtn.disabled = true;
          uploadBtn.textContent = 'Uploading…';
          var upload = await uploadPromoterDocument(file);
          await j('/admin/promoters/' + encodeURIComponent(promoterId) + '/documents', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({
              type: type,
              title: title,
              fileUrl: upload.url,
              fileName: upload.name,
              mime: upload.mime,
              size: upload.size,
              expiresAt: expiry || null,
            })
          });
          if (fileInput) fileInput.value = '';
          $('#pd_title').value = '';
          $('#pd_expiry').value = '';
          await loadPromoter();
        }catch(e){
          if (err) err.textContent = parseErr(e);
        }finally{
          uploadBtn.disabled = false;
          uploadBtn.textContent = 'Upload document';
        }
      });
    }

    function renderActivity(promoter){
      var list = $('#promoterActivityList');
      if (!list) return;
      list.innerHTML = '';
      var activities = promoter.activities || [];
      if (!activities.length){
        list.innerHTML = '<div class="muted">No activity yet.</div>';
        return;
      }
      activities.forEach(function(a){
        var card = document.createElement('div');
        card.className = 'card';
        card.style.margin = '0 0 12px 0';
        var meta = a.metadata ? JSON.stringify(a.metadata) : '';
        card.innerHTML = ''
          + '<div class="row" style="justify-content:space-between;gap:12px;align-items:flex-start;">'
          +   '<div>'
          +     '<div style="font-weight:700;">' + escapeHtml(activityLabel(a.type)) + '</div>'
          +     (meta ? '<div class="muted" style="margin-top:4px;">' + escapeHtml(meta) + '</div>' : '')
          +   '</div>'
          +   '<div class="muted" style="white-space:nowrap;">' + escapeHtml(formatDateTime(a.createdAt)) + '</div>'
          + '</div>';
        list.appendChild(card);
      });
    }

    async function uploadPromoterDocument(file){
      var form = new FormData();
      form.append('file', file);
      var res = await fetch('/admin/promoters/documents/upload', {
        method:'POST',
        body: form,
        credentials:'include'
      });
      var data = {};
      try{
        data = await res.json();
      }catch(e){}
      if (!res.ok || !data || !data.url){
        var message = (data && (data.error || data.message)) || 'Upload failed';
        throw new Error(message);
      }
      return data;
    }

    function parseTags(value){
      return (value || '').split(',').map(function(t){ return t.trim(); }).filter(Boolean);
    }

    function valueOf(root, field){
      var el = root.querySelector('[data-field="' + field + '"]');
      return el ? el.value.trim() : '';
    }

    function checkboxOf(root, field){
      var el = root.querySelector('[data-field="' + field + '"]');
      return el ? Boolean(el.checked) : false;
    }

    function docTypeLabel(type){
      var map = {
        PRS_CERTIFICATE: 'PRS certificate',
        PPL_MUSIC_LICENSING: 'PPL / music licensing',
        PUBLIC_LIABILITY_INSURANCE: 'Public liability insurance',
        RISK_ASSESSMENT: 'Risk assessment',
        TECH_SPEC: 'Tech spec',
        MARKETING_SPEC: 'Marketing spec',
        ACCESSIBILITY_INFO: 'Accessibility info',
        BRANDING_GUIDELINES: 'Branding guidelines / logo pack',
        OTHER: 'Other'
      };
      return map[type] || 'Other';
    }

    function activityLabel(type){
      var map = {
        CREATED: 'Promoter created',
        UPDATED: 'Profile updated',
        CONTACT_ADDED: 'Contact added',
        CONTACT_UPDATED: 'Contact updated',
        CONTACT_REMOVED: 'Contact removed',
        DOCUMENT_UPLOADED: 'Document uploaded',
        DOCUMENT_UPDATED: 'Document updated',
        DOCUMENT_REMOVED: 'Document removed'
      };
      return map[type] || String(type || 'Activity');
    }

    function documentStatus(doc){
      if (doc.expiresAt){
        var expiry = new Date(doc.expiresAt);
        if (!isNaN(expiry.getTime()) && expiry < new Date()){
          return 'Expired';
        }
      }
      var map = {
        MISSING: 'Missing',
        UPLOADED: 'Uploaded',
        EXPIRED: 'Expired',
        APPROVED: 'Approved'
      };
      return map[doc.status] || 'Uploaded';
    }

    function formatDate(value){
      var d = new Date(value);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('en-GB');
    }

    function formatDateTime(value){
      var d = new Date(value);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleString('en-GB');
    }

  }
  function productStorePage(){
    if (!main) return;
    main.innerHTML = ''
      + '<div class="card">'
      +   '<div class="header" style="gap:12px;align-items:center;">'
      +     '<div>'
      +       '<div class="title">Product Store</div>'
      +       '<div class="muted">Build merch, add-ons, and digital products that sell alongside tickets.</div>'
      +     '</div>'
      +     '<div class="row" style="gap:8px;flex-wrap:wrap;">'
      +       '<button class="btn p" id="ps_create">Create product</button>'
      +       '<button class="btn" id="ps_orders">View orders</button>'
      +       '<button class="btn" id="ps_settings">Storefront settings</button>'
      +     '</div>'
      +   '</div>'
      +   '<div id="ps_cta" class="card" style="margin-top:12px;display:none;">'
      +     '<div class="title">Create your storefront</div>'
      +     '<div class="muted" style="margin-top:6px;">Add a slug, branding, and tax/fulfilment defaults to start selling products.</div>'
      +     '<button class="btn p" id="ps_create_store" style="margin-top:10px;">Set up storefront</button>'
      +   '</div>'
      +   '<div class="snapshot-grid" id="ps_snapshot">'
      +     '<div class="snapshot-block">'
      +       '<div class="muted" style="font-size:12px;">Storefront URL</div>'
      +       '<div class="title" style="margin-top:6px;" id="ps_storefront_url">—</div>'
      +       '<div class="muted" style="margin-top:6px;" id="ps_storefront_status">Status: —</div>'
      +     '</div>'
      +     '<div class="snapshot-block">'
      +       '<div class="muted" style="font-size:12px;">Product coverage</div>'
      +       '<div class="title" style="margin-top:6px;" id="ps_product_counts">0 active products</div>'
      +       '<div class="muted" style="margin-top:6px;" id="ps_product_counts_detail">0 drafts · 0 archived</div>'
      +     '</div>'
      +     '<div class="snapshot-block">'
      +       '<div class="muted" style="font-size:12px;">Add-on attach rate</div>'
      +       '<div class="title" style="margin-top:6px;" id="ps_attach_rate">0%</div>'
      +       '<div class="muted" style="margin-top:6px;">Last 30 days</div>'
      +     '</div>'
      +   '</div>'
      + '</div>'
      + '<div class="grid grid-2" style="margin-top:16px;">'
      +   '<div class="card">'
      +     '<div class="header">'
      +       '<div>'
      +         '<div class="title">Product catalogue</div>'
      +         '<div class="muted">Merch, add-ons, vouchers, digital, and donations.</div>'
      +       '</div>'
      +       '<div class="row" style="gap:8px;">'
      +         '<input id="ps_search" class="input" placeholder="Search products" />'
      +         '<button class="btn" id="ps_search_btn">Search</button>'
      +       '</div>'
      +     '</div>'
      +     '<div class="table-list" id="ps_products_table">'
      +       '<div class="table-row head">'
      +         '<div>Product</div>'
      +         '<div>Category</div>'
      +         '<div>Fulfilment</div>'
      +         '<div>Inventory</div>'
      +         '<div>Status</div>'
      +       '</div>'
      +     '</div>'
      +   '</div>'
      +   '<div class="card">'
      +     '<div class="title">Checkout add-ons &amp; upsells</div>'
      +     '<div class="muted" style="margin-top:6px;">Attach products to shows, ticket types, or both.</div>'
      +     '<div class="muted" style="margin-top:10px;">Manage rules in the upsells manager.</div>'
      +     '<button class="btn" id="ps_upsells" style="margin-top:10px;">Manage upsells</button>'
      +     '<div class="grid" style="margin-top:12px;" id="ps_top_products"></div>'
      +   '</div>'
      + '</div>'
      + '<div class="card" style="margin-top:16px;">'
      +   '<div class="header">'
      +     '<div>'
      +       '<div class="title">Orders &amp; fulfilment</div>'
      +       '<div class="muted">Export CSV, track fulfilment status, and keep one order for tickets + products.</div>'
      +     '</div>'
      +     '<button class="btn" id="ps_orders_footer">View orders</button>'
      +   '</div>'
      +   '<div class="grid grid-2" style="margin-top:12px;">'
      +     '<div class="snapshot-block">'
      +       '<div class="muted" style="font-size:12px;">Revenue</div>'
      +       '<div class="title" style="margin-top:6px;" id="ps_revenue_7d">£0.00 (7d)</div>'
      +       '<div class="muted" style="margin-top:6px;" id="ps_revenue_month">£0.00 this month</div>'
      +     '</div>'
      +     '<div class="snapshot-block">'
      +       '<div class="muted" style="font-size:12px;">Stock alerts</div>'
      +       '<div class="title" style="margin-top:6px;" id="ps_stock_alerts">0 low stock</div>'
      +       '<div class="muted" style="margin-top:6px;" id="ps_stock_names">—</div>'
      +     '</div>'
      +   '</div>'
      + '</div>';

    function money(pence){
      return '£' + ((Number(pence || 0) / 100).toFixed(2));
    }

    var btnCreate = $('#ps_create');
    var btnOrders = $('#ps_orders');
    var btnOrdersFooter = $('#ps_orders_footer');
    var btnSettings = $('#ps_settings');
    var btnUpsells = $('#ps_upsells');
    var btnCreateStore = $('#ps_create_store');

    if (btnCreate) btnCreate.addEventListener('click', function(){ go('/admin/ui/product-store/products/new'); });
    if (btnOrders) btnOrders.addEventListener('click', function(){ go('/admin/ui/product-store/orders'); });
    if (btnOrdersFooter) btnOrdersFooter.addEventListener('click', function(){ go('/admin/ui/product-store/orders'); });
    if (btnSettings) btnSettings.addEventListener('click', function(){ go('/admin/ui/product-store/settings'); });
    if (btnUpsells) btnUpsells.addEventListener('click', function(){ go('/admin/ui/product-store/upsells'); });
    if (btnCreateStore) btnCreateStore.addEventListener('click', function(){ go('/admin/ui/product-store/settings'); });

    var searchBtn = $('#ps_search_btn');
    if (searchBtn){
      searchBtn.addEventListener('click', function(){ loadProducts(); });
    }

    async function loadSummary(){
      try{
        var data = await j('/admin/api/product-store/summary');
        var summary = data && data.summary;
        if (!summary || !summary.storefront){
          $('#ps_cta').style.display = 'block';
          $('#ps_snapshot').style.display = 'none';
          return;
        }
        var storefront = summary.storefront;
        $('#ps_storefront_url').textContent = '/store/' + storefront.slug;
        $('#ps_storefront_status').innerHTML = 'Status: <span class="pill ' + (storefront.status === 'LIVE' ? 'good' : '') + '\">' + storefront.status + '</span>';
        $('#ps_product_counts').textContent = summary.counts.active + ' active products';
        $('#ps_product_counts_detail').textContent = summary.counts.draft + ' drafts · ' + summary.counts.archived + ' archived';
        $('#ps_attach_rate').textContent = (summary.attachRate || 0).toFixed(1) + '%';
        $('#ps_revenue_7d').textContent = money(summary.revenue.last7Days) + ' (7d)';
        $('#ps_revenue_month').textContent = money(summary.revenue.thisMonth) + ' this month';
        $('#ps_stock_alerts').textContent = (summary.lowStockAlerts || []).length + ' low stock';
        $('#ps_stock_names').textContent = (summary.lowStockAlerts || []).map(function(p){ return p.title; }).join(', ') || '—';
        var top = $('#ps_top_products');
        if (top){
          top.innerHTML = (summary.topProducts || []).map(function(p){
            return '<div class="snapshot-block"><div class="title">' + p.title + '</div><div class="muted" style="margin-top:6px;">Revenue ' + money(p.revenuePence) + '</div></div>';
          }).join('') || '<div class="muted">No upsells yet.</div>';
        }
      }catch(err){
        console.error('product store summary failed', err);
      }
    }

    async function loadProducts(){
      try{
        var q = ($('#ps_search').value || '').trim();
        var url = '/admin/api/product-store/products' + (q ? ('?q=' + encodeURIComponent(q)) : '');
        var data = await j(url);
        var rows = (data.products || []).map(function(p){
          var inventory = p.inventoryMode === 'TRACKED'
            ? ((p.stockCount !== null && p.stockCount !== undefined) ? (p.stockCount + ' in stock') : 'Tracked')
            : 'Unlimited';
          return ''
            + '<div class="table-row">'
            +   '<div>'
            +     '<div class="title">' + p.title + '</div>'
            +     '<div class="muted">' + (p.variants && p.variants.length ? ('Variants: ' + p.variants.length) : 'Single') + '</div>'
            +   '</div>'
            +   '<div>' + p.category + '</div>'
            +   '<div><span class="pill">' + p.fulfilmentType + '</span></div>'
            +   '<div>' + inventory + '</div>'
            +   '<div><span class="status-badge ' + (p.status === 'ACTIVE' ? 'paid' : '') + '\">' + p.status + '</span></div>'
            + '</div>';
        }).join('');

        var table = $('#ps_products_table');
        table.innerHTML = '<div class="table-row head"><div>Product</div><div>Category</div><div>Fulfilment</div><div>Inventory</div><div>Status</div></div>' + rows;

        $$('#ps_products_table .table-row').forEach(function(row, idx){
          if (idx === 0) return;
          row.addEventListener('click', function(){
            var product = (data.products || [])[idx-1];
            if (product){
              go('/admin/ui/product-store/products/' + product.id + '/edit');
            }
          });
        });
      }catch(err){
        console.error('product store products failed', err);
      }
    }

    loadSummary();
    loadProducts();
  }
  function productStoreSettingsPage(){
    if (!main) return;
    main.innerHTML = ''
      + '<div class="card">'
      +   '<div class="title">Storefront settings</div>'
      +   '<div class="muted">Manage your store slug, branding, and tax/fulfilment defaults.</div>'
      +   '<div class="grid" style="margin-top:12px;">'
      +     '<input id="ps_name" class="input" placeholder="Store name" />'
      +     '<input id="ps_slug" class="input" placeholder="Store slug" />'
      +     '<input id="ps_logo" class="input" placeholder="Logo URL" />'
      +     '<input id="ps_brand" class="input" placeholder="Brand colour (hex)" />'
      +     '<input id="ps_support" class="input" placeholder="Support email" />'
      +     '<textarea id="ps_policies" class="input" placeholder="Policies / refund notes"></textarea>'
      +     '<select id="ps_status" class="input">'
      +       '<option value="DRAFT">Draft</option>'
      +       '<option value="LIVE">Live</option>'
      +     '</select>'
      +     '<select id="ps_tax_mode" class="input">'
      +       '<option value="NONE">No tax</option>'
      +       '<option value="VAT">VAT %</option>'
      +       '<option value="CUSTOM">Custom %</option>'
      +     '</select>'
      +     '<input id="ps_tax_percent" class="input" placeholder="Tax percent" type="number" />'
      +     '<label><input type="checkbox" id="ps_ship_enabled" /> Shipping enabled</label>'
      +     '<label><input type="checkbox" id="ps_collect_enabled" /> Collection enabled</label>'
      +     '<label><input type="checkbox" id="ps_digital_enabled" /> Digital enabled</label>'
      +     '<input id="ps_shipping_fee" class="input" placeholder="Shipping flat fee (pence)" type="number" />'
      +   '</div>'
      +   '<div class="row" style="gap:8px;margin-top:12px;">'
      +     '<button class="btn p" id="ps_settings_save">Save settings</button>'
      +     '<button class="btn" id="ps_settings_back">Back</button>'
      +     '<div class="muted" id="ps_settings_msg"></div>'
      +   '</div>'
      + '</div>';

    $('#ps_settings_back').addEventListener('click', function(){ go('/admin/ui/product-store'); });

    async function loadSettings(){
      try{
        var data = await j('/admin/api/product-store/storefront');
        var sf = data.storefront;
        if (!sf) return;
        $('#ps_name').value = sf.name || '';
        $('#ps_slug').value = sf.slug || '';
        $('#ps_logo').value = sf.logoUrl || '';
        $('#ps_brand').value = sf.brandColour || '';
        $('#ps_support').value = sf.supportEmail || '';
        $('#ps_policies').value = sf.policiesText || '';
        $('#ps_status').value = sf.status || 'DRAFT';
        $('#ps_tax_mode').value = sf.taxMode || 'NONE';
        $('#ps_tax_percent').value = (sf.taxPercent !== null && sf.taxPercent !== undefined) ? sf.taxPercent : '';
        $('#ps_ship_enabled').checked = !!sf.shippingEnabled;
        $('#ps_collect_enabled').checked = !!sf.collectionEnabled;
        $('#ps_digital_enabled').checked = !!sf.digitalEnabled;
        $('#ps_shipping_fee').value = (sf.shippingFlatFeePence !== null && sf.shippingFlatFeePence !== undefined) ? sf.shippingFlatFeePence : '';
      }catch(err){
        console.error('storefront settings load failed', err);
      }
    }

    $('#ps_settings_save').addEventListener('click', async function(){
      $('#ps_settings_msg').textContent = '';
      try{
        var payload = {
          name: ($('#ps_name').value || '').trim(),
          slug: ($('#ps_slug').value || '').trim(),
          logoUrl: ($('#ps_logo').value || '').trim(),
          brandColour: ($('#ps_brand').value || '').trim(),
          supportEmail: ($('#ps_support').value || '').trim(),
          policiesText: ($('#ps_policies').value || '').trim(),
          status: $('#ps_status').value,
          taxMode: $('#ps_tax_mode').value,
          taxPercent: $('#ps_tax_percent').value,
          shippingEnabled: $('#ps_ship_enabled').checked,
          collectionEnabled: $('#ps_collect_enabled').checked,
          digitalEnabled: $('#ps_digital_enabled').checked,
          shippingFlatFeePence: $('#ps_shipping_fee').value,
        };
        var data = await j('/admin/api/product-store/storefront', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(payload)
        });
        if (data && data.ok){
          $('#ps_settings_msg').textContent = 'Settings saved';
        }
      }catch(err){
        $('#ps_settings_msg').textContent = parseErr(err);
      }
    });

    loadSettings();
  }

  function productStoreProductForm(productId){
    if (!main) return;
    var isEdit = !!productId;
    main.innerHTML = ''
      + '<div class="ps-create-page">'
      +   '<div class="card ps-create-hero">'
      +     '<div>'
      +       '<div class="ps-eyebrow">Product store</div>'
      +       '<div class="title">' + (isEdit ? 'Edit product' : 'Create product') + '</div>'
      +       '<div class="muted">Keep it simple: add photos, a clear title, and pricing. You can refine details anytime.</div>'
      +     '</div>'
      +     '<button class="btn" id="ps_prod_back">Back</button>'
      +   '</div>'
      +   '<div class="card ps-section">'
      +     '<div class="ps-section-header">'
      +       '<div>'
      +         '<div class="section-title">Photos</div>'
      +         '<div class="muted">First photo becomes the cover image.</div>'
      +       '</div>'
      +       '<span class="ps-chip">Step 1</span>'
      +     '</div>'
      +     '<div class="ps-upload-card">'
      +       '<button class="btn p" id="ps_add_image">+ Add photos</button>'
      +       '<div class="muted">Use bright, square images for best results.</div>'
      +     '</div>'
      +     '<div id="ps_image_rows" class="ps-row-list"></div>'
      +   '</div>'
      +   '<div class="card ps-section">'
      +     '<div class="ps-section-header">'
      +       '<div>'
      +         '<div class="section-title">Listing details</div>'
      +         '<div class="muted">Help buyers understand what they’re getting.</div>'
      +       '</div>'
      +       '<span class="ps-chip">Step 2</span>'
      +     '</div>'
      +     '<div class="ps-form-grid">'
      +       '<label class="ps-field">'
      +         '<span>Title</span>'
      +         '<input id="ps_prod_title" class="input" placeholder="Title" />'
      +       '</label>'
      +       '<label class="ps-field">'
      +         '<span>Slug</span>'
      +         '<input id="ps_prod_slug" class="input" placeholder="Slug" />'
      +       '</label>'
      +       '<label class="ps-field ps-field-wide">'
      +         '<span>Description</span>'
      +         '<textarea id="ps_prod_desc" class="input" placeholder="Describe the product"></textarea>'
      +       '</label>'
      +       '<label class="ps-field">'
      +         '<span>Category</span>'
      +         '<select id="ps_prod_category" class="input">'
      +           '<option value="MERCH">Merch</option>'
      +           '<option value="ADDON">Add-on</option>'
      +           '<option value="DIGITAL">Digital</option>'
      +           '<option value="DONATION">Donation</option>'
      +           '<option value="VOUCHER">Voucher</option>'
      +         '</select>'
      +       '</label>'
      +       '<label class="ps-field">'
      +         '<span>Fulfilment</span>'
      +         '<select id="ps_prod_fulfilment" class="input">'
      +           '<option value="NONE">None</option>'
      +           '<option value="SHIPPING">Shipping</option>'
      +           '<option value="COLLECT">Collect</option>'
      +           '<option value="EMAIL">Email</option>'
      +         '</select>'
      +       '</label>'
      +       '<label class="ps-field">'
      +         '<span>Status</span>'
      +         '<select id="ps_prod_status" class="input">'
      +           '<option value="DRAFT">Draft</option>'
      +           '<option value="ACTIVE">Active</option>'
      +           '<option value="ARCHIVED">Archived</option>'
      +         '</select>'
      +       '</label>'
      +     '</div>'
      +   '</div>'
      +   '<div class="card ps-section">'
      +     '<div class="ps-section-header">'
      +       '<div>'
      +         '<div class="section-title">Pricing & inventory</div>'
      +         '<div class="muted">Set a simple price or allow custom amounts.</div>'
      +       '</div>'
      +       '<span class="ps-chip">Step 3</span>'
      +     '</div>'
      +     '<div class="ps-form-grid">'
      +       '<label class="ps-field">'
      +         '<span>Price (pence)</span>'
      +         '<input id="ps_prod_price" class="input" placeholder="Price (pence)" type="number" />'
      +       '</label>'
      +       '<label class="ps-check">'
      +         '<input type="checkbox" id="ps_prod_custom" /> Allow custom amount'
      +       '</label>'
      +       '<label class="ps-field">'
      +         '<span>Inventory mode</span>'
      +         '<select id="ps_prod_inventory" class="input">'
      +           '<option value="UNLIMITED">Unlimited</option>'
      +           '<option value="TRACKED">Tracked</option>'
      +         '</select>'
      +       '</label>'
      +       '<label class="ps-field">'
      +         '<span>Stock count</span>'
      +         '<input id="ps_prod_stock" class="input" placeholder="Stock count" type="number" />'
      +       '</label>'
      +       '<label class="ps-field">'
      +         '<span>Low stock threshold</span>'
      +         '<input id="ps_prod_low_stock" class="input" placeholder="Low stock threshold" type="number" />'
      +       '</label>'
      +       '<label class="ps-check">'
      +         '<input type="checkbox" id="ps_prod_preorder" /> Preorder enabled'
      +       '</label>'
      +       '<label class="ps-field">'
      +         '<span>Preorder close (YYYY-MM-DD)</span>'
      +         '<input id="ps_prod_preorder_close" class="input" placeholder="Preorder close (YYYY-MM-DD)" />'
      +       '</label>'
      +       '<label class="ps-field">'
      +         '<span>Max per order</span>'
      +         '<input id="ps_prod_max_order" class="input" placeholder="Max per order" type="number" />'
      +       '</label>'
      +       '<label class="ps-field">'
      +         '<span>Max per ticket</span>'
      +         '<input id="ps_prod_max_ticket" class="input" placeholder="Max per ticket" type="number" />'
      +       '</label>'
      +     '</div>'
      +   '</div>'
      +   '<div class="card ps-section">'
      +     '<div class="ps-section-header">'
      +       '<div>'
      +         '<div class="section-title">Variants</div>'
      +         '<div class="muted">Add options like sizes or bundles.</div>'
      +       '</div>'
      +       '<span class="ps-chip">Optional</span>'
      +     '</div>'
      +     '<div id="ps_variant_rows" class="ps-row-list"></div>'
      +     '<button class="btn" id="ps_add_variant">Add variant</button>'
      +   '</div>'
      +   '<div class="ps-tip-card">'
      +     '<div>'
      +       '<div class="ps-tip-title">Tip: Keep it punchy</div>'
      +       '<div class="ps-tip-text">Short titles and clear pricing help buyers check out faster.</div>'
      +     '</div>'
      +     '<span class="ps-tip-link">Learn more</span>'
      +   '</div>'
      +   '<div class="ps-action-bar">'
      +     '<button class="btn p" id="ps_prod_save">Save product</button>'
      +     '<div class="muted" id="ps_prod_msg"></div>'
      +   '</div>'
      + '</div>';

    function slugifyLocal(value){
      return String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
    }

    function addVariantRow(data){
      var row = document.createElement('div');
      row.className = 'row';
      row.style.gap = '8px';
      row.style.marginTop = '8px';
      row.innerHTML = ''
        + '<input class="input" placeholder="Title" data-field="title" />'
        + '<input class="input" placeholder="SKU" data-field="sku" />'
        + '<input class="input" placeholder="Price override" type="number" data-field="price" />'
        + '<input class="input" placeholder="Stock override" type="number" data-field="stock" />'
        + '<button class="btn" data-remove>Remove</button>';
      $('#ps_variant_rows').appendChild(row);
      if (data){
        row.querySelector('[data-field="title"]').value = data.title || '';
        row.querySelector('[data-field="sku"]').value = data.sku || '';
        row.querySelector('[data-field="price"]').value = data.pricePenceOverride ?? '';
        row.querySelector('[data-field="stock"]').value = data.stockCountOverride ?? '';
      }
      row.querySelector('[data-remove]').addEventListener('click', function(){ row.remove(); });
    }

    function addImageRow(data){
      var row = document.createElement('div');
      row.className = 'row';
      row.style.gap = '8px';
      row.style.marginTop = '8px';
      row.innerHTML = ''
        + '<input class="input" placeholder="Image URL" data-field="url" />'
        + '<input class="input" placeholder="Sort order" type="number" data-field="sort" />'
        + '<button class="btn" data-remove>Remove</button>';
      $('#ps_image_rows').appendChild(row);
      if (data){
        row.querySelector('[data-field="url"]').value = data.url || '';
        row.querySelector('[data-field="sort"]').value = data.sortOrder ?? '';
      }
      row.querySelector('[data-remove]').addEventListener('click', function(){ row.remove(); });
    }

    $('#ps_add_variant').addEventListener('click', function(){ addVariantRow(); });
    $('#ps_add_image').addEventListener('click', function(){ addImageRow(); });
    $('#ps_prod_back').addEventListener('click', function(){ go('/admin/ui/product-store'); });

    $('#ps_prod_title').addEventListener('input', function(){
      if (!$('#ps_prod_slug').value){
        $('#ps_prod_slug').value = slugifyLocal($('#ps_prod_title').value);
      }
    });

    function collectVariants(){
      return Array.prototype.slice.call($('#ps_variant_rows').children).map(function(row, index){
        return {
          title: row.querySelector('[data-field="title"]').value.trim(),
          sku: row.querySelector('[data-field="sku"]').value.trim() || null,
          pricePenceOverride: row.querySelector('[data-field="price"]').value,
          stockCountOverride: row.querySelector('[data-field="stock"]').value,
          sortOrder: index,
        };
      }).filter(function(v){ return v.title; });
    }

    function collectImages(){
      return Array.prototype.slice.call($('#ps_image_rows').children).map(function(row, index){
        return {
          url: row.querySelector('[data-field="url"]').value.trim(),
          sortOrder: row.querySelector('[data-field="sort"]').value || index,
        };
      }).filter(function(i){ return i.url; });
    }

    async function loadProduct(){
      if (!productId) return;
      try{
        var data = await j('/admin/api/product-store/products/' + productId);
        var p = data.product;
        if (!p) return;
        $('#ps_prod_title').value = p.title || '';
        $('#ps_prod_slug').value = p.slug || '';
        $('#ps_prod_desc').value = p.description || '';
        $('#ps_prod_category').value = p.category || 'MERCH';
        $('#ps_prod_fulfilment').value = p.fulfilmentType || 'NONE';
        $('#ps_prod_status').value = p.status || 'DRAFT';
        $('#ps_prod_price').value = p.pricePence ?? '';
        $('#ps_prod_custom').checked = !!p.allowCustomAmount;
        $('#ps_prod_inventory').value = p.inventoryMode || 'UNLIMITED';
        $('#ps_prod_stock').value = p.stockCount ?? '';
        $('#ps_prod_low_stock').value = p.lowStockThreshold ?? '';
        $('#ps_prod_preorder').checked = !!p.preorderEnabled;
        $('#ps_prod_preorder_close').value = p.preorderCloseAt ? p.preorderCloseAt.split('T')[0] : '';
        $('#ps_prod_max_order').value = p.maxPerOrder ?? '';
        $('#ps_prod_max_ticket').value = p.maxPerTicket ?? '';
        (p.variants || []).forEach(addVariantRow);
        (p.images || []).forEach(addImageRow);
      }catch(err){
        console.error('load product failed', err);
      }
    }

    $('#ps_prod_save').addEventListener('click', async function(){
      $('#ps_prod_msg').textContent = '';
      try{
        var payload = {
          title: ($('#ps_prod_title').value || '').trim(),
          slug: ($('#ps_prod_slug').value || '').trim(),
          description: ($('#ps_prod_desc').value || '').trim(),
          category: $('#ps_prod_category').value,
          fulfilmentType: $('#ps_prod_fulfilment').value,
          status: $('#ps_prod_status').value,
          pricePence: $('#ps_prod_price').value,
          allowCustomAmount: $('#ps_prod_custom').checked,
          inventoryMode: $('#ps_prod_inventory').value,
          stockCount: $('#ps_prod_stock').value,
          lowStockThreshold: $('#ps_prod_low_stock').value,
          preorderEnabled: $('#ps_prod_preorder').checked,
          preorderCloseAt: $('#ps_prod_preorder_close').value,
          maxPerOrder: $('#ps_prod_max_order').value,
          maxPerTicket: $('#ps_prod_max_ticket').value,
          variants: collectVariants(),
          images: collectImages(),
        };
        var url = '/admin/api/product-store/products' + (productId ? '/' + productId : '');
        var method = productId ? 'PUT' : 'POST';
        var data = await j(url, {
          method: method,
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify(payload)
        });
        if (data && data.ok){
          $('#ps_prod_msg').textContent = 'Saved';
          if (!productId && data.product && data.product.id){
            go('/admin/ui/product-store/products/' + data.product.id + '/edit');
          }
        }
      }catch(err){
        $('#ps_prod_msg').textContent = parseErr(err);
      }
    });

    loadProduct();
  }

  function productStoreOrdersPage(){
    if (!main) return;
    main.innerHTML = ''
      + '<div class="card">'
      +   '<div class="header">'
      +     '<div>'
      +       '<div class="title">Product orders</div>'
      +       '<div class="muted">Track fulfilment and export data.</div>'
      +     '</div>'
      +     '<button class="btn" id="ps_orders_back">Back</button>'
      +   '</div>'
      +   '<div class="table-list" id="ps_orders_table">'
      +     '<div class="table-row head">'
      +       '<div>Date</div>'
      +       '<div>Customer</div>'
      +       '<div>Source</div>'
      +       '<div>Total</div>'
      +       '<div>Fulfilment</div>'
      +     '</div>'
      +   '</div>'
      + '</div>';

    $('#ps_orders_back').addEventListener('click', function(){ go('/admin/ui/product-store'); });

    function money(pence){
      return '£' + ((Number(pence || 0) / 100).toFixed(2));
    }

    async function loadOrders(){
      try{
        var data = await j('/admin/api/product-store/orders');
        var rows = (data.orders || []).map(function(o){
          var date = o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-GB') : '';
          return ''
            + '<div class="table-row">'
            +   '<div>' + date + '</div>'
            +   '<div>' + (o.customerEmail || o.customerName || 'Guest') + '</div>'
            +   '<div>' + o.source + '</div>'
            +   '<div>' + money(o.totalPence) + '</div>'
            +   '<div><span class="pill">' + o.fulfilmentStatus + '</span></div>'
            + '</div>';
        }).join('');
        $('#ps_orders_table').innerHTML = '<div class="table-row head"><div>Date</div><div>Customer</div><div>Source</div><div>Total</div><div>Fulfilment</div></div>' + rows;
        $$('#ps_orders_table .table-row').forEach(function(row, idx){
          if (idx === 0) return;
          row.addEventListener('click', function(){
            var order = (data.orders || [])[idx-1];
            if (order){ go('/admin/ui/product-store/orders/' + order.id); }
          });
        });
      }catch(err){
        console.error('product orders load failed', err);
      }
    }

    loadOrders();
  }

  function productStoreOrderDetailPage(orderId){
    if (!main) return;
    main.innerHTML = ''
      + '<div class="card">'
      +   '<div class="header">'
      +     '<div>'
      +       '<div class="title">Order detail</div>'
      +       '<div class="muted" id="ps_order_meta">Loading...</div>'
      +     '</div>'
      +     '<button class="btn" id="ps_order_back">Back</button>'
      +   '</div>'
      +   '<div id="ps_order_items"></div>'
      + '</div>';

    $('#ps_order_back').addEventListener('click', function(){ go('/admin/ui/product-store/orders'); });

    function money(pence){
      return '£' + ((Number(pence || 0) / 100).toFixed(2));
    }

    async function loadOrder(){
      try{
        var data = await j('/admin/api/product-store/orders/' + orderId);
        var order = data.order;
        if (!order) return;
        $('#ps_order_meta').textContent = (order.customerEmail || 'Guest') + ' · ' + money(order.totalPence);
        var html = (order.items || []).map(function(item){
          return ''
            + '<div class="card" style="margin-top:12px;">'
            +   '<div class="title">' + item.titleSnapshot + '</div>'
            +   '<div class="muted">Qty ' + item.qty + ' · ' + money(item.lineTotalPence) + '</div>'
            +   '<div class="muted">Fulfilment: ' + item.fulfilmentTypeSnapshot + '</div>'
            +   '<div class="row" style="gap:8px;margin-top:8px;">'
            +     '<input class="input" data-tracking placeholder="Tracking number" />'
            +     '<input class="input" data-dispatch placeholder="Dispatch date" />'
            +     '<input class="input" data-notes placeholder="Notes" />'
            +     '<button class="btn" data-fulfil>Mark fulfilled</button>'
            +   '</div>'
            + '</div>';
        }).join('');
        $('#ps_order_items').innerHTML = html || '<div class="muted">No items.</div>';
        $$('#ps_order_items [data-fulfil]').forEach(function(btn, idx){
          btn.addEventListener('click', async function(){
            var wrap = btn.closest('.card');
            var item = (order.items || [])[idx];
            if (!item) return;
            var metadata = {
              trackingNumber: wrap.querySelector('[data-tracking]').value,
              dispatchDate: wrap.querySelector('[data-dispatch]').value,
              notes: wrap.querySelector('[data-notes]').value,
            };
            await j('/admin/api/product-store/orders/' + orderId + '/fulfil', {
              method:'POST',
              headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ itemId: item.id, status: 'FULFILLED', metadata: metadata })
            });
            loadOrder();
          });
        });
      }catch(err){
        console.error('order detail load failed', err);
      }
    }

    loadOrder();
  }

  function productStoreUpsellsPage(){
    if (!main) return;
    main.innerHTML = ''
      + '<div class="card">'
      +   '<div class="header">'
      +     '<div>'
      +       '<div class="title">Upsell rules</div>'
      +       '<div class="muted">Attach products to shows and ticket types.</div>'
      +     '</div>'
      +     '<button class="btn" id="ps_upsells_back">Back</button>'
      +   '</div>'
      +   '<div class="grid" style="margin-top:12px;">'
      +     '<select id="ps_upsell_show" class="input"></select>'
      +     '<select id="ps_upsell_ticket" class="input"></select>'
      +     '<select id="ps_upsell_product" class="input"></select>'
      +     '<select id="ps_upsell_variant" class="input"></select>'
      +     '<input id="ps_upsell_priority" class="input" placeholder="Priority" type="number" value="1" />'
      +     '<label><input type="checkbox" id="ps_upsell_recommended" checked /> Recommended</label>'
      +     '<button class="btn p" id="ps_upsell_add">Add rule</button>'
      +   '</div>'
      +   '<div id="ps_upsell_list" style="margin-top:12px;"></div>'
      + '</div>';

    $('#ps_upsells_back').addEventListener('click', function(){ go('/admin/ui/product-store'); });

    var state = { shows: [], products: [] };

    function renderShows(){
      var sel = $('#ps_upsell_show');
      sel.innerHTML = '<option value="">Select show</option>' + state.shows.map(function(s){
        return '<option value="' + s.id + '">' + (s.title || 'Untitled') + '</option>';
      }).join('');
    }

    function renderTicketTypes(showId){
      var sel = $('#ps_upsell_ticket');
      var show = state.shows.find(function(s){ return s.id === showId; });
      var tickets = (show && show.ticketTypes) ? show.ticketTypes : [];
      sel.innerHTML = '<option value="">All ticket types</option>' + tickets.map(function(t){
        return '<option value="' + t.id + '">' + t.name + '</option>';
      }).join('');
    }

    function renderProducts(){
      var sel = $('#ps_upsell_product');
      sel.innerHTML = '<option value="">Select product</option>' + state.products.map(function(p){
        return '<option value="' + p.id + '">' + p.title + '</option>';
      }).join('');
    }

    function renderVariants(productId){
      var sel = $('#ps_upsell_variant');
      var product = state.products.find(function(p){ return p.id === productId; });
      var variants = (product && product.variants) ? product.variants : [];
      sel.innerHTML = '<option value="">All variants</option>' + variants.map(function(v){
        return '<option value="' + v.id + '">' + v.title + '</option>';
      }).join('');
    }

    async function loadOptions(){
      try{
        var data = await j('/admin/api/product-store/options');
        state.shows = data.shows || [];
        state.products = data.products || [];
        renderShows();
        renderProducts();
      }catch(err){
        console.error('upsell options load failed', err);
      }
    }

    async function loadRules(){
      var showId = $('#ps_upsell_show').value;
      if (!showId){
        $('#ps_upsell_list').innerHTML = '<div class="muted">Select a show to view upsells.</div>';
        return;
      }
      try{
        var data = await j('/admin/api/product-store/upsells?showId=' + encodeURIComponent(showId));
        $('#ps_upsell_list').innerHTML = (data.rules || []).map(function(rule){
          return ''
            + '<div class="snapshot-block" style="margin-bottom:10px;">'
            +   '<div class="title">' + rule.product.title + '</div>'
            +   '<div class="muted">Priority ' + rule.priority + ' · ' + (rule.active ? 'Active' : 'Inactive') + '</div>'
            +   '<button class="btn" data-delete="' + rule.id + '">Delete</button>'
            + '</div>';
        }).join('') || '<div class="muted">No rules yet.</div>';
        $$('#ps_upsell_list [data-delete]').forEach(function(btn){
          btn.addEventListener('click', async function(){
            await j('/admin/api/product-store/upsells/' + btn.getAttribute('data-delete'), { method:'DELETE' });
            loadRules();
          });
        });
      }catch(err){
        console.error('upsell rules load failed', err);
      }
    }

    $('#ps_upsell_show').addEventListener('change', function(){
      renderTicketTypes($('#ps_upsell_show').value);
      loadRules();
    });
    $('#ps_upsell_product').addEventListener('change', function(){
      renderVariants($('#ps_upsell_product').value);
    });

    $('#ps_upsell_add').addEventListener('click', async function(){
      var payload = {
        showId: $('#ps_upsell_show').value,
        ticketTypeId: $('#ps_upsell_ticket').value,
        productId: $('#ps_upsell_product').value,
        productVariantId: $('#ps_upsell_variant').value,
        priority: Number($('#ps_upsell_priority').value || 1),
        recommended: $('#ps_upsell_recommended').checked,
      };
      if (!payload.showId || !payload.productId) return;
      await j('/admin/api/product-store/upsells', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      loadRules();
    });

    loadOptions().then(loadRules);
  }
  function analytics(){
    if (!main) return;
    main.innerHTML = '<div class="card"><div class="title">Analytics</div><div class="muted">Analytics dashboard coming soon.</div></div>';
  }
  function audiences(){
    if (!main) return;
    main.innerHTML = '<div class="card"><div class="title">Audiences</div><div class="muted">Audience tools coming soon.</div></div>';
  }
  function marketingPage(options){
    if (!main) return;
    var headerTitle = (options && options.title) || 'Marketing';
    var headerSubtitle = (options && options.subtitle) || 'Build segments, templates, and campaigns.';

    main.innerHTML = ''
      + '<div class="card">'
      +   '<div class="header" style="gap:12px;align-items:center;">'
      +     '<div>'
      +       '<div class="title">' + escapeHtml(headerTitle) + '</div>'
      +       '<div class="muted">' + escapeHtml(headerSubtitle) + '</div>'
      +     '</div>'
      +   '</div>'
      +   '<div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap;">'
      +     '<button class="btn tab-btn active" data-tab="contacts">Contacts</button>'
      +     '<button class="btn tab-btn" data-tab="segments">Segments</button>'
      +     '<button class="btn tab-btn" data-tab="templates">Templates</button>'
      +     '<button class="btn tab-btn" data-tab="campaigns">Campaigns</button>'
      +     '<button class="btn tab-btn" data-tab="automations">Automations</button>'
      +     '<button class="btn tab-btn" data-tab="preferences">Preferences</button>'
      +     '<button class="btn tab-btn" data-tab="deliverability">Deliverability</button>'
      +   '</div>'
      +   '<div id="marketing-contacts" class="marketing-tab" style="margin-top:16px;"></div>'
      +   '<div id="marketing-segments" class="marketing-tab" style="margin-top:16px;display:none;"></div>'
      +   '<div id="marketing-templates" class="marketing-tab" style="margin-top:16px;display:none;"></div>'
      +   '<div id="marketing-campaigns" class="marketing-tab" style="margin-top:16px;display:none;"></div>'
      +   '<div id="marketing-automations" class="marketing-tab" style="margin-top:16px;display:none;"></div>'
      +   '<div id="marketing-preferences" class="marketing-tab" style="margin-top:16px;display:none;"></div>'
      +   '<div id="marketing-deliverability" class="marketing-tab" style="margin-top:16px;display:none;"></div>'
      + '</div>';

    var tabs = Array.prototype.slice.call(main.querySelectorAll('.tab-btn'));
    var sections = {
      contacts: main.querySelector('#marketing-contacts'),
      segments: main.querySelector('#marketing-segments'),
      templates: main.querySelector('#marketing-templates'),
      campaigns: main.querySelector('#marketing-campaigns'),
      automations: main.querySelector('#marketing-automations'),
      preferences: main.querySelector('#marketing-preferences'),
      deliverability: main.querySelector('#marketing-deliverability'),
    };

    function setTab(name){
      tabs.forEach(function(btn){
        var active = btn.getAttribute('data-tab') === name;
        btn.classList.toggle('active', active);
      });
      Object.keys(sections).forEach(function(key){
        var el = sections[key];
        if (!el) return;
        el.style.display = (key === name) ? 'block' : 'none';
      });
    }

    tabs.forEach(function(btn){
      btn.addEventListener('click', function(){
        setTab(btn.getAttribute('data-tab'));
      });
    });

    async function fetchJson(url, opts){
      var res = await fetch(url, Object.assign({ credentials:'include' }, opts || {}));
      var data = {};
      try { data = await res.json(); } catch(e){}
      if (!res.ok || !data || data.ok === false) {
        throw new Error((data && (data.message || data.error)) || 'Request failed');
      }
      return data;
    }

    function renderContacts(items){
      var html = ''
        + '<div class="card" style="margin:0 0 12px 0;">'
        +   '<div class="title">Add contact</div>'
        +   '<div class="grid" style="grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:10px;">'
        +     '<input class="input" id="mk_contact_email" placeholder="Email" />'
        +     '<input class="input" id="mk_contact_first" placeholder="First name" />'
        +     '<input class="input" id="mk_contact_last" placeholder="Last name" />'
        +     '<select class="input" id="mk_contact_status">'
        +       '<option value="TRANSACTIONAL_ONLY">Transactional only</option>'
        +       '<option value="SUBSCRIBED">Subscribed</option>'
        +       '<option value="UNSUBSCRIBED">Unsubscribed</option>'
        +     '</select>'
        +   '</div>'
        +   '<div class="row" style="gap:8px;margin-top:10px;">'
        +     '<button class="btn p" id="mk_contact_add">Save contact</button>'
        +     '<div id="mk_contact_msg" class="muted"></div>'
        +   '</div>'
        + '</div>'
        + '<div class="card" style="margin:0;">'
        +   '<div class="title">Contacts</div>'
        +   '<div class="muted" style="margin-bottom:10px;">' + items.length + ' contacts</div>'
        +   '<div class="table-wrap"><table class="table">'
        +     '<thead><tr><th>Email</th><th>Name</th><th>Status</th><th>Tags</th><th>Created</th></tr></thead>'
        +     '<tbody>'
        +       items.map(function(c){ return '<tr><td>' + escapeHtml(c.email) + '</td><td>' + escapeHtml((c.firstName || '') + ' ' + (c.lastName || '')).trim() + '</td><td>' + escapeHtml(c.status) + '</td><td>' + escapeHtml((c.tags || []).join(', ')) + '</td><td>' + escapeHtml(formatDateTime(c.createdAt)) + '</td></tr>'; }).join('')
        +     '</tbody></table></div>'
        + '</div>';
      sections.contacts.innerHTML = html;

      var addBtn = sections.contacts.querySelector('#mk_contact_add');
      if (addBtn) {
        addBtn.addEventListener('click', async function(){
          var email = String(valueOf(sections.contacts, 'mk_contact_email') || '').trim();
          var firstName = String(valueOf(sections.contacts, 'mk_contact_first') || '').trim();
          var lastName = String(valueOf(sections.contacts, 'mk_contact_last') || '').trim();
          var status = String(valueOf(sections.contacts, 'mk_contact_status') || 'TRANSACTIONAL_ONLY');
          var msg = sections.contacts.querySelector('#mk_contact_msg');
          if (!email) { if (msg) msg.textContent = 'Email required.'; return; }
          try {
            await fetchJson('/admin/marketing/contacts', {
              method:'POST',
              headers:{ 'Content-Type':'application/json' },
              body: JSON.stringify({ email: email, firstName: firstName, lastName: lastName, status: status })
            });
            if (msg) msg.textContent = 'Saved.';
            await loadContacts();
          } catch (err) {
            if (msg) msg.textContent = err.message || 'Failed.';
          }
        });
      }
    }

    function valueOf(root, id){
      var el = root.querySelector('#' + id);
      return el ? el.value : '';
    }

    async function loadContacts(){
      var data = await fetchJson('/admin/marketing/contacts');
      renderContacts(data.items || []);
    }

    function renderSegments(items){
      var html = ''
        + '<div class="card" style="margin:0 0 12px 0;">'
        +   '<div class="title">Create segment</div>'
        +   '<input class="input" id="mk_segment_name" placeholder="Segment name" />'
        +   '<textarea class="input" id="mk_segment_rules" placeholder="Rules JSON, e.g. {&quot;rules&quot;:[{&quot;type&quot;:&quot;HAS_TAG&quot;,&quot;value&quot;:&quot;vip&quot;}]}" style="height:120px;margin-top:8px;"></textarea>'
        +   '<div class="row" style="gap:8px;margin-top:10px;">'
        +     '<button class="btn p" id="mk_segment_add">Save segment</button>'
        +     '<div id="mk_segment_msg" class="muted"></div>'
        +   '</div>'
        + '</div>'
        + '<div class="card" style="margin:0;">'
        +   '<div class="title">Segments</div>'
        +   '<div class="table-wrap"><table class="table">'
        +     '<thead><tr><th>Name</th><th>Rules</th><th>Estimate</th></tr></thead>'
        +     '<tbody>'
        +       items.map(function(seg){ return '<tr><td>' + escapeHtml(seg.name) + '</td><td><code>' + escapeHtml(JSON.stringify(seg.rules || {})) + '</code></td><td><button class=\"btn\" data-estimate=\"' + seg.id + '\">Estimate</button></td></tr>'; }).join('')
        +     '</tbody></table></div>'
        + '</div>';
      sections.segments.innerHTML = html;

      var addBtn = sections.segments.querySelector('#mk_segment_add');
      if (addBtn) {
        addBtn.addEventListener('click', async function(){
          var name = String(valueOf(sections.segments, 'mk_segment_name') || '').trim();
          var rulesRaw = String(valueOf(sections.segments, 'mk_segment_rules') || '').trim();
          var msg = sections.segments.querySelector('#mk_segment_msg');
          if (!name || !rulesRaw) { if (msg) msg.textContent = 'Name + rules required.'; return; }
          try {
            var rules = JSON.parse(rulesRaw);
            await fetchJson('/admin/marketing/segments', {
              method:'POST',
              headers:{ 'Content-Type':'application/json' },
              body: JSON.stringify({ name: name, rules: rules })
            });
            if (msg) msg.textContent = 'Saved.';
            await loadSegments();
          } catch (err) {
            if (msg) msg.textContent = err.message || 'Failed.';
          }
        });
      }

      Array.prototype.slice.call(sections.segments.querySelectorAll('[data-estimate]')).forEach(function(btn){
        btn.addEventListener('click', async function(){
          var id = btn.getAttribute('data-estimate');
          try {
            var data = await fetchJson('/admin/marketing/segments/' + encodeURIComponent(id) + '/estimate');
            alert('Estimated recipients: ' + data.estimate.count + '\\nSample: ' + (data.estimate.sample || []).join(', '));
          } catch (err) {
            alert(err.message || 'Estimate failed');
          }
        });
      });
    }

    async function loadSegments(){
      var data = await fetchJson('/admin/marketing/segments');
      renderSegments(data.items || []);
      return data.items || [];
    }

    function renderTemplates(items){
      var html = ''
        + '<div class="card" style="margin:0 0 12px 0;">'
        +   '<div class="title">Create template</div>'
        +   '<div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px;">'
        +     '<input class="input" id="mk_template_name" placeholder="Template name" />'
        +     '<input class="input" id="mk_template_subject" placeholder="Subject" />'
        +     '<input class="input" id="mk_template_fromName" placeholder="From name" />'
        +     '<input class="input" id="mk_template_fromEmail" placeholder="From email" />'
        +   '</div>'
        +   '<textarea class="input" id="mk_template_mjml" placeholder=\"MJML body\" style="height:180px;margin-top:10px;"></textarea>'
        +   '<div class="row" style="gap:8px;margin-top:10px;">'
        +     '<button class="btn p" id="mk_template_add">Save template</button>'
        +     '<div id="mk_template_msg" class="muted"></div>'
        +   '</div>'
        + '</div>'
        + '<div class="card" style="margin:0;">'
        +   '<div class="title">Templates</div>'
        +   '<div class="table-wrap"><table class="table">'
        +     '<thead><tr><th>Name</th><th>Subject</th><th>Preview</th></tr></thead>'
        +     '<tbody>'
        +       items.map(function(t){ return '<tr><td>' + escapeHtml(t.name) + '</td><td>' + escapeHtml(t.subject) + '</td><td><button class=\"btn\" data-preview=\"' + t.id + '\">Preview</button></td></tr>'; }).join('')
        +     '</tbody></table></div>'
        + '</div>';
      sections.templates.innerHTML = html;

      var addBtn = sections.templates.querySelector('#mk_template_add');
      if (addBtn) {
        addBtn.addEventListener('click', async function(){
          var name = String(valueOf(sections.templates, 'mk_template_name') || '').trim();
          var subject = String(valueOf(sections.templates, 'mk_template_subject') || '').trim();
          var fromName = String(valueOf(sections.templates, 'mk_template_fromName') || '').trim();
          var fromEmail = String(valueOf(sections.templates, 'mk_template_fromEmail') || '').trim();
          var mjmlBody = String(valueOf(sections.templates, 'mk_template_mjml') || '').trim();
          var msg = sections.templates.querySelector('#mk_template_msg');
          if (!name || !subject || !fromName || !fromEmail || !mjmlBody) { if (msg) msg.textContent = 'All fields required.'; return; }
          try {
            await fetchJson('/admin/marketing/templates', {
              method:'POST',
              headers:{ 'Content-Type':'application/json' },
              body: JSON.stringify({ name: name, subject: subject, fromName: fromName, fromEmail: fromEmail, mjmlBody: mjmlBody })
            });
            if (msg) msg.textContent = 'Saved.';
            await loadTemplates();
          } catch (err) {
            if (msg) msg.textContent = err.message || 'Failed.';
          }
        });
      }

      Array.prototype.slice.call(sections.templates.querySelectorAll('[data-preview]')).forEach(function(btn){
        btn.addEventListener('click', async function(){
          var id = btn.getAttribute('data-preview');
          try {
            var data = await fetchJson('/admin/marketing/templates/' + encodeURIComponent(id) + '/preview', {
              method:'POST',
              headers:{ 'Content-Type':'application/json' },
              body: JSON.stringify({})
            });
            var win = window.open('', '_blank');
            if (win) win.document.write(data.html || '');
          } catch (err) {
            alert(err.message || 'Preview failed');
          }
        });
      });
    }

    async function loadTemplates(){
      var data = await fetchJson('/admin/marketing/templates');
      renderTemplates(data.items || []);
      return data.items || [];
    }

    function renderCampaigns(items, templates, segments){
      var templateOptions = templates.map(function(t){
        return '<option value=\"' + escapeHtml(t.id) + '\">' + escapeHtml(t.name) + '</option>';
      }).join('');
      var segmentOptions = segments.map(function(s){
        return '<option value=\"' + escapeHtml(s.id) + '\">' + escapeHtml(s.name) + '</option>';
      }).join('');

      var html = ''
        + '<div class="card" style="margin:0 0 12px 0;">'
        +   '<div class="title">Create campaign</div>'
        +   '<input class="input" id="mk_campaign_name" placeholder="Campaign name" />'
        +   '<div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px;">'
        +     '<select class="input" id="mk_campaign_template">' + templateOptions + '</select>'
        +     '<select class="input" id="mk_campaign_segment">' + segmentOptions + '</select>'
        +   '</div>'
        +   '<div class="row" style="gap:8px;margin-top:10px;">'
        +     '<button class="btn p" id="mk_campaign_add">Save campaign</button>'
        +     '<div id="mk_campaign_msg" class="muted"></div>'
        +   '</div>'
        + '</div>'
        + '<div class="card" style="margin:0;">'
        +   '<div class="title">Campaigns</div>'
        +   '<div class="table-wrap"><table class="table">'
        +     '<thead><tr><th>Name</th><th>Status</th><th>Template</th><th>Segment</th><th>Schedule</th><th>Preview</th></tr></thead>'
        +     '<tbody>'
        +       items.map(function(c){ return '<tr><td>' + escapeHtml(c.name) + '</td><td>' + escapeHtml(c.status) + '</td><td>' + escapeHtml((c.template || {}).name || '') + '</td><td>' + escapeHtml((c.segment || {}).name || '') + '</td><td><button class=\"btn\" data-send=\"' + c.id + '\">Send now</button></td><td><button class=\"btn\" data-cpreview=\"' + c.id + '\">Preview</button></td></tr>'; }).join('')
        +     '</tbody></table></div>'
        + '</div>';
      sections.campaigns.innerHTML = html;

      var addBtn = sections.campaigns.querySelector('#mk_campaign_add');
      if (addBtn) {
        addBtn.addEventListener('click', async function(){
          var name = String(valueOf(sections.campaigns, 'mk_campaign_name') || '').trim();
          var templateId = String(valueOf(sections.campaigns, 'mk_campaign_template') || '').trim();
          var segmentId = String(valueOf(sections.campaigns, 'mk_campaign_segment') || '').trim();
          var msg = sections.campaigns.querySelector('#mk_campaign_msg');
          if (!name || !templateId || !segmentId) { if (msg) msg.textContent = 'All fields required.'; return; }
          try {
            await fetchJson('/admin/marketing/campaigns', {
              method:'POST',
              headers:{ 'Content-Type':'application/json' },
              body: JSON.stringify({ name: name, templateId: templateId, segmentId: segmentId })
            });
            if (msg) msg.textContent = 'Saved.';
            await loadCampaigns();
          } catch (err) {
            if (msg) msg.textContent = err.message || 'Failed.';
          }
        });
      }

      Array.prototype.slice.call(sections.campaigns.querySelectorAll('[data-send]')).forEach(function(btn){
        btn.addEventListener('click', async function(){
          var id = btn.getAttribute('data-send');
          try {
            await fetchJson('/admin/marketing/campaigns/' + encodeURIComponent(id) + '/schedule', {
              method:'POST',
              headers:{ 'Content-Type':'application/json' },
              body: JSON.stringify({ sendNow: true })
            });
            await loadCampaigns();
            alert('Campaign scheduled for sending.');
          } catch (err) {
            alert(err.message || 'Schedule failed');
          }
        });
      });

      Array.prototype.slice.call(sections.campaigns.querySelectorAll('[data-cpreview]')).forEach(function(btn){
        btn.addEventListener('click', async function(){
          var id = btn.getAttribute('data-cpreview');
          try {
            var data = await fetchJson('/admin/marketing/campaigns/' + encodeURIComponent(id) + '/preview', {
              method:'POST',
              headers:{ 'Content-Type':'application/json' },
              body: JSON.stringify({})
            });
            var win = window.open('', '_blank');
            if (win) win.document.write(data.html || '');
            alert('Estimated recipients: ' + data.estimate.count);
          } catch (err) {
            alert(err.message || 'Preview failed');
          }
        });
      });
    }

    async function loadCampaigns(){
      var data = await fetchJson('/admin/marketing/campaigns');
      var templates = await fetchJson('/admin/marketing/templates');
      var segments = await fetchJson('/admin/marketing/segments');
      renderCampaigns(data.items || [], templates.items || [], segments.items || []);
    }

    function renderAutomations(items, templates){
      var templateOptions = templates.map(function(t){
        return '<option value=\"' + escapeHtml(t.id) + '\">' + escapeHtml(t.name) + '</option>';
      }).join('');
      var automationOptions = items.map(function(a){
        return '<option value=\"' + escapeHtml(a.id) + '\">' + escapeHtml(a.name) + '</option>';
      }).join('');
      var triggerOptions = [
        'AFTER_PURCHASE',
        'NO_PURCHASE_DAYS',
        'VIP_THRESHOLD',
        'SHOW_CATEGORY_INTEREST',
        'ABANDONED_CHECKOUT'
      ].map(function(t){ return '<option value=\"' + t + '\">' + t.replace(/_/g, ' ') + '</option>'; }).join('');

      var listHtml = items.map(function(a){
        var steps = (a.steps || []).map(function(step){
          return '<li>Step ' + step.stepOrder + ' — ' + escapeHtml(step.template?.name || '') + ' (' + step.delayMinutes + ' min delay)</li>';
        }).join('');
        return '<div class=\"card\" style=\"margin-bottom:12px;\">'
          + '<div class=\"title\">' + escapeHtml(a.name) + '</div>'
          + '<div class=\"muted\">Trigger: ' + escapeHtml(a.triggerType) + ' • ' + (a.isEnabled ? 'Enabled' : 'Disabled') + '</div>'
          + '<ul style=\"margin:10px 0 0 18px;\">' + (steps || '<li>No steps yet.</li>') + '</ul>'
          + '</div>';
      }).join('');

      var html = ''
        + '<div class=\"card\" style=\"margin:0 0 12px 0;\">'
        +   '<div class=\"title\">Create automation</div>'
        +   '<div class=\"grid\" style=\"grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px;\">'
        +     '<input class=\"input\" id=\"mk_auto_name\" placeholder=\"Automation name\" />'
        +     '<select class=\"input\" id=\"mk_auto_trigger\">' + triggerOptions + '</select>'
        +     '<select class=\"input\" id=\"mk_auto_enabled\">'
        +       '<option value=\"true\">Enabled</option>'
        +       '<option value=\"false\">Disabled</option>'
        +     '</select>'
        +   '</div>'
        +   '<div class=\"row\" style=\"gap:8px;margin-top:10px;\">'
        +     '<button class=\"btn p\" id=\"mk_auto_add\">Save automation</button>'
        +     '<div id=\"mk_auto_msg\" class=\"muted\"></div>'
        +   '</div>'
        + '</div>'
        + '<div class=\"card\" style=\"margin:0 0 12px 0;\">'
        +   '<div class=\"title\">Add automation step</div>'
        +   '<div class=\"grid\" style=\"grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:10px;\">'
        +     '<select class=\"input\" id=\"mk_step_auto\">' + automationOptions + '</select>'
        +     '<select class=\"input\" id=\"mk_step_template\">' + templateOptions + '</select>'
        +     '<input class=\"input\" id=\"mk_step_order\" placeholder=\"Step order\" />'
        +     '<input class=\"input\" id=\"mk_step_delay\" placeholder=\"Delay (minutes)\" />'
        +   '</div>'
        +   '<textarea class=\"input\" id=\"mk_step_rules\" placeholder=\"Condition rules JSON (optional)\" style=\"height:100px;margin-top:10px;\"></textarea>'
        +   '<div class=\"row\" style=\"gap:8px;margin-top:10px;\">'
        +     '<button class=\"btn p\" id=\"mk_step_add\">Save step</button>'
        +     '<div id=\"mk_step_msg\" class=\"muted\"></div>'
        +   '</div>'
        + '</div>'
        + '<div class=\"card\" style=\"margin:0;\">'
        +   '<div class=\"title\">Automations</div>'
        +   '<div style=\"margin-top:10px;\">' + (listHtml || '<div class=\"muted\">No automations yet.</div>') + '</div>'
        + '</div>';

      sections.automations.innerHTML = html;

      var addAuto = sections.automations.querySelector('#mk_auto_add');
      if (addAuto) {
        addAuto.addEventListener('click', async function(){
          var name = String(valueOf(sections.automations, 'mk_auto_name') || '').trim();
          var trigger = String(valueOf(sections.automations, 'mk_auto_trigger') || '').trim();
          var enabled = String(valueOf(sections.automations, 'mk_auto_enabled') || 'true') === 'true';
          var msg = sections.automations.querySelector('#mk_auto_msg');
          if (!name || !trigger) { if (msg) msg.textContent = 'Name + trigger required.'; return; }
          try {
            await fetchJson('/admin/marketing/automations', {
              method:'POST',
              headers:{ 'Content-Type':'application/json' },
              body: JSON.stringify({ name: name, triggerType: trigger, isEnabled: enabled })
            });
            if (msg) msg.textContent = 'Saved.';
            await loadAutomations();
          } catch (err) {
            if (msg) msg.textContent = err.message || 'Failed.';
          }
        });
      }

      var addStep = sections.automations.querySelector('#mk_step_add');
      if (addStep) {
        addStep.addEventListener('click', async function(){
          var automationId = String(valueOf(sections.automations, 'mk_step_auto') || '').trim();
          var templateId = String(valueOf(sections.automations, 'mk_step_template') || '').trim();
          var stepOrder = String(valueOf(sections.automations, 'mk_step_order') || '').trim();
          var delayMinutes = String(valueOf(sections.automations, 'mk_step_delay') || '').trim();
          var rulesRaw = String(valueOf(sections.automations, 'mk_step_rules') || '').trim();
          var msg = sections.automations.querySelector('#mk_step_msg');
          if (!automationId || !templateId || !stepOrder) { if (msg) msg.textContent = 'Automation, template, and order required.'; return; }
          var rules = {};
          if (rulesRaw) {
            try { rules = JSON.parse(rulesRaw); } catch (err) { if (msg) msg.textContent = 'Invalid JSON.'; return; }
          }
          try {
            await fetchJson('/admin/marketing/automations/' + encodeURIComponent(automationId) + '/steps', {
              method:'POST',
              headers:{ 'Content-Type':'application/json' },
              body: JSON.stringify({
                templateId: templateId,
                stepOrder: Number(stepOrder),
                delayMinutes: Number(delayMinutes || 0),
                conditionRules: rules
              })
            });
            if (msg) msg.textContent = 'Saved.';
            await loadAutomations();
          } catch (err) {
            if (msg) msg.textContent = err.message || 'Failed.';
          }
        });
      }
    }

    async function loadAutomations(){
      var data = await fetchJson('/admin/marketing/automations');
      var templates = await fetchJson('/admin/marketing/templates');
      renderAutomations(data.items || [], templates.items || []);
    }

    function renderPreferences(items){
      var html = ''
        + '<div class=\"card\" style=\"margin:0 0 12px 0;\">'
        +   '<div class=\"title\">Add topic</div>'
        +   '<div class=\"grid\" style=\"grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px;\">'
        +     '<input class=\"input\" id=\"mk_topic_name\" placeholder=\"Topic name\" />'
        +     '<input class=\"input\" id=\"mk_topic_desc\" placeholder=\"Description\" />'
        +     '<select class=\"input\" id=\"mk_topic_default\">'
        +       '<option value=\"true\">Default on</option>'
        +       '<option value=\"false\">Default off</option>'
        +     '</select>'
        +   '</div>'
        +   '<div class=\"row\" style=\"gap:8px;margin-top:10px;\">'
        +     '<button class=\"btn p\" id=\"mk_topic_add\">Save topic</button>'
        +     '<div id=\"mk_topic_msg\" class=\"muted\"></div>'
        +   '</div>'
        + '</div>'
        + '<div class=\"card\" style=\"margin:0;\">'
        +   '<div class=\"title\">Topics</div>'
        +   '<div class=\"table-wrap\"><table class=\"table\">'
        +     '<thead><tr><th>Name</th><th>Description</th><th>Default</th></tr></thead>'
        +     '<tbody>'
        +       items.map(function(topic){ return '<tr><td>' + escapeHtml(topic.name) + '</td><td>' + escapeHtml(topic.description || '') + '</td><td>' + (topic.isDefault ? 'Yes' : 'No') + '</td></tr>'; }).join('')
        +     '</tbody></table></div>'
        + '</div>';
      sections.preferences.innerHTML = html;

      var addBtn = sections.preferences.querySelector('#mk_topic_add');
      if (addBtn) {
        addBtn.addEventListener('click', async function(){
          var name = String(valueOf(sections.preferences, 'mk_topic_name') || '').trim();
          var description = String(valueOf(sections.preferences, 'mk_topic_desc') || '').trim();
          var isDefault = String(valueOf(sections.preferences, 'mk_topic_default') || 'true') === 'true';
          var msg = sections.preferences.querySelector('#mk_topic_msg');
          if (!name) { if (msg) msg.textContent = 'Name required.'; return; }
          try {
            await fetchJson('/admin/marketing/preferences/topics', {
              method:'POST',
              headers:{ 'Content-Type':'application/json' },
              body: JSON.stringify({ name: name, description: description, isDefault: isDefault })
            });
            if (msg) msg.textContent = 'Saved.';
            await loadPreferences();
          } catch (err) {
            if (msg) msg.textContent = err.message || 'Failed.';
          }
        });
      }
    }

    async function loadPreferences(){
      var data = await fetchJson('/admin/marketing/preferences/topics');
      renderPreferences(data.items || []);
    }

    function renderDeliverability(summary, segments, warmup){
      var summaryHtml = ''
        + '<div class=\"grid\" style=\"grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;\">'
        +   '<div class=\"card\"><div class=\"title\">Bounce rate</div><div>' + summary.bounceRate + '%</div></div>'
        +   '<div class=\"card\"><div class=\"title\">Complaint rate</div><div>' + summary.complaintRate + '%</div></div>'
        +   '<div class=\"card\"><div class=\"title\">Unsubscribe rate</div><div>' + summary.unsubscribeRate + '%</div></div>'
        +   '<div class=\"card\"><div class=\"title\">Click rate</div><div>' + summary.clickRate + '%</div></div>'
        + '</div>';

      var segmentRows = (segments || []).map(function(seg){
        return '<tr><td>' + escapeHtml(seg.name) + '</td><td>' + seg.engagementRate + '%</td><td>' + seg.sent + '</td></tr>';
      }).join('');

      var warmupRows = (warmup.presets || []).map(function(p){
        return '<tr><td>' + escapeHtml(p.label) + '</td><td>' + p.dailyLimit + '</td><td>' + p.ratePerSecond + '/s</td><td>' + p.batchSize + '</td></tr>';
      }).join('');

      sections.deliverability.innerHTML = ''
        + '<div class=\"card\" style=\"margin-bottom:12px;\">'
        +   '<div class=\"title\">Sending health</div>'
        +   '<div style=\"margin-top:10px;\">' + summaryHtml + '</div>'
        + '</div>'
        + '<div class=\"card\" style=\"margin-bottom:12px;\">'
        +   '<div class=\"title\">Top segments by engagement</div>'
        +   '<div class=\"table-wrap\"><table class=\"table\">'
        +     '<thead><tr><th>Segment</th><th>Engagement rate</th><th>Sent</th></tr></thead>'
        +     '<tbody>' + (segmentRows || '<tr><td colspan=\"3\" class=\"muted\">No data yet.</td></tr>') + '</tbody>'
        +   '</table></div>'
        + '</div>'
        + '<div class=\"card\">'
        +   '<div class=\"title\">Warm-up guidance</div>'
        +   '<ul style=\"margin:10px 0 0 18px;\">' + (warmup.guidance || []).map(function(g){ return '<li>' + escapeHtml(g) + '</li>'; }).join('') + '</ul>'
        +   '<div class=\"table-wrap\" style=\"margin-top:10px;\"><table class=\"table\">'
        +     '<thead><tr><th>Preset</th><th>Daily limit</th><th>Rate</th><th>Batch size</th></tr></thead>'
        +     '<tbody>' + (warmupRows || '') + '</tbody>'
        +   '</table></div>'
        + '</div>';
    }

    async function loadDeliverability(){
      var summary = await fetchJson('/admin/marketing/deliverability/summary?days=30');
      var segments = await fetchJson('/admin/marketing/deliverability/top-segments?days=30');
      var warmup = await fetchJson('/admin/marketing/deliverability/warmup');
      renderDeliverability(summary.summary || {}, segments.items || [], warmup.data || { guidance: [], presets: [] });
    }

    loadContacts().catch(function(err){ sections.contacts.innerHTML = '<div class="error">' + escapeHtml(err.message || 'Failed to load contacts') + '</div>'; });
    loadSegments().catch(function(err){ sections.segments.innerHTML = '<div class="error">' + escapeHtml(err.message || 'Failed to load segments') + '</div>'; });
    loadTemplates().catch(function(err){ sections.templates.innerHTML = '<div class="error">' + escapeHtml(err.message || 'Failed to load templates') + '</div>'; });
    loadCampaigns().catch(function(err){ sections.campaigns.innerHTML = '<div class="error">' + escapeHtml(err.message || 'Failed to load campaigns') + '</div>'; });
    loadAutomations().catch(function(err){ sections.automations.innerHTML = '<div class="error">' + escapeHtml(err.message || 'Failed to load automations') + '</div>'; });
    loadPreferences().catch(function(err){ sections.preferences.innerHTML = '<div class="error">' + escapeHtml(err.message || 'Failed to load preferences') + '</div>'; });
    loadDeliverability().catch(function(err){ sections.deliverability.innerHTML = '<div class="error">' + escapeHtml(err.message || 'Failed to load deliverability') + '</div>'; });
  }
  function emailPage(){
    marketingPage({
      title: 'Email Campaigns',
      subtitle: 'Mailer-style journeys with contacts, segments, templates, and campaign sends.'
    });
  }
  function finance(){
  if (!main) return;
  main.innerHTML =
    '<div class="card">'
      +'<div class="header">'
        +'<div>'
          +'<div class="title">Finance</div>'
          +'<div class="muted">Payouts, invoices, fees, and reporting will live here.</div>'
        +'</div>'
      +'</div>'
      +'<div class="muted">Coming soon.</div>'
    +'</div>';
}

  async function account(){
  if (!main) return;

  main.innerHTML =
    '<div class="card">'
      +'<div class="header">'
        +'<div>'
          +'<div class="title">Account</div>'
          +'<div class="muted">Manage your profile and security.</div>'
        +'</div>'
        +'<a class="btn" href="/admin/ui/logout" style="text-decoration:none">Log out</a>'
      +'</div>'
      +'<div class="grid" style="grid-template-columns:1fr 1fr;gap:12px">'
        +'<div class="card" style="margin:0">'
          +'<div class="title">Profile</div>'
          +'<div class="muted" style="margin-bottom:10px">Update your name and email.</div>'
          +'<label style="font-size:12px;font-weight:700;display:block;margin:8px 0 4px">Name</label>'
          +'<input id="acc_name" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:10px" />'
          +'<label style="font-size:12px;font-weight:700;display:block;margin:8px 0 4px">Email</label>'
          +'<input id="acc_email" type="email" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:10px" />'
          +'<div class="row" style="margin-top:10px;gap:8px">'
            +'<button class="btn p" id="acc_save">Save profile</button>'
            +'<div id="acc_err" class="error"></div>'
          +'</div>'
        +'</div>'

        +'<div class="card" style="margin:0">'
          +'<div class="title">Security</div>'
          +'<div class="muted" style="margin-bottom:10px">Change your password.</div>'
          +'<label style="font-size:12px;font-weight:700;display:block;margin:8px 0 4px">Current password</label>'
          +'<input id="pw_current" type="password" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:10px" />'
          +'<label style="font-size:12px;font-weight:700;display:block;margin:8px 0 4px">New password</label>'
          +'<input id="pw_new" type="password" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:10px" />'
          +'<div class="row" style="margin-top:10px;gap:8px">'
            +'<button class="btn" id="pw_save">Update password</button>'
            +'<div id="pw_err" class="error"></div>'
          +'</div>'
        +'</div>'
      +'</div>'
      +'<div class="card" style="margin-top:12px">'
  +'<div class="title">Business & Storefront</div>'
  +'<div class="muted">This controls your public organiser page and event URLs.</div>'

    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">'
    +'<div>'
      +'<label class="muted">Company name</label>'
      +'<input id="biz_companyName" class="input" />'
    +'</div>'
    +'<div>'
      +'<label class="muted">Phone</label>'
      +'<input id="biz_phone" class="input" placeholder="+44" />'
    +'</div>'
  +'</div>'

  +'<div style="margin-top:10px">'
    +'<label class="muted">Storefront name (unique)</label>'
    +'<input id="biz_storefrontSlug" class="input" />'
    +'<div id="biz_storefrontPreview" class="muted" style="margin-top:6px"></div>'
    +'<div class="muted" style="margin-top:6px">Your show URLs will become: /public/&lt;storefront&gt;/&lt;show-title&gt;</div>'
  +'</div>'

  +'<div class="row" style="margin-top:10px;gap:8px">'
    +'<button class="btn p" id="biz_save">Save business details</button>'
    +'<div id="biz_err" class="error"></div>'
  +'</div>'
+'</div>'
    +'</div>';

    // Load user
  function cleanErr(e){
    const msg = (e && e.message) ? e.message : String(e || '');
    try{
      const j = JSON.parse(msg);
      return (j && (j.message || j.error)) ? (j.message || j.error) : msg;
    }catch{
      return msg;
    }
  }

  let u = {};
  try{
    const me = await j('/auth/me');
    u = (me && me.user) || {};
  }catch(e){
    $('#acc_err').textContent = cleanErr(e);
  }

  // Fill fields (safe even if load failed)
  $('#acc_name').value = (u && u.name) || '';
  $('#acc_email').value = (u && u.email) || '';

  $('#biz_companyName').value = (u && u.companyName) || '';
  $('#biz_phone').value = (u && u.phone) || '';
  $('#biz_storefrontSlug').value = (u && u.storefrontSlug) || '';

  const updatePreview = () => {
    const raw = ($('#biz_storefrontSlug').value || '').trim();
    const slug = raw
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    $('#biz_storefrontPreview').textContent = slug
      ? (window.location.origin + '/public/' + slug)
      : 'Preview: (set a storefront name to enable your organiser page)';
  };
  $('#biz_storefrontSlug').addEventListener('input', updatePreview);
  updatePreview();


  // Save profile (name/email only)
  $('#acc_save').addEventListener('click', async function(){
    $('#acc_err').textContent = '';
    try{
      const name = $('#acc_name').value.trim();
      const email = $('#acc_email').value.trim();

      const r = await j('/auth/me', {
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name, email })
      });

      if (r && r.ok) alert('Profile updated');
      else throw new Error((r && (r.message || r.error)) || 'Failed to update');
    }catch(e){
      $('#acc_err').textContent = cleanErr(e);
    }
  });


  // Save business/storefront (company/phone/storefront)
  $('#biz_save').addEventListener('click', async function(){
    $('#biz_err').textContent = '';
    try{
      const payload = {
        companyName: ($('#biz_companyName').value || '').trim() || null,
        phone: ($('#biz_phone').value || '').trim() || null,
        storefrontSlug: ($('#biz_storefrontSlug').value || '').trim() || null,
      };

      const r = await j('/auth/me', {
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });

      if (r && r.ok){
        alert('Business details updated');
      }else{
        throw new Error((r && (r.message || r.error)) || 'Failed to update');
      }
    }catch(e){
      // This will show the friendly uniqueness error from /auth/me (409)
      $('#biz_err').textContent = cleanErr(e);
    }
  });

  $('#pw_save').addEventListener('click', async function(){
    $('#pw_err').textContent = '';
    try{
      const currentPassword = $('#pw_current').value;
      const newPassword = $('#pw_new').value;
      if(!currentPassword || !newPassword) throw new Error('Enter both current + new password');

      const r = await j('/auth/change-password', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ currentPassword, newPassword })
      });

      if (r && r.ok){
        alert('Password updated');
        $('#pw_current').value = '';
        $('#pw_new').value = '';
      }else{
        throw new Error((r && r.error) || 'Failed to update password');
      }
    }catch(e){
      $('#pw_err').textContent = e.message || String(e);
    }
  });
}

  // --- ROUTER ---
  function route(){
    try{
      var path = location.pathname.replace(/\\/$/, '');
      console.log('[Admin UI] route', path);
      setActive(path);

      if (path === '/admin/ui' || path === '/admin/ui/home' || path === '/admin/ui/index.html') return home();
      if (path === '/admin/ui/shows/create-ai') return createShowAI();
      if (path === '/admin/ui/shows/create') return createShow();
      if (path === '/admin/ui/shows/current')  return listShows();
      if (path === '/admin/ui/customers')     return customers();
      if (path === '/admin/ui/orders')         return orders();
      if (path === '/admin/ui/venues')         return venues();
      if (path === '/admin/ui/promoters')      return promotersList();
      if (path === '/admin/ui/promoters/new')  return promoterCreate();
      if (path === '/admin/ui/analytics')      return analytics();
      if (path === '/admin/ui/marketing')      return marketingPage();
      if (path === '/admin/ui/audiences')      return audiences();
      if (path === '/admin/ui/email')          return emailPage();
      if (path === '/admin/ui/product-store')  return productStorePage();
      if (path === '/admin/ui/product-store/settings') return productStoreSettingsPage();
      if (path === '/admin/ui/product-store/upsells') return productStoreUpsellsPage();
      if (path === '/admin/ui/product-store/orders') return productStoreOrdersPage();
      if (path === '/admin/ui/product-store/products/new') return productStoreProductForm();
      if (path === '/admin/ui/account')        return account();
      if (path === '/admin/ui/finance')        return finance();


      if (path.startsWith('/admin/ui/shows/') && path.endsWith('/edit')){
        var id1 = path.split('/')[4];
        return editShow(id1);
      }
      if (path.startsWith('/admin/ui/shows/') && path.endsWith('/tickets')){
        var id2 = path.split('/')[4];
        return ticketsPage(id2);
      }
      if (path.startsWith('/admin/ui/shows/') && path.endsWith('/seating')){
        var id3 = path.split('/')[4];
        return seatingPage(id3);
      }
      if (path.startsWith('/admin/ui/shows/') && path.endsWith('/summary')){
        var id4 = path.split('/')[4];
        return summaryPage(id4);
      }

      if (path.startsWith('/admin/ui/product-store/products/') && path.endsWith('/edit')){
        var prodId = path.split('/')[5];
        return productStoreProductForm(prodId);
      }

      if (path.startsWith('/admin/ui/product-store/orders/')){
        var orderId = path.split('/')[5];
        return productStoreOrderDetailPage(orderId);
      }

      if (path.startsWith('/admin/ui/promoters/')){
        var pid = path.split('/')[4];
        return promoterProfile(pid);
      }

      return home();
    }catch(err){
      console.error('[Admin UI] route error', err);
      if (main){
        main.innerHTML = '<div class="card"><div class="error">Routing error: '+(err.message||err)+'</div></div>';
      }
    }
  }

  console.log('[Admin UI] initial route()');
  route();
})();
</script>
</body>
</html>`);
  }
);
// --- AI: Extract show details from uploaded assets (docs + image URLs) ---
router.post(
  "/ai/extract-show",
  requireAdminOrOrganiser,
  json({ limit: "60mb" }),
  async (req, res) => {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ ok: false, error: "Missing OPENAI_API_KEY in environment" });
      }

// Use a model that reliably supports structured outputs + vision
const model = process.env.OPENAI_MODEL_SHOW_EXTRACT || "gpt-4o-mini";

      const body = req.body || {};
            const suggestedMainImageUrl: string | null =
        typeof (body as any).suggestedMainImageUrl === "string" ? (body as any).suggestedMainImageUrl : null;

      const images: Array<{ name?: string; url: string }> = Array.isArray(body.images) ? body.images : [];
      const docs: Array<{ name?: string; type?: string; dataUrl: string }> = Array.isArray(body.docs) ? body.docs : [];

            const eventTypes = [
        "comedy","theatre","music","festival","film","talks","workshop",
        "corporate","nightlife","sport","food","community","arts","other"
      ];

      // Must match the <option value="..."> values in your admin UI select
      const categories = [
        "rock","classical","jazz",
        "standup","improv",
        "theatre","dance",
        "football","running",
        "tech","business",
        "show","activity",
        "festival","tasting",
        "play_drama","panto","musical","opera","cabaret",
        "comedy_festival","music_festival","arts_festival","food_festival",
        "cinema_screening","premiere","q_and_a",
        "live_podcast","panel","talk","book_event",
        "corporate_night","private_party","awards","fundraiser",
        "club_night","tour_show","new_material","edinburgh_preview","tv_warmup","roast_battle",
        "misc"
      ];

      const content: any[] = [];

      content.push({
        type: "input_text",
               text:
          "You are extracting event/show details for a UK ticketing admin UI.\n" +
          "Use ONLY the provided documents + images. If unknown, set null/empty values and list what is missing.\n" +
          "If a document contains a full event description, copy it EXACTLY (word-for-word) into descriptionHtml as multi-paragraph <p>...</p> HTML.\n" +
"Only generate a new event description if no suitable description exists in the docs.\n" +
"If generating, write at least 3 paragraphs (not a single line).\n" +

                 
                 "Return a single JSON object that matches the schema exactly.\n\n" +
          "CRITICAL RULES:\n" +
          "1) TITLE: Prefer the title found in the document(s) exactly as written (punctuation included). Do NOT add hyphens or extra separators unless the source includes them.\n" +
          "   If no clear title is in docs, read the title from the poster image text. If still unknown, propose a sensible title using the available info.\n" +
"2) DESCRIPTION: If a full event description exists in the documents, copy it exactly (do not rewrite).\n" +
"   Only generate a new description if no usable description exists in ANY document.\n" +
"   If you generate it, it MUST be a proper event description in HTML with multiple paragraphs:\n" +
"   - Use 3–6 <p> paragraphs\n" +
"   - Each paragraph should be 1–3 sentences\n" +
"   - No single-line description\n" +
          "3) TYPE + CATEGORY: eventType must be one of: " + eventTypes.join(", ") + ".\n" +
          "   category MUST be one of these exact values (or null): " + categories.join(", ") + ".\n" +
          "   Example: stand-up comedy => eventType='comedy' and category='standup'.\n" +
"4) IMAGES: Choose the main poster image from the provided images (prefer closest to 3:2 landscape and likely main artwork). Put the rest in additionalImageUrls.\n" +
          "5) TAGS: Return exactly 10 tags. If fewer are explicitly present, infer the remaining tags from the event and venue context.\n" +
          "6) Dates/times: output ISO 8601 for startDateTime/endDateTime. If local UK time and no timezone stated, assume Europe/London.\n" +
          "   doorsOpenTime: HH:MM 24h.\n"

      });

            if (images.length) {
        content.push({
          type: "input_text",
          text:
            "Image candidates (name → url):\n" +
            images.map((x: any) => {
              const bits = [
                `- ${x.name || "image"} → ${x.url}`,
                x.width && x.height ? `(${x.width}x${x.height})` : "",
                typeof x.ratio === "number" ? `ratio=${x.ratio.toFixed(3)}` : "",
                x.likelyPoster ? "[likely poster]" : "",
                x.likelySquare ? "[likely square]" : "",
                x.likelyBanner ? "[likely banner]" : ""
              ].filter(Boolean);
              return bits.join(" ");
            }).join("\n") +
            (suggestedMainImageUrl ? ("\n\nSuggested main poster (closest 2:3): " + suggestedMainImageUrl) : "")
        });
      }


      function parseDataUrl(dataUrl: string){
  const m = String(dataUrl || "").match(/^data:(.*?);base64,(.*)$/);
  if (!m) return null;
  return { mime: m[1] || "", b64: m[2] || "" };
}

async function docToText(name: string, type: string, dataUrl: string){
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return "";

  const buf = Buffer.from(parsed.b64, "base64");
  const mime = (parsed.mime || type || "").toLowerCase();
  const lowerName = String(name || "").toLowerCase();

   // NOTE: backend runs as ESM ("type":"module") on Railway, so `require` is not available.
  // Use dynamic import for these CommonJS deps.
  const mammothMod: any = await import("mammoth");
  const mammoth: any = (mammothMod?.default || mammothMod);

  const pdfParseMod: any = await import("pdf-parse");
  const pdfParse: any = (pdfParseMod?.default || pdfParseMod);


  // DOCX
  if (mime.includes("wordprocessingml.document") || lowerName.endsWith(".docx")) {
    const out = await mammoth.extractRawText({ buffer: buf });
    return (out && out.value) ? String(out.value) : "";
  }

  // PDF
  if (mime.includes("pdf") || lowerName.endsWith(".pdf")) {
    const out = await pdfParse(buf);
    return (out && out.text) ? String(out.text) : "";
  }

  // TXT/MD/other – treat as utf8 text
  return buf.toString("utf8");
}

const docTexts: Array<{ name: string; text: string }> = [];

// Turn all docs into plain text and feed as input_text

for (const d of docs) {
  if (!d || !d.dataUrl) continue;
  try{
    const text = await docToText(d.name || "document", d.type || "", d.dataUrl);
    const cleaned = String(text || "").trim();
    if (!cleaned) continue;

    // Keep it bounded so a huge PDF can’t explode tokens
    const clipped = cleaned.slice(0, 20000);

    // ✅ store for deterministic overrides later
    docTexts.push({ name: d.name || "document", text: clipped });

    content.push({
      type: "input_text",
      text: `Document: ${d.name || "document"}\n\n${clipped}`
    });
   }catch(e:any){
    console.error(
      "[AI Extract] doc parse failed",
      {
        name: d?.name,
        type: d?.type,
        err: e?.message || String(e),
        stack: e?.stack
      }
    );

    content.push({
      type: "input_text",
      text: `Document: ${d.name || "document"}\n\n[Could not parse this file on server]`
    });
  }

}


      function pickBestDocText(docTexts: Array<{name:string; text:string}>){
  if (!docTexts.length) return null;
  // deterministic: pick the longest non-empty text
  const sorted = [...docTexts].sort((a,b) => (b.text.length || 0) - (a.text.length || 0));
  return sorted[0] || null;
}

function extractTitleFromText(text: string){
  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  // Prefer “Title:” style
  for (const l of lines.slice(0, 30)){
    const m = l.match(/^(title|event)\s*:\s*(.+)$/i);
    if (m && m[2] && m[2].trim().length <= 120) return m[2].trim();
  }

  // Otherwise first meaningful line that looks title-ish
  for (const l of lines.slice(0, 30)){
    if (l.length < 4) continue;
    if (l.length > 120) continue;
        if (/^as seen on/i.test(l)) continue;
    if (/^get ready/i.test(l)) continue;
    if (/^join us/i.test(l)) continue;
    if (/^featuring/i.test(l)) continue;
    if (/^this is /i.test(l)) continue;
    if (/^expect /i.test(l)) continue;
    return l;

  }
  return null;
}

    

function escapeHtml(s: string){
  return String(s || "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function textToExactHtml(text: string){
  // preserve words exactly; keep line breaks
  const safe = escapeHtml(text);
  const parts = safe.split(/\n{2,}/).map(p => p.replace(/\n/g, "<br>"));
  return parts.map(p => `<p>${p}</p>`).join("");
}

function extractEventDescriptionFromText(raw: string): string | null {
  const text = String(raw || "").replace(/\r/g, "");
  if (!text.trim()) return null;

  const lines = text.split("\n");

  // 1) Try heading-based extraction: "Description", "Event Description", etc.
  const headingRe = /^\s*(event\s*)?description\s*:?\s*$/i;
  const inlineRe = /^\s*(event\s*)?description\s*:\s*(.+)\s*$/i;

  const stopHeadingRe = /^\s*(date|time|doors|venue|location|address|tickets?|price|prices|running\s*time|duration|age|accessibility|tags|keywords|contact|terms)\b/i;

  const candidates: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] || "").trim();
    if (!line) continue;

    const inline = line.match(inlineRe);
    if (inline && inline[2] && inline[2].trim().length > 40) {
      // start with inline text, then keep collecting until a stop heading
      const out: string[] = [inline[2].trim()];
      for (let j = i + 1; j < lines.length; j++) {
        const l = (lines[j] || "").trim();
        if (!l) { out.push(""); continue; }
        if (stopHeadingRe.test(l)) break;
        out.push(l);
      }
      const joined = out.join("\n").trim();
      if (joined.length >= 60) candidates.push(joined);
      continue;
    }

    if (headingRe.test(line)) {
      const out: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        const l = (lines[j] || "").trim();

        // allow blank lines (paragraph breaks)
        if (!l) { out.push(""); continue; }

        // stop if we hit another obvious section
        if (stopHeadingRe.test(l)) break;

        // also stop if we hit a very "heading-ish" short line after we’ve started
        if (out.length > 0 && l.length < 35 && /^[A-Z0-9 .,'"&()\-\/]+$/.test(l)) break;

        out.push(l);
      }

      const joined = out.join("\n").trim();
      if (joined.length >= 120) candidates.push(joined);
    }
  }

  // 2) If no heading found, try paragraph heuristic: pick the longest paragraph with multiple sentences
  if (!candidates.length) {
    const paras = text
      .split(/\n{2,}/)
      .map(p => p.trim())
      .filter(Boolean);

    const scored = paras
      .map(p => {
        const sentenceCount = (p.match(/[.!?](\s|$)/g) || []).length;
        const looksLikeTable = /\t|\s{3,}\S+\s{3,}/.test(p);
        const score =
          (p.length || 0) +
          (sentenceCount >= 2 ? 250 : 0) -
          (looksLikeTable ? 300 : 0);
        return { p, score };
      })
      .sort((a, b) => b.score - a.score);

    const best = scored[0]?.p;
    if (best && best.length >= 80) candidates.push(best);
  }

  if (!candidates.length) return null;

  // Return the longest candidate (most likely the full description)
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0];
}

function pickBestEventDescriptionFromDocs(docTexts: Array<{ name: string; text: string }>) {
  const found: Array<{ name: string; text: string }> = [];

  for (const d of docTexts || []) {
    const desc = extractEventDescriptionFromText(d.text);
    if (desc) found.push({ name: d.name, text: desc });
  }

  if (!found.length) return null;
  found.sort((a, b) => (b.text.length || 0) - (a.text.length || 0));
  return found[0];
}

function stripHtml(html: string) {
  return String(html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function needsLongerDescription(html: string) {
  const t = stripHtml(html);
  const pCount = (String(html || "").match(/<p\b/gi) || []).length;
  return (t.length < 220) || (pCount < 2);
}

async function generateMultiParagraphDescriptionHtml(
  info: {
    title?: string;
    venueName?: string;
    venueAddress?: string;
    startDateTime?: string | null;
    endDateTime?: string | null;
    doorsOpenTime?: string | null;
    ageGuidance?: string | null;
    eventType?: string | null;
    category?: string | null;
    tags?: string[];
  },
  cfg: { apiKey: string; model: string }
): Promise<string> {
  const prompt =
    "Write a proper UK event description in HTML.\n" +
    "Rules:\n" +
    "- Use 3–6 <p> paragraphs\n" +
    "- 1–3 sentences per paragraph\n" +
    "- Do NOT invent facts (only use the provided details)\n" +
    "- Keep it engaging and clear\n\n" +
    "Event details:\n" +
    `Title: ${info.title || ""}\n` +
    `Venue: ${info.venueName || ""}\n` +
    `Address: ${info.venueAddress || ""}\n` +
    `Start: ${info.startDateTime || ""}\n` +
    `End: ${info.endDateTime || ""}\n` +
    `Doors: ${info.doorsOpenTime || ""}\n` +
    `Age: ${info.ageGuidance || ""}\n` +
    `Type: ${info.eventType || ""}\n` +
    `Category: ${info.category || ""}\n` +
    `Tags: ${(info.tags || []).join(", ")}\n`;

  const openaiReq2: any = {
    model: cfg.model,
    input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
    max_output_tokens: 900
  };

  const r2 = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(openaiReq2)
  });

  const raw2 = await r2.text();
  if (!r2.ok) throw new Error("OpenAI description repair failed: " + raw2);

  const data2 = raw2 ? JSON.parse(raw2) : {};
  const html = (typeof data2.output_text === "string" ? data2.output_text : "").trim();

  // Last safety: if model ignored HTML, wrap as paragraphs
  if (!html.includes("<p")) {
    const safe = escapeHtml(html);
    return safe
      .split(/\n{2,}/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => `<p>${p}</p>`)
      .join("");
  }

  return html;
}



      // Attach images as vision inputs (URLs)
      for (const img of images) {
        if (!img || !img.url) continue;
        content.push({
          type: "input_image",
          image_url: img.url
        });
      }

      const schema = {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          startDateTime: { anyOf: [{ type: "string" }, { type: "null" }] },
          endDateTime: { anyOf: [{ type: "string" }, { type: "null" }] },
          doorsOpenTime: { anyOf: [{ type: "string" }, { type: "null" }] },
          venueName: { type: "string" },
          venueAddress: { type: "string" },

          eventType: {
            anyOf: [
              { type: "string", enum: eventTypes },
              { type: "null" }
            ]
          },
          category: {
            anyOf: [
              { type: "string", enum: categories },
              { type: "null" }
            ]
          },

          ageGuidance: { anyOf: [{ type: "string" }, { type: "null" }] },

          accessibility: {
            type: "object",
            additionalProperties: false,
            properties: {
              wheelchair: { type: "boolean" },
              stepFree: { type: "boolean" },
              hearingLoop: { type: "boolean" },
              accessibleToilet: { type: "boolean" },
              notes: { type: "string" }
            },
            required: ["wheelchair", "stepFree", "hearingLoop", "accessibleToilet", "notes"]
          },

                   tags: {
  type: "array",
  items: { type: "string" },
  minItems: 10,
  maxItems: 10
},



          descriptionHtml: { type: "string" },

          mainImageUrl: { anyOf: [{ type: "string" }, { type: "null" }] },
          additionalImageUrls: {
            type: "array",
            items: { type: "string" },
            maxItems: 10
          },

          confidence: { type: "number", minimum: 0, maximum: 1 },
          missing: { type: "array", items: { type: "string" } }
        },
        required: [
          "title",
          "startDateTime",
          "endDateTime",
          "doorsOpenTime",
          "venueName",
          "venueAddress",
          "eventType",
          "category",
          "ageGuidance",
          "accessibility",
          "tags",
          "descriptionHtml",
          "mainImageUrl",
          "additionalImageUrls",
          "confidence",
          "missing"
        ]
      };

      const openaiReq = {
        model,
        input: [{ role: "user", content }],

        text: {
          format: {
            type: "json_schema",
            name: "show_draft",
            strict: true,
            schema
          }
        },
max_output_tokens: 2000
      };

      const r = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(openaiReq)
      });

      const raw = await r.text();
      if (!r.ok) {
        return res.status(500).json({ ok: false, error: "OpenAI request failed", detail: raw });
      }

      const data = raw ? JSON.parse(raw) : {};

// Helpers because Responses content blocks aren’t always plain strings
function readText(val: any): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val?.value === "string") return val.value; // common shape
  if (typeof val?.text === "string") return val.text;
  return "";
}

const outText = (() => {
  // SDK convenience field sometimes exists, sometimes not
  if (typeof (data as any).output_text === "string") {
    const s = (data as any).output_text.trim();
    if (s) return s;
  }

  // Raw Responses format: output[] can include multiple items (reasoning, message, etc.)
  if (Array.isArray((data as any).output)) {
    const parts: string[] = [];

    for (const item of (data as any).output) {
      if (!item || item.type !== "message" || !Array.isArray(item.content)) continue;

      for (const c of item.content) {
        if (!c) continue;

        // Normal text blocks
        if (c.type === "output_text" || c.type === "text") {
          const s = readText(c.text);
          if (s) parts.push(s);
          continue;
        }

        // Some variants can return JSON directly
        if ((c.type === "output_json" || c.type === "json") && c.json) {
          parts.push(JSON.stringify(c.json));
          continue;
        }

        // Last-ditch: if a text-ish field exists
        const fallback = readText(c.text);
        if (fallback) parts.push(fallback);
      }
    }

    return parts.join("\n").trim();
  }

  return "";
})();

// If still empty, return useful diagnostics (so you can see what came back)
if (!outText) {
  const outputTypes = Array.isArray((data as any).output)
    ? (data as any).output.map((o: any) => o?.type).filter(Boolean)
    : [];

  return res.status(500).json({
    ok: false,
    error: "Model returned empty output_text",
    hint: "The response contained no message text blocks we could parse. Inspect status/incomplete_details/outputTypes.",
    status: (data as any).status,
    incomplete_details: (data as any).incomplete_details,
    error_obj: (data as any).error,
    outputTypes,
    rawKeys: Object.keys(data || {})
  });
}


      let draft: any = null;
      try {
        draft = JSON.parse(outText);
      } catch {
        return res.status(500).json({ ok: false, error: "Failed to parse model JSON", outText });
      }

    // --- Prefer title from docs (deterministic) ---
const bestForTitle = pickBestDocText(docTexts);
if (bestForTitle && bestForTitle.text) {
  const exactTitle = extractTitleFromText(bestForTitle.text);
  if (exactTitle) draft.title = exactTitle;
}

// --- Prefer EVENT DESCRIPTION from docs if it exists (not the whole doc) ---
const bestDesc = pickBestEventDescriptionFromDocs(docTexts);
if (bestDesc && bestDesc.text) {
  draft.descriptionHtml = textToExactHtml(bestDesc.text);
} else {
  // If the model generated something too short / one-liner, force a proper multi-paragraph description.
  if (needsLongerDescription(draft.descriptionHtml)) {
    draft.descriptionHtml = await generateMultiParagraphDescriptionHtml({
      title: draft.title,
      venueName: draft.venueName,
      venueAddress: draft.venueAddress,
      startDateTime: draft.startDateTime,
      endDateTime: draft.endDateTime,
      doorsOpenTime: draft.doorsOpenTime,
      ageGuidance: draft.ageGuidance,
      eventType: draft.eventType,
      category: draft.category,
      tags: Array.isArray(draft.tags) ? draft.tags : [],
    }, { apiKey, model });
  }
}

      // --- Prefer doc-provided event description (verbatim) over AI-generated copy ---
const _escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const _bestDocText = (() => {
   const cleaned = (docTexts || [])
    .map((t) => (t?.text ?? "").trim())
    .filter(Boolean);
  cleaned.sort((a, b) => b.length - a.length);
  return cleaned[0] || "";
})();

const _docParas = _bestDocText
  .replace(/\r/g, "")
  .split(/\n{2,}|\n/)
  .map((s: string) => s.trim())
  .filter(Boolean);

let _usedDocDescription = false;

if (_docParas.length >= 2) {
  const maybeTitle = _docParas[0];
  const rest = _docParas.slice(1);

  // Heuristic: first line is a title if it's reasonably short and not obviously a sentence.
  const titleLooksLikeTitle = maybeTitle.length <= 140 && !/[.!?]$/.test(maybeTitle);

  const descParas = titleLooksLikeTitle ? rest : _docParas;
  const descCharCount = descParas.join(" ").replace(/\s+/g, " ").trim().length;

  // Only treat as a real “event description” if it’s got enough substance
  if (descParas.length >= 2 && descCharCount >= 80) {
    // Use DOCX/PDF text exactly, only wrapping in <p> blocks.
    draft.descriptionHtml = descParas.map((p: string) => `<p>${_escapeHtml(p)}</p>`).join("");
    
    // Only set title from doc if title is currently missing/empty
    if (titleLooksLikeTitle && (!draft.title || String(draft.title).trim().length < 3)) {
      draft.title = maybeTitle;
    }

    _usedDocDescription = true;
  }
}

// If we DIDN'T use the doc description, ensure AI output isn't a single-line blob.
// (No rewriting, just paragraph breaks.)
if (!_usedDocDescription && typeof draft.descriptionHtml === "string") {
  const plain = draft.descriptionHtml
    .replace(/<\/p>\s*<p>/g, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+>/g, "")
    .trim();

  const blocks = plain.split(/\n{2,}/).map((s: string) => s.trim()).filter(Boolean);
  
  if (blocks.length < 2 && plain.length > 0) {
    const sentences = plain.split(/([.!?])\s+/).filter(Boolean);
    // Rebuild sentences without changing words (just grouping)
    const rebuilt: string[] = [];
    for (let i = 0; i < sentences.length; i++) {
      const part = sentences[i];
      const next = sentences[i + 1];
      if (next && (next === "." || next === "!" || next === "?")) {
        rebuilt.push((part + next).trim());
        i++;
      } else {
        rebuilt.push(part.trim());
      }
    }

    if (rebuilt.length >= 3) {
      const third = Math.ceil(rebuilt.length / 3);
      const a = rebuilt.slice(0, third).join(" ");
      const b = rebuilt.slice(third, third * 2).join(" ");
      const c = rebuilt.slice(third * 2).join(" ");
      draft.descriptionHtml = [a, b, c].filter(Boolean).map(p => `<p>${_escapeHtml(p)}</p>`).join("");
    }
  }
}

(draft as any)._debug = (draft as any)._debug || {};
(draft as any)._debug.docDescriptionUsed = _usedDocDescription;
(draft as any)._debug.bestDocChars = _bestDocText.length;
(draft as any)._debug.docCount = Array.isArray(docTexts) ? docTexts.length : 0;


      return res.json({ ok: true, draft });

    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  }
);

export default router;
