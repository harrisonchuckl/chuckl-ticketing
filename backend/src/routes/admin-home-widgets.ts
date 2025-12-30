import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireAdminOrOrganiser } from "../lib/authz.js";
import {
  HOME_WIDGET_REGISTRY,
  getSafeHomeWidgetRegistry,
  getHomeWidgetCategoryOrderMap,
} from "../lib/home-widgets.js";

const router = Router();

function mergeWidgets(
  preferences: Array<{ widgetKey: string; enabled: boolean; order: number | null }>
) {
  const prefMap = new Map(preferences.map((pref) => [pref.widgetKey, pref]));
  return HOME_WIDGET_REGISTRY.map((widget) => {
    const pref = prefMap.get(widget.key);
    return {
      key: widget.key,
      title: widget.title,
      category: widget.category,
      slot: widget.slot,
      enabled: pref ? pref.enabled : widget.defaultEnabled,
      order: pref?.order ?? widget.defaultOrder,
      defaultOrder: widget.defaultOrder,
    };
  });
}

function sortWidgets(widgets: ReturnType<typeof mergeWidgets>) {
  const categoryOrder = getHomeWidgetCategoryOrderMap();
  return [...widgets].sort((a, b) => {
    const catA = categoryOrder.get(a.category) ?? 999;
    const catB = categoryOrder.get(b.category) ?? 999;
    if (catA !== catB) return catA - catB;
    const orderA = a.order ?? a.defaultOrder ?? 0;
    const orderB = b.order ?? b.defaultOrder ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    return a.title.localeCompare(b.title);
  });
}

router.get("/api/home-widgets", requireAdminOrOrganiser, async (req, res) => {
  try {
    const userId = String(req.user?.id || "");
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthorised" });

    const preferences = await prisma.dashboardWidgetPreference.findMany({
      where: { userId },
      select: { widgetKey: true, enabled: true, order: true },
    });

    const merged = mergeWidgets(preferences);
    const sorted = sortWidgets(merged);

    res.json({
      ok: true,
      registry: getSafeHomeWidgetRegistry(),
      widgets: sorted,
    });
  } catch (error) {
    console.error("home-widgets GET failed", error);
    res.status(500).json({ ok: false, error: "Failed to load widget preferences" });
  }
});

router.post("/api/home-widgets", requireAdminOrOrganiser, async (req, res) => {
  try {
    const userId = String(req.user?.id || "");
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthorised" });

    const widgetKey = String(req.body?.widgetKey || "").trim();
    const enabled = Boolean(req.body?.enabled);
    const order = req.body?.order;

    const widgetExists = HOME_WIDGET_REGISTRY.some((widget) => widget.key === widgetKey);
    if (!widgetKey || !widgetExists) {
      return res.status(400).json({ ok: false, error: "Unknown widget" });
    }

    const orderValue =
      order === null || order === undefined || order === "" ? null : Number(order);
    const orderToStore = Number.isFinite(orderValue) ? orderValue : null;

    await prisma.dashboardWidgetPreference.upsert({
      where: { userId_widgetKey: { userId, widgetKey } },
      update: { enabled, order: orderToStore },
      create: { userId, widgetKey, enabled, order: orderToStore },
    });

    const preferences = await prisma.dashboardWidgetPreference.findMany({
      where: { userId },
      select: { widgetKey: true, enabled: true, order: true },
    });

    const merged = mergeWidgets(preferences);
    const sorted = sortWidgets(merged);

    res.json({
      ok: true,
      registry: getSafeHomeWidgetRegistry(),
      widgets: sorted,
    });
  } catch (error) {
    console.error("home-widgets POST failed", error);
    res.status(500).json({ ok: false, error: "Failed to save widget preferences" });
  }
});

export default router;
