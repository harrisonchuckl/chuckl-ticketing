# API Routes Map (Admin + Public)

## Auth (/auth)
- POST /auth/signup
- POST /auth/login
- POST /auth/logout
- GET  /auth/me
- POST /auth/password/reset-request
- POST /auth/password/reset-confirm

## Admin UI
- GET  /admin/ui     (HTML)

## Admin JSON (/admin)
- Venues:    GET /venues, POST /venues
- Shows:     GET /shows/latest, GET /shows/:id, POST /shows/:id/ticket-types
- TicketTypes: PATCH /ticket-types/:id, DELETE /ticket-types/:id
- Orders:
  - GET /orders?q=&limit=
  - GET /orders/:id
  - POST /orders/:id/refund
  - Notes: POST /orders/:id/notes, PATCH /orders/:id/notes/:noteId, DELETE /orders/:id/notes/:noteId
- Uploads:   POST /uploads (if used)
- Analytics:
  - GET /analytics/summary?from=&to=
  - GET /analytics/sales-trend?from=&to=
  - GET /analytics/top-shows?from=&to=&limit=
- Shows CSV export:
  - GET /shows/:id/attendees.csv

## Public (/events, /checkout)
- Events catalog (/events/*)
- Checkout (/checkout/*)

## Stripe Webhooks
- POST /webhooks/stripe

## Scanner (/scan)
- Scanner API + UI
