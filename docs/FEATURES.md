# Chuckl Ticketing – Feature Registry

> Single source of truth for what exists today. Keep this updated when adding/removing features.

## Core
- ✅ Users: signup, login (cookie auth), logout, /auth/me
- ✅ Demo user bootstrap from Admin UI
- ✅ Password reset model (tokens) [API wired; mailer pending or mocked]
- ✅ Prisma schema (Users, Venues, Shows, TicketTypes, Orders, Tickets, Refunds, PasswordResets, OrderNotes)
- ✅ Stripe checkout + webhook fulfilment (paid, refunds)
- ✅ PDF tickets + email sending stub (services/email, services/pdf)
- ✅ Scanner API + UI (QR scan, mark ticket scanned)

## Admin UI (/admin/ui)
- ✅ Navigation: Home, Analytics, Shows, Orders, Venues, Audiences, Emails, Account
- ✅ Shows: list, detail, KPIs, Ticket Types CRUD, Attendees CSV download
- ✅ Orders: search (email/stripe/show), detail drawer
  - ✅ Notes (create/edit/delete, timestamped, author)
  - ✅ Refunds (full/partial via Stripe)
  - ✅ Ticket list with scan status
- ✅ Customers: navigation tab with per-customer rollups, search/filter controls, and profile drawer (orders, loyalty, notes/tags)
- ✅ Venues: create + search

## Analytics
- ✅ API: /admin/analytics/summary, /admin/analytics/sales-trend, /admin/analytics/top-shows
- ✅ Admin UI “Analytics” tab
  - KPIs: revenue, refunds, tickets sold, orders, live shows
  - Daily sales trend (revenue + tickets)
  - Top shows (by revenue) table

## Public/Customer
- ✅ /events (catalog endpoints)
- ✅ /checkout (create orders + Stripe session)

## Email
- ✅ Email service scaffold (ready to wire provider)
- 🟨 Resend tickets (public UI optional) — **not enabled by request**

## Notes
- Keep this document in sync when adding/removing routes, models, or UI tabs.
