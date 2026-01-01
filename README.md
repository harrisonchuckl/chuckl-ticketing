# TixAll Admin

## Smart Shows Analytics (MVP)

Smart Shows Analytics is a rule-based insights layer that summarizes sales pace, week-over-week momentum, and forecasted capacity per show. Analytics are computed from paid orders/tickets at request time:

- **soldCount**: sum of paid ticket quantities per show.
- **revenuePence**: sum of paid order totals per show.
- **capacity**: `showCapacity` if set, otherwise the sum of ticket type allocations (unlimited capacity yields `null`).
- **last7 / prev7**: tickets sold in the last 7 days vs. days 8–14 ago.
- **wowPct**: `((last7 - prev7) / prev7) * 100` (with graceful fallback when `prev7` is 0).
- **pacePerDay**: `last7 / 7` (falls back to `last14 / 14`).
- **forecastSold**: `soldCount + pacePerDay * timeToShowDays`.

Risk badges and recommendations are deterministic. To adjust target pace thresholds, update the `paceThresholds` array in `backend/src/services/smart-shows-analytics.ts`.
