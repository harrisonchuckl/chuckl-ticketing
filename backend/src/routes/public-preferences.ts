import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { verifyPreferencesToken } from '../lib/email-marketing/preferences.js';
import { ensureContactPreferenceDefaults, recordPreferenceAudit, updateContactPreferences } from '../services/marketing/automations.js';

const router = Router();

function renderPage(body: string) {
  return `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Preferences</title>
    <style>
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:0;background:#0f172a;color:#fff;}
      .wrap{max-width:620px;margin:40px auto;padding:24px;background:#111827;border-radius:16px;}
      .btn{background:#2563eb;color:#fff;border:none;border-radius:999px;padding:10px 18px;cursor:pointer;font-weight:600;}
      .card{background:#0b1220;border-radius:12px;padding:16px;margin-top:16px;}
      .muted{color:#94a3b8;font-size:14px;}
      label{display:flex;align-items:center;gap:10px;margin:8px 0;}
    </style>
  </head>
  <body>
    <div class="wrap">${body}</div>
  </body>
  </html>
  `;
}

router.get('/preferences/:tenantSlug/:token', async (req, res) => {
  const tenantSlug = String(req.params.tenantSlug || '');
  const token = String(req.params.token || '');
  const payload = verifyPreferencesToken(token);
  if (!payload) return res.status(400).send(renderPage('This preference link is invalid or expired.'));

  const tenant = await prisma.user.findFirst({
    where: { OR: [{ storefrontSlug: tenantSlug }, { id: tenantSlug }] },
    select: { id: true, tradingName: true, companyName: true, name: true },
  });
  if (!tenant || tenant.id !== payload.tenantId) {
    return res.status(404).send(renderPage('Tenant not found.'));
  }

  const contact = await prisma.marketingContact.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: payload.email } },
    create: { tenantId: tenant.id, email: payload.email },
    update: {},
  });

  await ensureContactPreferenceDefaults(tenant.id, contact.id);

  const topics = await prisma.marketingPreferenceTopic.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'asc' },
  });
  const preferences = await prisma.marketingContactPreference.findMany({
    where: { tenantId: tenant.id, contactId: contact.id },
  });

  const prefMap = new Map(preferences.map((pref) => [pref.topicId, pref.status]));

  const form = `
    <div>
      <h2 style="margin-top:0;">Manage preferences</h2>
      <p class="muted">Choose which topics you want to hear about from ${
        tenant.tradingName || tenant.companyName || tenant.name || 'TIXL'
      }.</p>
    </div>
    <form method="post" class="card">
      ${topics
        .map((topic) => {
          const checked = prefMap.get(topic.id) !== 'UNSUBSCRIBED';
          return `
            <label>
              <input type="checkbox" name="topic_${topic.id}" ${checked ? 'checked' : ''} />
              <span>${topic.name}${topic.description ? ` <span class="muted">(${topic.description})</span>` : ''}</span>
            </label>
          `;
        })
        .join('')}
      <div style="margin-top:16px;">
        <button class="btn" type="submit">Save preferences</button>
      </div>
    </form>
  `;

  res.send(renderPage(form));
});

router.post('/preferences/:tenantSlug/:token', async (req, res) => {
  const tenantSlug = String(req.params.tenantSlug || '');
  const token = String(req.params.token || '');
  const payload = verifyPreferencesToken(token);
  if (!payload) return res.status(400).send(renderPage('This preference link is invalid or expired.'));

  const tenant = await prisma.user.findFirst({
    where: { OR: [{ storefrontSlug: tenantSlug }, { id: tenantSlug }] },
    select: { id: true, tradingName: true, companyName: true, name: true },
  });
  if (!tenant || tenant.id !== payload.tenantId) {
    return res.status(404).send(renderPage('Tenant not found.'));
  }

  const contact = await prisma.marketingContact.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email: payload.email } },
  });
  if (!contact) return res.status(404).send(renderPage('Contact not found.'));

  const topics = await prisma.marketingPreferenceTopic.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'asc' },
  });

  const topicStates = topics.map((topic) => ({
    topicId: topic.id,
    status: req.body?.[`topic_${topic.id}`] ? 'SUBSCRIBED' : 'UNSUBSCRIBED',
  }));

  await updateContactPreferences({ tenantId: tenant.id, contactId: contact.id, topicStates });
  await recordPreferenceAudit(tenant.id, 'preferences.updated', contact.id, { email: payload.email });

  const body = `
    <h2>Preferences saved</h2>
    <p class="muted">Your updates have been recorded. You can revisit this page anytime from the email footer.</p>
  `;
  res.send(renderPage(body));
});

export default router;
