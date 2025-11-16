import { Router } from "express";

const router = Router();

type LayoutKey = "tables" | "sections" | "mixed" | "blank";

function normaliseLayout(raw: string | undefined): LayoutKey {
  if (raw === "sections" || raw === "mixed" || raw === "blank") return raw;
  return "tables";
}

router.get("/builder/preview/:showId", (req, res) => {
  const showId = req.params.showId;
  const layout = normaliseLayout(req.query.layout as string | undefined);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Seat map builder – TickIn</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    :root {
      --bg: #f3f5fb;
      --card-bg: #ffffff;
      --accent: #2563eb;
      --accent-soft: rgba(37, 99, 235, 0.12);
      --accent-strong: rgba(37, 99, 235, 0.18);
      --border-subtle: rgba(15, 23, 42, 0.06);
      --text-main: #0f172a;
      --text-muted: #64748b;
      --pill-bg: #e2e8f0;
      --pill-text: #475569;
      --radius-lg: 22px;
      --radius-xl: 26px;
      --shadow-soft: 0 18px 45px rgba(15, 23, 42, 0.12);
      --shadow-card: 0 12px 30px rgba(15, 23, 42, 0.08);
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
        "Segoe UI", sans-serif;
      color: var(--text-main);
      background: radial-gradient(circle at top left, #e0ecff, #f6f7fc 44%, #eef1ff 85%);
    }

    body {
      display: flex;
      align-items: stretch;
      justify-content: center;
    }

    .builder-root {
      width: 100%;
      max-width: 1440px;
      margin: 18px auto;
      padding: 16px 20px 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      border-radius: 28px;
      background: linear-gradient(145deg, #f9f9ff, #f2f5ff);
      box-shadow: var(--shadow-soft);
    }

    .builder-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .header-left {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .step-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      background: rgba(15, 23, 42, 0.03);
      color: var(--text-muted);
    }

    .step-pill span.step-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 999px;
      background: #0f172a;
      color: #fff;
      font-weight: 600;
      font-size: 10px;
    }

    .builder-title {
      font-size: 22px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .builder-subtitle {
      font-size: 13px;
      color: var(--text-muted);
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .header-chip {
      font-size: 11px;
      padding: 5px 10px;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.15);
      color: #475569;
    }

    .header-close {
      border-radius: 999px;
      border: 0;
      background: white;
      width: 34px;
      height: 34px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.1);
      cursor: pointer;
    }

    .header-close span {
      font-size: 17px;
      line-height: 1;
    }

    .header-close:hover {
      transform: translateY(-1px);
    }

    .builder-shell {
      display: grid;
      grid-template-columns: 220px minmax(0, 1fr) 260px;
      gap: 16px;
      height: calc(100vh - 120px);
      min-height: 520px;
    }

    .panel {
      border-radius: var(--radius-lg);
      background: rgba(255, 255, 255, 0.92);
      box-shadow: var(--shadow-card);
      padding: 16px 16px 14px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .panel-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--text-muted);
      margin-bottom: 10px;
    }

    .tool-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 4px;
    }

    .tool-button {
      border-radius: 999px;
      border: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 10px;
      font-size: 12px;
      background: rgba(148, 163, 184, 0.06);
      color: var(--text-main);
      cursor: default;
    }

    .tool-main {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .tool-emoji {
      width: 24px;
      height: 24px;
      border-radius: 999px;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);
      font-size: 14px;
    }

    .tool-label {
      font-weight: 500;
      letter-spacing: -0.01em;
    }

    .tool-meta {
      font-size: 10px;
      color: var(--text-muted);
    }

    .tool-badge {
      font-size: 10px;
      padding: 3px 7px;
      border-radius: 999px;
      background: rgba(37, 99, 235, 0.06);
      color: var(--accent);
    }

    .canvas-inner {
      position: relative;
      flex: 1;
      border-radius: 18px;
      background-image: linear-gradient(
          to right,
          rgba(148, 163, 184, 0.16) 1px,
          transparent 1px
        ),
        linear-gradient(
          to bottom,
          rgba(148, 163, 184, 0.16) 1px,
          transparent 1px
        );
      background-size: 32px 32px;
      background-position: center;
      overflow: hidden;
    }

    .canvas-overlay-label {
      position: absolute;
      top: 10px;
      left: 12px;
      padding: 4px 9px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.9);
      color: white;
      font-size: 11px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .canvas-overlay-label span.dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: #22c55e;
    }

    .canvas-placeholder {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }

    .canvas-placeholder-inner {
      padding: 14px 18px;
      border-radius: 18px;
      background: rgba(248, 250, 252, 0.96);
      box-shadow: 0 14px 36px rgba(15, 23, 42, 0.18);
      text-align: left;
      max-width: 360px;
    }

    .canvas-placeholder-inner h2 {
      font-size: 15px;
      margin: 0 0 4px;
    }

    .canvas-placeholder-inner p {
      font-size: 12px;
      margin: 0 0 10px;
      color: var(--text-muted);
    }

    .canvas-placeholder-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .canvas-placeholder-pill {
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 11px;
      background: rgba(148, 163, 184, 0.16);
      color: #475569;
    }

    .layout-preview {
      position: absolute;
      inset: 54px 28px 24px 28px;
      display: flex;
      flex-wrap: wrap;
      align-content: flex-start;
      gap: 16px;
      overflow: auto;
      padding: 4px;
    }

    .layout-group-label {
      font-size: 11px;
      color: var(--text-muted);
      margin-bottom: 6px;
    }

    .table-group,
    .row-group,
    .mixed-group {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 8px 10px;
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.03);
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.10);
    }

    .seats-row {
      display: flex;
      gap: 4px;
    }

    .seat-dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: white;
      box-shadow: 0 2px 4px rgba(15, 23, 42, 0.25);
    }

    .seat-dot--primary {
      background: var(--accent);
    }

    .summary-body {
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
    }

    .summary-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      padding: 6px 8px;
      border-radius: 10px;
      background: rgba(148, 163, 184, 0.07);
    }

    .summary-row span.label {
      color: var(--text-muted);
    }

    .summary-row span.value {
      font-weight: 500;
    }

    .summary-note {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 6px;
    }

    .summary-footer {
      margin-top: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .primary-btn {
      border-radius: 999px;
      border: 0;
      padding: 9px 14px;
      font-size: 13px;
      font-weight: 500;
      background: var(--accent);
      color: white;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      cursor: pointer;
      box-shadow: 0 10px 24px var(--accent-strong);
    }

    .ghost-btn {
      border-radius: 999px;
      border: 0;
      padding: 8px 12px;
      font-size: 12px;
      background: rgba(15, 23, 42, 0.03);
      color: var(--text-muted);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      cursor: pointer;
    }

    .config-overlay {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at top, rgba(15, 23, 42, 0.30), rgba(15, 23, 42, 0.58));
      z-index: 10;
    }

    .config-card {
      width: 480px;
      max-width: 92vw;
      border-radius: var(--radius-xl);
      background: rgba(248, 250, 252, 0.98);
      box-shadow: 0 26px 60px rgba(15, 23, 42, 0.4);
      padding: 18px 20px 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .config-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
    }

    .config-title-block {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .config-caption {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: rgba(148, 163, 184, 1);
    }

    .config-heading {
      font-size: 18px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .config-subtitle {
      font-size: 12px;
      color: var(--text-muted);
      max-width: 280px;
    }

    .config-chip {
      padding: 5px 10px;
      border-radius: 999px;
      font-size: 11px;
      background: rgba(148, 163, 184, 0.14);
      color: #475569;
    }

    .config-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 14px;
      margin-top: 4px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
    }

    .field-label-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
    }

    .field-label {
      font-weight: 500;
    }

    .field-hint {
      font-size: 10px;
      color: var(--text-muted);
    }

    .field input[type="number"] {
      border-radius: 11px;
      border: 1px solid rgba(148, 163, 184, 0.7);
      padding: 7px 9px;
      font-size: 13px;
      font-family: inherit;
      outline: none;
      background: #ffffff;
    }

    .field input[type="number"]:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px var(--accent-soft);
    }

    .config-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-top: 6px;
    }

    .config-total {
      font-size: 12px;
      color: var(--text-muted);
    }

    .config-total strong {
      color: var(--text-main);
    }

    .config-actions {
      display: flex;
      gap: 8px;
    }

    .hidden {
      display: none !important;
    }
  </style>
</head>
<body>
  <div class="builder-root">
    <!-- header + three-panel shell omitted for brevity in this snippet -->
    <!-- (full file already pasted, so in your code editor you’ll have the complete HTML + JS from above) -->
  </div>
</body>
</html>`;

  res.status(200).send(html);
});

export default router;
