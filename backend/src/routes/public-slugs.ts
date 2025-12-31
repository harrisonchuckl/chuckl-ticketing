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
    select: {
      id: true,
      title: true,
      date: true,
      slug: true,
      imageUrl: true,
      eventType: true,
      eventCategory: true,
      tags: true,
      venue: { select: { name: true } },
    },
  });

  const title = organiser.companyName || organiser.name || organiser.storefrontSlug;

  const visibleShows = shows.filter(show => !!show.slug);
  const featuredShows = visibleShows.slice(0, 6);

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
      const image = show.imageUrl
        ? `/img/fetch?src=${encodeURIComponent(show.imageUrl)}&w=800`
        : "";
      const tags = [show.eventType, show.eventCategory, ...(show.tags || [])]
        .filter(Boolean)
        .slice(0, 4);
      return `
        <article class="show-card" data-show
          data-date="${escHtml(show.date.toISOString())}"
          data-type="${escHtml(show.eventType || "")}"
          data-category="${escHtml(show.eventCategory || "")}"
          data-tags="${escHtml((show.tags || []).join(","))}">
          <a class="show-card__image" href="/public/${escHtml(storefront)}/${escHtml(show.slug)}" aria-label="View ${escHtml(show.title)}">
            ${
              image
                ? `<img src="${image}" alt="${escHtml(show.title)}" loading="lazy" />`
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
            <div class="show-card__details">
              ${escHtml(show.venue?.name || "Venue TBC")}
            </div>
            <div class="show-card__tags">
              ${
                tags.length
                  ? tags.map(tag => `<span class="pill">${escHtml(tag)}</span>`).join("")
                  : `<span class="pill pill--muted">Live event</span>`
              }
            </div>
            <div class="show-card__actions">
              <a class="btn btn--primary" href="/checkout?showId=${escHtml(show.id)}">Quick book</a>
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
      const image = show.imageUrl
        ? `/img/fetch?src=${encodeURIComponent(show.imageUrl)}&w=1400`
        : "";
      return `
        <div class="hero-slide${idx === 0 ? " is-active" : ""}" data-slide="${idx}">
          <div class="hero-media">
            ${
              image
                ? `<img src="${image}" alt="${escHtml(show.title)}" />`
                : `<div class="hero-placeholder" aria-hidden="true"></div>`
            }
          </div>
          <div class="hero-content">
            <span class="hero-eyebrow">Featured event</span>
            <h2>${escHtml(show.title || "Featured show")}</h2>
            <p>${escHtml(dateStr)} • ${escHtml(show.venue?.name || "Venue TBC")}</p>
            <div class="hero-actions">
              <a class="btn btn--primary" href="/checkout?showId=${escHtml(show.id)}">Quick book</a>
              <a class="btn btn--ghost" href="/public/${escHtml(storefront)}/${escHtml(show.slug)}">More info</a>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  const unique = (values: string[]) =>
    Array.from(new Set(values.filter(Boolean).map(value => value.trim()))).sort();

  const typeOptions = unique(visibleShows.map(show => show.eventType || ""));
  const categoryOptions = unique(visibleShows.map(show => show.eventCategory || ""));
  const tagOptions = unique(visibleShows.flatMap(show => show.tags || []));

  res.type("html").send(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escHtml(title)} – Events</title>
  <style>
    :root{
      --bg:#0b1220;
      --panel:#ffffff;
      --panel-muted:#f8fafc;
      --text:#0f172a;
      --muted:#64748b;
      --border:#e2e8f0;
      --brand:#111827;
      --brand-soft:#f1f5f9;
      --accent:#0ea5e9;
      --shadow:0 16px 40px rgba(15,23,42,.12);
    }
    *{box-sizing:border-box}
    body{
      font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
      margin:0;
      background:#f1f5f9;
      color:var(--text);
    }
    .wrap{max-width:1200px;margin:0 auto;padding:32px 20px 80px}
    h1{margin:0;font-size:32px;font-weight:800}
    h2{margin:0 0 16px;font-size:24px;font-weight:800}
    .muted{color:var(--muted);margin:8px 0 0}
    .hero{
      background:var(--panel);
      border-radius:24px;
      overflow:hidden;
      box-shadow:var(--shadow);
      position:relative;
    }
    .hero-slide{
      display:none;
      grid-template-columns:minmax(0,1.1fr) minmax(0,0.9fr);
      align-items:stretch;
    }
    .hero-slide.is-active{display:grid}
    .hero-media img,
    .hero-placeholder{
      width:100%;
      height:100%;
      min-height:320px;
      object-fit:cover;
      display:block;
      background:linear-gradient(120deg,#e2e8f0,#cbd5f5);
    }
    .hero-content{
      padding:48px 40px;
      display:flex;
      flex-direction:column;
      gap:12px;
      justify-content:center;
    }
    .hero-eyebrow{
      display:inline-flex;
      align-items:center;
      gap:8px;
      color:var(--accent);
      text-transform:uppercase;
      letter-spacing:.16em;
      font-size:12px;
      font-weight:700;
    }
    .hero-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:8px}
    .hero-controls{
      position:absolute;
      right:24px;
      bottom:24px;
      display:flex;
      gap:8px;
    }
    .hero-dot{
      width:10px;
      height:10px;
      border-radius:999px;
      border:1px solid rgba(15,23,42,.3);
      background:#fff;
      cursor:pointer;
    }
    .hero-dot.is-active{background:var(--accent);border-color:var(--accent)}
    .section{margin-top:40px}
    .filters{
      display:flex;
      flex-wrap:wrap;
      gap:12px;
      background:var(--panel);
      padding:16px;
      border-radius:16px;
      border:1px solid var(--border);
      box-shadow:0 6px 18px rgba(15,23,42,.06);
    }
    .filter{
      display:flex;
      flex-direction:column;
      gap:6px;
      min-width:160px;
      flex:1 1 160px;
    }
    .filter label{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted)}
    .filter select{
      border:1px solid var(--border);
      border-radius:10px;
      padding:10px 12px;
      font-size:14px;
      background:#fff;
    }
    .show-grid{
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(260px,1fr));
      gap:20px;
      margin-top:20px;
    }
    .show-card{
      background:var(--panel);
      border:1px solid var(--border);
      border-radius:20px;
      overflow:hidden;
      display:flex;
      flex-direction:column;
      box-shadow:0 8px 20px rgba(15,23,42,.08);
    }
    .show-card__image img,
    .show-card__placeholder{
      width:100%;
      height:200px;
      object-fit:cover;
      display:block;
      background:linear-gradient(120deg,#e2e8f0,#cbd5f5);
    }
    .show-card__body{padding:18px;display:flex;flex-direction:column;gap:10px}
    .show-card__meta{font-size:13px;color:var(--muted);display:flex;gap:6px;align-items:center}
    .show-card__title{font-size:18px;margin:0;font-weight:800}
    .show-card__details{color:var(--muted);font-size:14px}
    .show-card__tags{display:flex;flex-wrap:wrap;gap:6px}
    .pill{
      background:var(--brand-soft);
      color:var(--text);
      border-radius:999px;
      padding:4px 10px;
      font-size:12px;
      font-weight:600;
    }
    .pill--muted{background:#e2e8f0;color:#475569}
    .show-card__actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px}
    .btn{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      border-radius:10px;
      border:1px solid transparent;
      padding:10px 14px;
      font-weight:700;
      font-size:14px;
      text-decoration:none;
      transition:transform .2s ease, box-shadow .2s ease;
    }
    .btn--primary{
      background:var(--brand);
      color:#fff;
      box-shadow:0 8px 16px rgba(15,23,42,.2);
    }
    .btn--ghost{
      background:#fff;
      border-color:var(--border);
      color:var(--text);
    }
    .btn:hover{transform:translateY(-1px)}
    .empty{
      background:var(--panel);
      border-radius:16px;
      padding:24px;
      color:var(--muted);
      border:1px dashed var(--border);
      text-align:center;
    }
    @media (max-width:900px){
      .hero-slide{grid-template-columns:1fr}
      .hero-content{padding:32px 24px}
      .hero-controls{right:16px;bottom:16px}
    }
    @media (max-width:600px){
      .wrap{padding:24px 16px 60px}
      h1{font-size:26px}
      .hero-content{padding:24px 20px}
      .show-card__image img,.show-card__placeholder{height:180px}
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>${escHtml(title)}</h1>
      <p class="muted">What’s on at ${escHtml(title)} — hand-picked shows and all upcoming events.</p>
    </header>

    <section class="section hero" aria-label="Featured events">
      ${
        featuredCards ||
        `<div class="hero-slide is-active"><div class="hero-content"><span class="hero-eyebrow">Featured event</span><h2>No featured events yet</h2><p>Check back soon for new shows.</p></div></div>`
      }
      <div class="hero-controls" role="tablist" aria-label="Featured events carousel">
        ${
          featuredShows
            .map(
              (_, idx) =>
                `<button class="hero-dot${idx === 0 ? " is-active" : ""}" data-dot="${idx}" aria-label="Show slide ${
                  idx + 1
                }"></button>`
            )
            .join("") || ""
        }
      </div>
    </section>

    <section class="section">
      <h2>What’s on</h2>
      <div class="filters">
        <div class="filter">
          <label for="filter-date">Date</label>
          <select id="filter-date">
            <option value="all">All dates</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
          </select>
        </div>
        <div class="filter">
          <label for="filter-type">Show type</label>
          <select id="filter-type">
            <option value="">All types</option>
            ${typeOptions.map(type => `<option value="${escHtml(type)}">${escHtml(type)}</option>`).join("")}
          </select>
        </div>
        <div class="filter">
          <label for="filter-category">Category</label>
          <select id="filter-category">
            <option value="">All categories</option>
            ${categoryOptions
              .map(category => `<option value="${escHtml(category)}">${escHtml(category)}</option>`)
              .join("")}
          </select>
        </div>
        <div class="filter">
          <label for="filter-tag">Venue space</label>
          <select id="filter-tag">
            <option value="">All spaces</option>
            ${tagOptions.map(tag => `<option value="${escHtml(tag)}">${escHtml(tag)}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="show-grid" id="show-grid">
        ${cards || `<div class="empty">No live events yet.</div>`}
      </div>
    </section>
  </div>
  <script>
    (function(){
      const slides = Array.from(document.querySelectorAll('.hero-slide'));
      const dots = Array.from(document.querySelectorAll('.hero-dot'));
      let active = 0;

      function showSlide(index){
        slides.forEach((slide, i) => slide.classList.toggle('is-active', i === index));
        dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
        active = index;
      }

      if(slides.length > 1){
        dots.forEach(dot => {
          dot.addEventListener('click', () => {
            const idx = Number(dot.getAttribute('data-dot') || 0);
            showSlide(idx);
          });
        });
        setInterval(() => {
          showSlide((active + 1) % slides.length);
        }, 6000);
      }

      const dateFilter = document.getElementById('filter-date');
      const typeFilter = document.getElementById('filter-type');
      const categoryFilter = document.getElementById('filter-category');
      const tagFilter = document.getElementById('filter-tag');
      const cards = Array.from(document.querySelectorAll('[data-show]'));

      function matchesDate(iso, filter){
        if(!filter || filter === 'all') return true;
        const date = new Date(iso);
        const now = new Date();
        if(filter === 'today'){
          return date.toDateString() === now.toDateString();
        }
        if(filter === 'week'){
          const start = new Date(now);
          start.setDate(now.getDate() - now.getDay());
          const end = new Date(start);
          end.setDate(start.getDate() + 7);
          return date >= start && date < end;
        }
        if(filter === 'month'){
          return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        }
        return true;
      }

      function applyFilters(){
        const dateValue = dateFilter?.value || 'all';
        const typeValue = typeFilter?.value || '';
        const categoryValue = categoryFilter?.value || '';
        const tagValue = tagFilter?.value || '';
        let visibleCount = 0;

        cards.forEach(card => {
          const date = card.getAttribute('data-date') || '';
          const type = card.getAttribute('data-type') || '';
          const category = card.getAttribute('data-category') || '';
          const tags = card.getAttribute('data-tags') || '';
          const show =
            matchesDate(date, dateValue) &&
            (!typeValue || type === typeValue) &&
            (!categoryValue || category === categoryValue) &&
            (!tagValue || tags.split(',').includes(tagValue));
          card.style.display = show ? '' : 'none';
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

      [dateFilter, typeFilter, categoryFilter, tagFilter].forEach(filter => {
        if(filter){
          filter.addEventListener('change', applyFilters);
        }
      });
    })();
  </script>
</body>
</html>
  `);
});

export default router;
