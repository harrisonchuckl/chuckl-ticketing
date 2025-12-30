import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { verifyUnsubscribeToken } from '../lib/email-marketing/unsubscribe.js';
import { applySuppression } from '../services/marketing/campaigns.js';
import { MarketingSuppressionType } from '@prisma/client';

const router = Router();

function renderPage(message: string) {
  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Unsubscribe</title>
      <style>
        body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 40px; background: #f8fafc; color: #0f172a; }
        .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; max-width: 520px; margin: 40px auto; }
        .btn { background: #2563eb; color: #fff; border: none; padding: 10px 16px; border-radius: 8px; cursor: pointer; }
        .muted { color: #64748b; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>Marketing preferences</h2>
        <p>${message}</p>
        <p class="muted">You can close this window once completed.</p>
      </div>
    </body>
  </html>`;
}

router.get('/u/:tenantSlug/:token', async (req, res) => {
  const { tenantSlug, token } = req.params;
  const payload = verifyUnsubscribeToken(token);
  if (!payload) {
    return res.status(400).send(renderPage('This unsubscribe link is invalid or expired.'));
  }

  const tenant = await prisma.user.findFirst({
    where: { OR: [{ storefrontSlug: tenantSlug }, { id: tenantSlug }] },
  });
  if (!tenant || tenant.id !== payload.tenantId) {
    return res.status(404).send(renderPage('We could not locate this tenant.'));
  }

  res.send(`<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Unsubscribe</title>
      <style>
        body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 40px; background: #f8fafc; color: #0f172a; }
        .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; max-width: 520px; margin: 40px auto; }
        .btn { background: #2563eb; color: #fff; border: none; padding: 10px 16px; border-radius: 8px; cursor: pointer; }
        .muted { color: #64748b; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>Unsubscribe</h2>
        <p>Click below to unsubscribe ${payload.email} from marketing emails.</p>
        <form method="post" action="/u/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(token)}">
          <button class="btn" type="submit">Unsubscribe</button>
        </form>
      </div>
    </body>
  </html>`);
});

router.post('/u/:tenantSlug/:token', async (req, res) => {
  const { tenantSlug, token } = req.params;
  const payload = verifyUnsubscribeToken(token);
  if (!payload) {
    return res.status(400).send(renderPage('This unsubscribe link is invalid or expired.'));
  }

  const tenant = await prisma.user.findFirst({
    where: { OR: [{ storefrontSlug: tenantSlug }, { id: tenantSlug }] },
  });
  if (!tenant || tenant.id !== payload.tenantId) {
    return res.status(404).send(renderPage('We could not locate this tenant.'));
  }

  await applySuppression(payload.tenantId, payload.email, MarketingSuppressionType.UNSUBSCRIBE, 'User unsubscribe');

  res.send(renderPage('You are now unsubscribed from marketing emails.'));
});

export default router;
