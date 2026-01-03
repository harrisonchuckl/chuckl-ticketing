## Summary
<!-- What changed and why -->

## Checklists

- [ ] Updated `docs/FEATURES.md` if a feature was added/removed/renamed
- [ ] Updated `docs/ROUTES.md` if any routes changed
- [ ] No duplicate route files or overlapping paths (CI will verify)
- [ ] Admin UI: existing tabs still render (Home, Analytics, Shows, Orders, Venues)
- [ ] Orders: Notes + Refunds still functional
- [ ] Shows: Ticket Types CRUD + Attendees CSV intact
- [ ] Stripe webhook still reachable (/webhooks/stripe)
- [ ] Scanner UI/API unaffected

## Manual QA (targeted)
- [ ] Global account portal loads and shows multi-venue orders at `/account/portal`
- [ ] Venue switcher links open `/public/:slug/account/portal`
- [ ] Account password change works from portal (global or venue)

## Screenshots / Proof
<!-- Optional: screenshots or logs -->
