import { Router, json } from "express";
import type { StorefrontThemePage } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { requireAdminOrOrganiser } from "../lib/authz.js";

const router = Router();

const MAX_THEME_JSON_CHARS = 50000;
const MAX_COPY_LENGTH = 120;
const MAX_FOOTER_SECTION_TITLE = 80;
const MAX_FOOTER_ITEM_LENGTH = 120;
const MAX_FOOTER_SECTIONS = 6;
const MAX_FOOTER_ITEMS = 8;

const defaultTokens = {
  fontFamily: "Inter",
  bannerBg: "#0B1220",
  primary: "#2563EB",
  primaryText: "#FFFFFF",
  pageBg: "#0A0A0A",
  cardBg: "#111827",
  text: "#E5E7EB",
  mutedText: "#9CA3AF",
  borderRadius: 16,
};

const defaultCopy = {
  allEventsTitle: "What's On",
  allEventsSubtitle: "Upcoming events",
  eventPageCtaText: "Book Tickets",
  eventPageFromLabel: "From",
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clampString(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function parsePage(raw: unknown): StorefrontThemePage | null {
  if (raw === "all-events") return "ALL_EVENTS";
  if (raw === "event") return "EVENT_PAGE";
  return null;
}

function buildTokens(input: any) {
  const tokens: typeof defaultTokens = { ...defaultTokens };
  const tokenKeys = Object.keys(tokens) as Array<keyof typeof tokens>;
  if (input && typeof input === "object") {
    tokenKeys.forEach((key) => {
      const value = input[key];
      if (key === "borderRadius") {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) {
          tokens.borderRadius = Math.min(32, Math.max(0, parsed));
        }
        return;
      }
      if (typeof value === "string" && value.trim()) {
        tokens[key as Exclude<keyof typeof tokens, "borderRadius">] = value.trim();
      }
    });
  }
  return tokens;
}

function buildCopy(input: any) {
  const copy: typeof defaultCopy = { ...defaultCopy };
  const copyKeys = Object.keys(copy) as Array<keyof typeof copy>;
  if (input && typeof input === "object") {
    copyKeys.forEach((key) => {
      const value = clampString(input[key], MAX_COPY_LENGTH);
      if (value !== null) {
        copy[key] = escapeHtml(value);
      }
    });
  }
  return copy;
}

function buildFooter(input: any) {
  const sections: Array<{ title: string; items: string[] }> = [];
  if (input && typeof input === "object" && Array.isArray(input.sections)) {
    input.sections.slice(0, MAX_FOOTER_SECTIONS).forEach((section: any) => {
      const titleRaw = clampString(section?.title, MAX_FOOTER_SECTION_TITLE);
      const title = escapeHtml(titleRaw ?? "");
      const items: string[] = [];
      if (Array.isArray(section?.items)) {
        section.items.slice(0, MAX_FOOTER_ITEMS).forEach((item: any) => {
          const itemRaw = clampString(item, MAX_FOOTER_ITEM_LENGTH);
          if (itemRaw !== null) items.push(escapeHtml(itemRaw));
        });
      }
      sections.push({ title, items });
    });
  }
  return { sections };
}

function buildAssets(input: any) {
  const logoUrl = clampString(input?.logoUrl, 500) || "";
  return { logoUrl };
}

function sanitizeTheme(theme: any) {
  const tokens = buildTokens(theme?.tokens);
  const copy = buildCopy(theme?.copy);
  const footer = buildFooter(theme?.footer);
  const assets = buildAssets(theme?.assets);

  return { tokens, copy, footer, assets };
}

function assertThemeSize(theme: any) {
  const size = JSON.stringify(theme).length;
  if (size > MAX_THEME_JSON_CHARS) {
    throw new Error("Theme payload exceeds size limit.");
  }
}

router.get("/storefront-theme", requireAdminOrOrganiser, async (req, res) => {
  try {
    const organiserId = String(req.user?.id || "");
    if (!organiserId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const page = parsePage(req.query?.page);
    if (!page) {
      return res.status(400).json({ ok: false, error: "Invalid page" });
    }

    const theme = await prisma.storefrontTheme.findUnique({
      where: { organiserId_page: { organiserId, page } },
    });

    return res.json({
      ok: true,
      theme: theme?.draftJson ?? theme?.publishedJson ?? null,
      draftJson: theme?.draftJson ?? null,
      publishedJson: theme?.publishedJson ?? null,
      updatedAt: theme?.updatedAt ?? null,
      publishedAt: theme?.publishedAt ?? null,
    });
  } catch (err) {
    console.error("[admin-storefront-theme] GET failed", err);
    return res.status(500).json({ ok: false, error: "Failed to load theme" });
  }
});

router.post(
  "/storefront-theme/save-draft",
  requireAdminOrOrganiser,
  json({ limit: "200kb" }),
  async (req, res) => {
    try {
      const organiserId = String(req.user?.id || "");
      if (!organiserId) return res.status(401).json({ ok: false, error: "Unauthorized" });

      const page = parsePage(req.body?.page);
      if (!page) {
        return res.status(400).json({ ok: false, error: "Invalid page" });
      }

      const theme = sanitizeTheme(req.body?.theme || {});
      assertThemeSize(theme);

      const saved = await prisma.storefrontTheme.upsert({
        where: { organiserId_page: { organiserId, page } },
        update: { draftJson: theme },
        create: { organiserId, page, draftJson: theme },
      });

      return res.json({ ok: true, theme: saved.draftJson });
    } catch (err) {
      console.error("[admin-storefront-theme] save draft failed", err);
      return res.status(400).json({ ok: false, error: (err as Error).message || "Failed to save draft" });
    }
  }
);

router.post(
  "/storefront-theme/publish",
  requireAdminOrOrganiser,
  json({ limit: "200kb" }),
  async (req, res) => {
    try {
      const organiserId = String(req.user?.id || "");
      if (!organiserId) return res.status(401).json({ ok: false, error: "Unauthorized" });

      const page = parsePage(req.body?.page);
      if (!page) {
        return res.status(400).json({ ok: false, error: "Invalid page" });
      }

      let theme = req.body?.theme ? sanitizeTheme(req.body.theme) : null;
      if (theme) assertThemeSize(theme);

      const existing = await prisma.storefrontTheme.findUnique({
        where: { organiserId_page: { organiserId, page } },
      });

      if (!theme && !existing?.draftJson) {
        return res.status(400).json({ ok: false, error: "No draft theme to publish" });
      }

      const publishTheme = theme || existing?.draftJson;
      const updated = await prisma.storefrontTheme.upsert({
        where: { organiserId_page: { organiserId, page } },
        update: {
          draftJson: publishTheme as any,
          publishedJson: publishTheme as any,
          publishedAt: new Date(),
        },
        create: {
          organiserId,
          page,
          draftJson: publishTheme as any,
          publishedJson: publishTheme as any,
          publishedAt: new Date(),
        },
      });

      return res.json({ ok: true, theme: updated.publishedJson });
    } catch (err) {
      console.error("[admin-storefront-theme] publish failed", err);
      return res.status(400).json({ ok: false, error: (err as Error).message || "Failed to publish theme" });
    }
  }
);

router.post(
  "/storefront-theme/revert-to-published",
  requireAdminOrOrganiser,
  json({ limit: "50kb" }),
  async (req, res) => {
    try {
      const organiserId = String(req.user?.id || "");
      if (!organiserId) return res.status(401).json({ ok: false, error: "Unauthorized" });

      const page = parsePage(req.body?.page);
      if (!page) {
        return res.status(400).json({ ok: false, error: "Invalid page" });
      }

      const existing = await prisma.storefrontTheme.findUnique({
        where: { organiserId_page: { organiserId, page } },
      });

      if (!existing?.publishedJson) {
        return res.status(400).json({ ok: false, error: "No published theme to revert" });
      }

      const updated = await prisma.storefrontTheme.update({
        where: { organiserId_page: { organiserId, page } },
        data: { draftJson: existing.publishedJson },
      });

      return res.json({ ok: true, theme: updated.draftJson });
    } catch (err) {
      console.error("[admin-storefront-theme] revert failed", err);
      return res.status(400).json({ ok: false, error: (err as Error).message || "Failed to revert theme" });
    }
  }
);

export default router;
