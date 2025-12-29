import { Router } from "express";
import prisma from "../lib/prisma.js";

const router = Router();

function escHtml(v: any) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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
    select: { title: true, date: true, slug: true },
  });

  const title = organiser.companyName || organiser.name || organiser.storefrontSlug;

  const cards = shows
    .filter(s => !!s.slug)
    .map(s => {
      const d = new Date(s.date);
      const dateStr = d.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      return `
        <a class="card" href="/public/${escHtml(storefront)}/${escHtml(s.slug)}">
          <div class="t">${escHtml(s.title)}</div>
          <div class="m">${escHtml(dateStr)}</div>
        </a>
      `;
    })
    .join("");

  res.type("html").send(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escHtml(title)} – Events</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:0;background:#0b1220;color:#fff}
    .wrap{max-width:980px;margin:0 auto;padding:24px}
    h1{margin:0 0 6px;font-size:28px}
    .muted{opacity:.75;margin:0 0 18px}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
    .card{display:block;text-decoration:none;color:#fff;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:14px}
    .card:hover{background:rgba(255,255,255,.09)}
    .t{font-weight:700}
    .m{opacity:.75;margin-top:6px;font-size:13px}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${escHtml(title)}</h1>
    <p class="muted">Official storefront – more features coming soon (merch, followers, featured events).</p>
    <div class="grid">
      ${cards || `<div class="muted">No live events yet.</div>`}
    </div>
  </div>
</body>
</html>
  `);
});

export default router;
