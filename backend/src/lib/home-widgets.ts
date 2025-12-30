export type HomeWidgetCategory =
  | "Sales"
  | "Customers"
  | "Financial"
  | "Operations"
  | "Marketing";

export type HomeWidgetSlot =
  | "tile"
  | "panel"
  | "hero"
  | "table"
  | "snapshot";

export type HomeWidgetRegistryItem = {
  key: string;
  title: string;
  category: HomeWidgetCategory;
  defaultEnabled: boolean;
  defaultOrder: number;
  slot: HomeWidgetSlot;
};

export const HOME_WIDGET_CATEGORIES: HomeWidgetCategory[] = [
  "Sales",
  "Customers",
  "Financial",
  "Operations",
  "Marketing",
];

export const HOME_WIDGET_REGISTRY: HomeWidgetRegistryItem[] = [
  {
    key: "tickets_sold_7d",
    title: "Tickets sold (7d)",
    category: "Sales",
    defaultEnabled: true,
    defaultOrder: 10,
    slot: "tile",
  },
  {
    key: "orders_7d",
    title: "Orders (7d)",
    category: "Sales",
    defaultEnabled: true,
    defaultOrder: 20,
    slot: "tile",
  },
  {
    key: "gross_revenue_7d",
    title: "Gross revenue (7d)",
    category: "Sales",
    defaultEnabled: true,
    defaultOrder: 30,
    slot: "tile",
  },
  {
    key: "net_revenue_7d",
    title: "Net revenue (7d)",
    category: "Financial",
    defaultEnabled: true,
    defaultOrder: 40,
    slot: "tile",
  },
  {
    key: "average_order_value",
    title: "Average order value",
    category: "Financial",
    defaultEnabled: true,
    defaultOrder: 50,
    slot: "tile",
  },
  {
    key: "new_customers_7d",
    title: "New customers (7d)",
    category: "Customers",
    defaultEnabled: true,
    defaultOrder: 60,
    slot: "tile",
  },
  {
    key: "returning_customers_7d",
    title: "Returning customers (7d)",
    category: "Customers",
    defaultEnabled: true,
    defaultOrder: 70,
    slot: "tile",
  },
  {
    key: "refunds_7d",
    title: "Refunds (7d)",
    category: "Financial",
    defaultEnabled: true,
    defaultOrder: 80,
    slot: "tile",
  },
  {
    key: "booking_fee_kickback",
    title: "Booking Fee Kickback",
    category: "Financial",
    defaultEnabled: true,
    defaultOrder: 90,
    slot: "tile",
  },
  {
    key: "capacity_sold_next_30",
    title: "Capacity sold (next 30 days)",
    category: "Operations",
    defaultEnabled: true,
    defaultOrder: 100,
    slot: "tile",
  },
  {
    key: "sales_velocity_7d",
    title: "Sales velocity (7 days)",
    category: "Sales",
    defaultEnabled: true,
    defaultOrder: 110,
    slot: "tile",
  },
  {
    key: "fees_breakdown_7d",
    title: "Fees breakdown (7 days)",
    category: "Financial",
    defaultEnabled: true,
    defaultOrder: 120,
    slot: "tile",
  },
  {
    key: "abandoned_checkouts_7d",
    title: "Abandoned checkouts (7 days)",
    category: "Marketing",
    defaultEnabled: true,
    defaultOrder: 130,
    slot: "tile",
  },
  {
    key: "daily_performance_chart",
    title: "Daily Performance",
    category: "Sales",
    defaultEnabled: true,
    defaultOrder: 200,
    slot: "hero",
  },
  {
    key: "early_warnings",
    title: "Early Warnings",
    category: "Operations",
    defaultEnabled: true,
    defaultOrder: 210,
    slot: "panel",
  },
  {
    key: "top_performing_shows",
    title: "Top Performing Shows",
    category: "Sales",
    defaultEnabled: true,
    defaultOrder: 220,
    slot: "table",
  },
  {
    key: "needs_attention",
    title: "Needs Attention",
    category: "Operations",
    defaultEnabled: true,
    defaultOrder: 230,
    slot: "table",
  },
  {
    key: "customer_snapshot",
    title: "Customer Behaviour Snapshot",
    category: "Customers",
    defaultEnabled: true,
    defaultOrder: 240,
    slot: "snapshot",
  },
  {
    key: "upcoming_shows_at_risk",
    title: "Upcoming shows at risk",
    category: "Operations",
    defaultEnabled: true,
    defaultOrder: 250,
    slot: "panel",
  },
  {
    key: "top_referral_sources",
    title: "Top referral sources (30 days)",
    category: "Marketing",
    defaultEnabled: false,
    defaultOrder: 260,
    slot: "panel",
  },
];

export function getSafeHomeWidgetRegistry() {
  return HOME_WIDGET_REGISTRY.map((widget) => ({
    key: widget.key,
    title: widget.title,
    category: widget.category,
    defaultEnabled: widget.defaultEnabled,
    defaultOrder: widget.defaultOrder,
    slot: widget.slot,
  }));
}

export function getHomeWidgetCategoryOrderMap() {
  return new Map(HOME_WIDGET_CATEGORIES.map((cat, idx) => [cat, idx]));
}
