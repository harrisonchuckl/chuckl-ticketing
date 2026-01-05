# Email Sending Setup (DNS + Sending Domain + Webhooks)

This guide covers the operational steps for configuring email sending in TIXL, including DNS records, sending domains, and webhook configuration. **No DNS changes are made by this app**—you must update DNS with your provider.

## 1) Choose your sending domain

TIXL supports **separate transactional and marketing streams**. Recommended options:

- **Transactional:** `mail.yourdomain.com`
- **Marketing:** `mktg.yourdomain.com`

Configure the marketing stream in the backend using:

- `MARKETING_STREAM_DOMAIN=mktg.yourdomain.com`
- `MARKETING_FROM_DOMAIN=yourdomain.com` (for verified-from checks)

## 2) DNS records

Add these DNS records for each sending domain (example shown for SendGrid):

1. **SPF**
   - `TXT` record: `v=spf1 include:sendgrid.net -all`
2. **DKIM**
   - SendGrid will provide two `CNAME` records for DKIM signing.
3. **DMARC**
   - `TXT` record at `_dmarc.yourdomain.com`
   - Example: `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com`

> Tip: Start DMARC in `p=none`, then move to `quarantine` or `reject` after you see clean reports.

## 3) Verify the domain in your ESP

- In SendGrid (or future SES), verify **each sending subdomain**.
- Ensure the `fromEmail` configured in marketing templates matches the verified domain.

## 4) Webhook configuration

TIXL records engagement events via webhook receivers.

### SendGrid

- In SendGrid, add an **Event Webhook** pointing to:

```
https://<your-app-domain>/webhooks/sendgrid
```

- Enable events: delivered, bounce, spam report, unsubscribe, open, click.

## 5) Local testing

- Set `PUBLIC_BASE_URL` or `APP_BASE_URL` to your local URL so unsubscribe/preferences links render correctly.
- Use a sandbox or test domain in your ESP.

## 6) Warm-up guidance

Use the **Deliverability** tab in Admin → Marketing to view suggested warm-up presets. Start with small sends to high-engagement segments and increase volume weekly.

## 7) Checklist

- [ ] SPF, DKIM, and DMARC in DNS
- [ ] Sending domain verified in ESP
- [ ] `MARKETING_STREAM_DOMAIN` configured
- [ ] Webhook URL configured
- [ ] Test email send + webhook events

## 8) Environment variable checklist

**Required for production sending**

- [ ] `SENDGRID_API_KEY` (or alternative provider credentials)
- [ ] `SENDGRID_WEBHOOK_TOKEN` (required if you enable webhook auth)
- [ ] `PUBLIC_BASE_URL` (or `APP_BASE_URL` / `BASE_URL` for unsubscribe links)
- [ ] `MARKETING_STREAM_DOMAIN`
- [ ] `MARKETING_FROM_DOMAIN`
- [ ] `MARKETING_UNSUBSCRIBE_SECRET`
- [ ] `MARKETING_PREFERENCES_SECRET`

**Operational limits**

- [ ] `MARKETING_WORKER_ENABLED`
- [ ] `MARKETING_WORKER_INTERVAL_MS`
- [ ] `MARKETING_SEND_RATE_PER_SEC`
- [ ] `MARKETING_SEND_BATCH_SIZE`
- [ ] `MARKETING_DAILY_LIMIT`
- [ ] `MARKETING_MAX_SEGMENT`
- [ ] `MARKETING_APPROVAL_THRESHOLD`

**Security & hardening**

- [ ] `SENDGRID_WEBHOOK_MAX_AGE_HOURS`
- [ ] `MARKETING_REQUIRE_VERIFIED_FROM`
- [ ] `MARKETING_STEPUP_TTL_MS`
- [ ] `MARKETING_UNSUBSCRIBE_EXP_DAYS`
- [ ] `MARKETING_PREFERENCES_EXP_DAYS`

**Caching & rate limits**

- [ ] `MARKETING_ESTIMATE_CACHE_MS`
- [ ] `MARKETING_ANALYTICS_CACHE_TTL_MS`
- [ ] `MARKETING_ESTIMATE_RATE_LIMIT_PER_MIN`
- [ ] `MARKETING_ANALYTICS_RATE_LIMIT_PER_MIN`
- [ ] `ANALYTICS_CACHE_TTL_MS`
