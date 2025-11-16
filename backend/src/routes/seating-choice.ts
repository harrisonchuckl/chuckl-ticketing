import { Router } from "express";

const router = Router();

/**
 * Step 1 of the seating wizard:
 * Simple, minimal choice between Unallocated vs Allocated seating.
 *
 * Route: /admin/seating-choice/:showId
 */
router.get("/seating-choice/:showId", (req, res) => {
  const { showId } = req.params;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Choose seating style</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root {
      --bg-page: #f5f5f7;
      --card-bg: #ffffff;
      --card-border: #e5e5ea;
      --card-border-active: #007aff;
      --card-shadow: 0 18px 30px rgba(0, 0, 0, 0.06);
      --text-main: #111111;
      --text-muted: #6e6e73;
      --accent: #007aff;
      --radius-xl: 18px;
      --radius-xxl: 22px;
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      width: 100%;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
        "Helvetica Neue", Arial, sans-serif;
      background: radial-gradient(circle at top, #fdfdfd 0, #f5f5f7 55%, #f0f0f5 100%);
      color: var(--text-main);
    }

    body {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px 16px;
    }

    .shell {
      width: 100%;
      max-width: 960px;
      background: transparent;
    }

    .panel {
      background: var(--card-bg);
      border-radius: 28px;
      box-shadow: var(--card-shadow);
      padding: 32px 40px 28px;
      border: 1px solid rgba(0, 0, 0, 0.02);
    }

    .header {
      text-align: center;
      margin-bottom: 28px;
    }

    .title {
      margin: 0 0 4px;
      font-size: 24px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }

    .subtitle {
      margin: 0;
      font-size: 14px;
      color: var(--text-muted);
    }

    .choices {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
      margin-top: 4px;
    }

    @media (max-width: 720px) {
      .panel {
        padding: 24px 20px 22px;
      }

      .choices {
        grid-template-columns: 1fr;
      }
    }

    .choice-card {
      position: relative;
      border-radius: var(--radius-xxl);
      background: linear-gradient(145deg, #ffffff, #fafafa);
      border: 1px solid var(--card-border);
      padding: 20px 22px;
      text-align: left;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      justify-content: center;
      transition:
        box-shadow 140ms ease,
        transform 140ms ease,
        border-color 140ms ease,
        background 140ms ease;
      outline: none;
    }

    .choice-card--primary {
      background: linear-gradient(140deg, #ffffff, #f7f8ff);
    }

    .choice-label {
      font-size: 17px;
      font-weight: 600;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .choice-pill {
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      border: 1px solid rgba(0, 0, 0, 0.08);
      color: var(--text-muted);
    }

    .choice-text {
      font-size: 13px;
      color: var(--text-muted);
      margin: 0;
    }

    .choice-card:hover {
      box-shadow: 0 22px 40px rgba(0, 0, 0, 0.08);
      transform: translateY(-1px);
      border-color: rgba(0, 0, 0, 0.05);
      background: linear-gradient(145deg, #ffffff, #f8f8fb);
    }

    .choice-card:focus-visible {
      border-color: var(--card-border-active);
      box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.32);
    }

    .choice-card--primary:hover {
      border-color: rgba(0, 122, 255, 0.45);
      background: linear-gradient(145deg, #ffffff, #eef3ff);
    }

    .footer {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      margin-top: 18px;
      font-size: 13px;
    }

    .back-link {
      color: var(--text-muted);
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid rgba(0, 0, 0, 0.06);
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(10px);
      transition:
        background 140ms ease,
        border-color 140ms ease,
        color 140ms ease,
        transform 140ms ease,
        box-shadow 140ms ease;
    }

    .back-link svg {
      width: 13px;
      height: 13px;
    }

    .back-link:hover {
      background: #ffffff;
      border-color: rgba(0, 0, 0, 0.14);
      color: var(--text-main);
      transform: translateY(-0.5px);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.06);
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="panel">
      <div class="header">
        <h1 class="title">How do you want to sell seats for this event?</h1>
        <p class="subtitle">Choose a simple unallocated layout or a full seat map.</p>
      </div>

      <div class="choices">
        <button class="choice-card" data-kind="unallocated">
          <div class="choice-label">
            Unallocated seating
            <span class="choice-pill">Recommended for clubs</span>
          </div>
          <p class="choice-text">
            Sell tickets without assigning specific seats. Guests sit anywhere.
          </p>
        </button>

        <button class="choice-card choice-card--primary" data-kind="allocated">
          <div class="choice-label">
            Allocated seating
            <span class="choice-pill">Seat map</span>
          </div>
          <p class="choice-text">
            Build a seating plan so customers can choose exact seats.
          </p>
        </button>
      </div>

      <div class="footer">
        <a class="back-link" href="/admin/ui/shows/${encodeURIComponent(
          showId
        )}/edit">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M11.3 4.3a1 1 0 0 1 0 1.4L8.41 8.59 14 9a1 1 0 1 1-.07 2L8.4 10.99l2.9 2.9a1 1 0 0 1-1.42 1.42l-4.24-4.25a1.25 1.25 0 0 1 0-1.77l4.24-4.24a1 1 0 0 1 1.42 0z" fill="currentColor" />
          </svg>
          Back to event details
        </a>
      </div>
    </div>
  </div>

  <script>
    (function () {
      const showId = ${JSON.stringify(showId)};
      const cards = document.querySelectorAll(".choice-card");

      function go(kind) {
        if (!showId) return;
        const base = "/admin/seating";
        if (kind === "unallocated") {
          window.location.href = base + "/unallocated/" + encodeURIComponent(showId);
        } else if (kind === "allocated") {
          window.location.href = base + "/layout-wizard/" + encodeURIComponent(showId);
        }
      }

      cards.forEach(function (card) {
        card.addEventListener("click", function () {
          const kind = card.getAttribute("data-kind");
          go(kind);
        });

        card.addEventListener("keyup", function (ev) {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            const kind = card.getAttribute("data-kind");
            go(kind);
          }
        });
      });
    })();
  </script>
</body>
</html>`;

  res.type("html").send(html);
});

/**
 * Stub pages so the choices work immediately.
 * We'll replace these with the real wizard/builder soon.
 */

// Unallocated seating – stub
router.get("/seating/unallocated/:showId", (req, res) => {
  const { showId } = req.params;
  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Unallocated seating (stub)</title>
</head>
<body>
  <h1>Unallocated seating for show ${showId}</h1>
  <p>This is a placeholder. Here we'll build the unallocated ticket-type flow.</p>
  <p><a href="/admin/ui/shows/${encodeURIComponent(
    showId
  )}/tickets">Back to Tickets page</a></p>
</body>
</html>`);
});

// Layout wizard – stub
router.get("/seating/layout-wizard/:showId", (req, res) => {
  const { showId } = req.params;
  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Layout wizard (stub)</title>
</head>
<body>
  <h1>Layout wizard for show ${showId}</h1>
  <p>This is a placeholder. Next step will be the 4-box layout-type page (Tables & Chairs, Sections & Rows, Mixed, Blank canvas).</p>
  <p><a href="/admin/seating-choice/${encodeURIComponent(
    showId
  )}">Back to seating choice</a></p>
</body>
</html>`);
});

export default router;
