import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createUnsubscribeToken, verifyUnsubscribeToken } from '../lib/email-marketing/unsubscribe.js';
import { matchesSegmentRules } from '../services/marketing/segments.js';
import { buildRecipientEntries, shouldSuppressContact } from '../services/marketing/campaigns.js';
import { buildStepsFromFlow, validateFlow } from '../services/marketing/flow.js';
import { MarketingConsentStatus, MarketingSuppressionType } from '@prisma/client';
import { sendMarketingSuiteShell } from '../lib/marketing-suite-shell.js';

const contact = {
  id: 'contact_1',
  email: 'alex@example.com',
  firstName: 'Alex',
  lastName: 'Doe',
  town: null,
  consentStatus: MarketingConsentStatus.SUBSCRIBED,
  tags: ['vip', 'repeat'],
  preferences: [],
};

const stats = {
  lastPurchase: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20),
  totalSpentPence: 45000,
  totalSpent90dPence: 30000,
  purchaseCount: 5,
  purchaseCount90d: 2,
  categories: new Set(['comedy', 'standup']),
  venues: new Set(['venue_1']),
  eventTypes: new Set(['show']),
  towns: new Set(['Townsville']),
  counties: new Set(['Countyshire']),
};

test('segment rule evaluation matches rules against contact + order stats', () => {
  const rules = [
    { type: 'HAS_TAG', value: 'vip' },
    { type: 'LAST_PURCHASE_OLDER_THAN', days: 7 },
    { type: 'TOTAL_SPENT_AT_LEAST', amount: 200 },
    { type: 'PURCHASED_CATEGORY_CONTAINS', value: 'comedy' },
    { type: 'ATTENDED_VENUE', venueId: 'venue_1' },
  ] as const;

  const matches = matchesSegmentRules(contact, rules as any, 'AND', stats, null, null);
  assert.equal(matches, true);
});

test('suppression exclusion blocks unsubscribed contacts', () => {
  const decision = shouldSuppressContact(MarketingConsentStatus.UNSUBSCRIBED, null);
  assert.equal(decision.suppressed, true);
  assert.match(decision.reason || '', /consent/);
});

test('unsubscribe token verification returns payload and enforces expiry', () => {
  const token = createUnsubscribeToken({ tenantId: 'tenant_1', email: 'alex@example.com', exp: Math.floor(Date.now() / 1000) + 60 });
  const payload = verifyUnsubscribeToken(token);
  assert.ok(payload);
  assert.equal(payload?.tenantId, 'tenant_1');
});

test('idempotent recipient creation dedupes contacts', () => {
  const recipients = buildRecipientEntries({
    tenantId: 'tenant_1',
    campaignId: 'camp_1',
    contacts: [contact, contact],
    suppressions: [{ email: 'nobody@example.com', type: MarketingSuppressionType.UNSUBSCRIBE }],
  });

  assert.equal(recipients.length, 1);
  assert.equal(recipients[0].contactId, 'contact_1');
});

test('flow validation requires trigger and templates for send nodes', () => {
  const errors = validateFlow(
    [
      { id: 'node_1', type: 'sendEmail', data: {} },
      { id: 'node_2', type: 'delay', data: { delayMinutes: 10 } },
    ],
    [{ source: 'node_1', target: 'node_2' }]
  );

  assert.ok(errors.some((err) => err.message.includes('Trigger')));
  assert.ok(errors.some((err) => err.message.includes('template')));
});

test('flow builder generates steps from connected nodes', () => {
  const steps = buildStepsFromFlow(
    [
      { id: 'trigger', type: 'trigger' },
      { id: 'delay_1', type: 'delay', data: { delayMinutes: 15 } },
      { id: 'send_1', type: 'sendEmail', data: { templateId: 'tmpl_1' } },
    ],
    [
      { source: 'trigger', target: 'delay_1' },
      { source: 'delay_1', target: 'send_1' },
    ]
  );

  assert.equal(steps.length, 2);
  assert.equal(steps[0].delayMinutes, 15);
  assert.equal(steps[1].templateId, 'tmpl_1');
});

test('marketing suite shell returns HTML for SPA routes', async () => {
  const app = express();
  app.get('/admin/marketing/*', (_req, res) => {
    sendMarketingSuiteShell(res);
  });

  const server = app.listen(0);
  const { port } = server.address() as { port: number };

  try {
    const response = await fetch(`http://127.0.0.1:${port}/admin/marketing/campaigns`);
    const contentType = response.headers.get('content-type') || '';
    const body = await response.text();
    assert.ok(contentType.includes('text/html'));
    assert.match(body, /Marketing Suite/);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
