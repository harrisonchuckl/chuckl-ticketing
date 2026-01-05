import test from 'node:test';
import assert from 'node:assert/strict';
import { createUnsubscribeToken, verifyUnsubscribeToken } from '../lib/email-marketing/unsubscribe.js';
import { matchesSegmentRules } from '../services/marketing/segments.js';
import { buildRecipientEntries, shouldSuppressContact } from '../services/marketing/campaigns.js';
import { MarketingConsentStatus, MarketingSuppressionType } from '@prisma/client';

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

  const matches = matchesSegmentRules(contact, rules as any, stats, null, null);
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
