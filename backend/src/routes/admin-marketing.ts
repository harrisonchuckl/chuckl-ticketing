import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireAdminOrOrganiser } from '../lib/authz.js';
import { renderMarketingTemplate } from '../lib/email-marketing/rendering.js';
import { createUnsubscribeToken } from '../lib/email-marketing/unsubscribe.js';
import { createPreferencesToken } from '../lib/email-marketing/preferences.js';
import {
  MarketingAutomationTriggerType,
  MarketingCampaignStatus,
  MarketingConsentSource,
  MarketingConsentStatus,
  MarketingLawfulBasis,
  MarketingRecipientStatus,
  Prisma,
} from '@prisma/client';
import { evaluateSegmentContacts, estimateSegment } from '../services/marketing/segments.js';
import { ensureDailyLimit } from '../services/marketing/campaigns.js';
import {
  fetchDeliverabilitySummary,
  fetchTopSegmentsByEngagement,
  recordAutomationAudit,
  recordDeliverabilityAudit,
  recordPreferenceAudit,
  warmupPresets,
} from '../services/marketing/automations.js';

const router = Router();

function tenantIdFrom(req: any) {
  return String(req.user?.id || '');
}

function tenantNameFrom(user: { tradingName?: string | null; companyName?: string | null; name?: string | null }) {
  return user.tradingName || user.companyName || user.name || 'TIXL';
}

async function logMarketingAudit(
  tenantId: string,
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata?: Prisma.InputJsonValue
) {
  await prisma.marketingAuditLog.create({
    data: {
      tenantId,
      action,
      entityType,
      entityId: entityId || null,
      metadata: metadata || undefined,
    },
  });
}

const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || process.env.BASE_URL || 'http://localhost:4000';

router.get('/marketing/contacts', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const q = String(req.query.q || '').trim().toLowerCase();

  const contacts = await prisma.marketingContact.findMany({
    where: {
      tenantId,
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: { consents: true, tags: { include: { tag: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const items = contacts.map((contact) => ({
    id: contact.id,
    email: contact.email,
    firstName: contact.firstName,
    lastName: contact.lastName,
    status: contact.consents[0]?.status || MarketingConsentStatus.TRANSACTIONAL_ONLY,
    tags: contact.tags.map((t) => t.tag.name),
    createdAt: contact.createdAt,
  }));

  res.json({ ok: true, items });
});

router.post('/marketing/contacts', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ ok: false, message: 'Email required' });

  const contact = await prisma.marketingContact.upsert({
    where: { tenantId_email: { tenantId, email } },
    create: {
      tenantId,
      email,
      firstName: req.body?.firstName || null,
      lastName: req.body?.lastName || null,
      phone: req.body?.phone || null,
      town: req.body?.town || null,
    },
    update: {
      firstName: req.body?.firstName || undefined,
      lastName: req.body?.lastName || undefined,
      phone: req.body?.phone || undefined,
      town: req.body?.town || undefined,
    },
  });

  const status = req.body?.status || MarketingConsentStatus.TRANSACTIONAL_ONLY;
  const lawfulBasis = req.body?.lawfulBasis || MarketingLawfulBasis.UNKNOWN;

  await prisma.marketingConsent.upsert({
    where: { tenantId_contactId: { tenantId, contactId: contact.id } },
    create: {
      tenantId,
      contactId: contact.id,
      status,
      lawfulBasis,
      source: MarketingConsentSource.ADMIN_EDIT,
      capturedAt: new Date(),
    },
    update: {
      status,
      lawfulBasis,
      source: MarketingConsentSource.ADMIN_EDIT,
      capturedAt: new Date(),
    },
  });

  await logMarketingAudit(tenantId, 'contact.saved', 'MarketingContact', contact.id, { email });

  res.json({ ok: true, contactId: contact.id });
});

router.get('/marketing/segments', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const items = await prisma.marketingSegment.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ ok: true, items });
});

router.post('/marketing/segments', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const { name, description, rules } = req.body || {};
  if (!name) return res.status(400).json({ ok: false, message: 'Name required' });

  const segment = await prisma.marketingSegment.create({
    data: {
      tenantId,
      name,
      description: description || null,
      rules: rules || { rules: [] },
    },
  });
  await logMarketingAudit(tenantId, 'segment.created', 'MarketingSegment', segment.id, { name });
  res.json({ ok: true, segment });
});

router.put('/marketing/segments/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const { name, description, rules } = req.body || {};

  const existing = await prisma.marketingSegment.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Segment not found' });

  const segment = await prisma.marketingSegment.update({
    where: { id },
    data: {
      name: name || undefined,
      description: description ?? undefined,
      rules: rules || undefined,
    },
  });
  await logMarketingAudit(tenantId, 'segment.updated', 'MarketingSegment', segment.id, { name });
  res.json({ ok: true, segment });
});

router.delete('/marketing/segments/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const existing = await prisma.marketingSegment.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Segment not found' });
  await prisma.marketingSegment.delete({ where: { id } });
  await logMarketingAudit(tenantId, 'segment.deleted', 'MarketingSegment', id);
  res.json({ ok: true });
});

router.get('/marketing/segments/:id/estimate', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const segment = await prisma.marketingSegment.findFirst({ where: { id, tenantId } });
  if (!segment) return res.status(404).json({ ok: false, message: 'Segment not found' });

  const estimate = await estimateSegment(tenantId, segment.rules);
  res.json({ ok: true, estimate });
});

router.get('/marketing/templates', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const items = await prisma.marketingTemplate.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ ok: true, items });
});

router.get('/marketing/automations', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const items = await prisma.marketingAutomation.findMany({
    where: { tenantId },
    include: { steps: { include: { template: true }, orderBy: { stepOrder: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ ok: true, items });
});

router.post('/marketing/automations', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const { name, triggerType, isEnabled } = req.body || {};
  if (!name || !triggerType) return res.status(400).json({ ok: false, message: 'Name + trigger required' });

  const automation = await prisma.marketingAutomation.create({
    data: {
      tenantId,
      name,
      triggerType: triggerType as MarketingAutomationTriggerType,
      isEnabled: isEnabled !== undefined ? Boolean(isEnabled) : true,
    },
  });

  await recordAutomationAudit(tenantId, 'automation.created', automation.id, { triggerType });

  res.json({ ok: true, automation });
});

router.put('/marketing/automations/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const { name, triggerType, isEnabled } = req.body || {};

  const existing = await prisma.marketingAutomation.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Automation not found' });

  const automation = await prisma.marketingAutomation.update({
    where: { id },
    data: {
      name: name || undefined,
      triggerType: triggerType || undefined,
      isEnabled: isEnabled !== undefined ? Boolean(isEnabled) : undefined,
    },
  });

  await recordAutomationAudit(tenantId, 'automation.updated', automation.id, { triggerType, isEnabled });

  res.json({ ok: true, automation });
});

router.delete('/marketing/automations/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);

  const existing = await prisma.marketingAutomation.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Automation not found' });

  await prisma.marketingAutomation.delete({ where: { id } });
  await recordAutomationAudit(tenantId, 'automation.deleted', id);
  res.json({ ok: true });
});

router.post('/marketing/automations/:id/steps', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const automationId = String(req.params.id);
  const { delayMinutes, templateId, conditionRules, stepOrder } = req.body || {};
  if (!templateId || stepOrder === undefined) {
    return res.status(400).json({ ok: false, message: 'Template + step order required' });
  }

  const automation = await prisma.marketingAutomation.findFirst({ where: { id: automationId, tenantId } });
  if (!automation) return res.status(404).json({ ok: false, message: 'Automation not found' });

  const step = await prisma.marketingAutomationStep.create({
    data: {
      tenantId,
      automationId,
      delayMinutes: Number(delayMinutes || 0),
      templateId,
      conditionRules: conditionRules || {},
      stepOrder: Number(stepOrder),
    },
  });

  await recordAutomationAudit(tenantId, 'automation.step.created', automationId, { stepId: step.id });
  res.json({ ok: true, step });
});

router.put('/marketing/automations/:id/steps/:stepId', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const automationId = String(req.params.id);
  const stepId = String(req.params.stepId);
  const { delayMinutes, templateId, conditionRules, stepOrder } = req.body || {};

  const existing = await prisma.marketingAutomationStep.findFirst({
    where: { id: stepId, tenantId, automationId },
  });
  if (!existing) return res.status(404).json({ ok: false, message: 'Step not found' });

  const step = await prisma.marketingAutomationStep.update({
    where: { id: stepId },
    data: {
      delayMinutes: delayMinutes !== undefined ? Number(delayMinutes) : undefined,
      templateId: templateId || undefined,
      conditionRules: conditionRules || undefined,
      stepOrder: stepOrder !== undefined ? Number(stepOrder) : undefined,
    },
  });

  await recordAutomationAudit(tenantId, 'automation.step.updated', automationId, { stepId });
  res.json({ ok: true, step });
});

router.delete('/marketing/automations/:id/steps/:stepId', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const automationId = String(req.params.id);
  const stepId = String(req.params.stepId);

  const existing = await prisma.marketingAutomationStep.findFirst({
    where: { id: stepId, tenantId, automationId },
  });
  if (!existing) return res.status(404).json({ ok: false, message: 'Step not found' });

  await prisma.marketingAutomationStep.delete({ where: { id: stepId } });
  await recordAutomationAudit(tenantId, 'automation.step.deleted', automationId, { stepId });
  res.json({ ok: true });
});

router.get('/marketing/preferences/topics', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const items = await prisma.marketingPreferenceTopic.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ ok: true, items });
});

router.post('/marketing/preferences/topics', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const { name, description, isDefault } = req.body || {};
  if (!name) return res.status(400).json({ ok: false, message: 'Name required' });

  const topic = await prisma.marketingPreferenceTopic.create({
    data: {
      tenantId,
      name,
      description: description || null,
      isDefault: isDefault !== undefined ? Boolean(isDefault) : true,
    },
  });

  await recordPreferenceAudit(tenantId, 'preferences.topic.created', topic.id, { name });
  res.json({ ok: true, topic });
});

router.put('/marketing/preferences/topics/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const { name, description, isDefault } = req.body || {};

  const existing = await prisma.marketingPreferenceTopic.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Topic not found' });

  const topic = await prisma.marketingPreferenceTopic.update({
    where: { id },
    data: {
      name: name || undefined,
      description: description ?? undefined,
      isDefault: isDefault !== undefined ? Boolean(isDefault) : undefined,
    },
  });

  await recordPreferenceAudit(tenantId, 'preferences.topic.updated', topic.id, { name, isDefault });
  res.json({ ok: true, topic });
});

router.delete('/marketing/preferences/topics/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);

  const existing = await prisma.marketingPreferenceTopic.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Topic not found' });

  await prisma.marketingPreferenceTopic.delete({ where: { id } });
  await recordPreferenceAudit(tenantId, 'preferences.topic.deleted', id);
  res.json({ ok: true });
});

router.get('/marketing/deliverability/summary', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const days = Number(req.query.days || 30);
  const summary = await fetchDeliverabilitySummary(tenantId, days);
  await recordDeliverabilityAudit(tenantId, { days });
  res.json({ ok: true, summary });
});

router.get('/marketing/deliverability/top-segments', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const days = Number(req.query.days || 30);
  const items = await fetchTopSegmentsByEngagement(tenantId, days);
  res.json({ ok: true, items });
});

router.get('/marketing/deliverability/warmup', requireAdminOrOrganiser, async (_req, res) => {
  res.json({ ok: true, data: warmupPresets() });
});

router.post('/marketing/templates', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const { name, subject, fromName, fromEmail, replyTo, mjmlBody } = req.body || {};
  if (!name || !subject || !fromName || !fromEmail || !mjmlBody) {
    return res.status(400).json({ ok: false, message: 'Missing template fields' });
  }

  const template = await prisma.marketingTemplate.create({
    data: {
      tenantId,
      name,
      subject,
      fromName,
      fromEmail,
      replyTo: replyTo || null,
      mjmlBody,
    },
  });
  await logMarketingAudit(tenantId, 'template.created', 'MarketingTemplate', template.id, { name });
  res.json({ ok: true, template });
});

router.put('/marketing/templates/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const { name, subject, fromName, fromEmail, replyTo, mjmlBody } = req.body || {};

  const existing = await prisma.marketingTemplate.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Template not found' });

  const template = await prisma.marketingTemplate.update({
    where: { id },
    data: {
      name: name || undefined,
      subject: subject || undefined,
      fromName: fromName || undefined,
      fromEmail: fromEmail || undefined,
      replyTo: replyTo ?? undefined,
      mjmlBody: mjmlBody || undefined,
    },
  });
  await logMarketingAudit(tenantId, 'template.updated', 'MarketingTemplate', template.id, { name });
  res.json({ ok: true, template });
});

router.delete('/marketing/templates/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const existing = await prisma.marketingTemplate.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Template not found' });
  await prisma.marketingTemplate.delete({ where: { id } });
  await logMarketingAudit(tenantId, 'template.deleted', 'MarketingTemplate', id);
  res.json({ ok: true });
});

router.post('/marketing/templates/:id/preview', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const template = await prisma.marketingTemplate.findFirst({ where: { id, tenantId } });
  if (!template) return res.status(404).json({ ok: false, message: 'Template not found' });

  const tenant = await prisma.user.findUnique({
    where: { id: tenantId },
    select: { tradingName: true, companyName: true, name: true, storefrontSlug: true, id: true },
  });
  if (!tenant) return res.status(404).json({ ok: false, message: 'Tenant not found' });

  const email = String(req.body?.sample?.email || 'sample@example.com');
  const token = createUnsubscribeToken({ tenantId, email });
  const unsubscribeUrl = `${PUBLIC_BASE_URL.replace(/\/+$/, '')}/u/${encodeURIComponent(
    tenant.storefrontSlug || tenant.id
  )}/${encodeURIComponent(token)}`;
  const preferencesToken = createPreferencesToken({ tenantId, email });
  const preferencesUrl = `${PUBLIC_BASE_URL.replace(/\/+$/, '')}/preferences/${encodeURIComponent(
    tenant.storefrontSlug || tenant.id
  )}/${encodeURIComponent(preferencesToken)}`;

  const { html, errors } = renderMarketingTemplate(template.mjmlBody, {
    firstName: req.body?.sample?.firstName || 'Sample',
    lastName: req.body?.sample?.lastName || 'User',
    email,
    tenantName: tenantNameFrom(tenant),
    unsubscribeUrl,
    preferencesUrl,
  });

  res.json({ ok: true, html, errors });
});

router.get('/marketing/campaigns', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const items = await prisma.marketingCampaign.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: {
      template: { select: { name: true } },
      segment: { select: { name: true } },
    },
  });
  res.json({ ok: true, items });
});

router.post('/marketing/campaigns', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const { name, templateId, segmentId } = req.body || {};
  if (!name || !templateId || !segmentId) {
    return res.status(400).json({ ok: false, message: 'Missing campaign fields' });
  }

  const campaign = await prisma.marketingCampaign.create({
    data: {
      tenantId,
      name,
      templateId,
      segmentId,
      status: MarketingCampaignStatus.DRAFT,
      createdByUserId: tenantId,
    },
  });
  await logMarketingAudit(tenantId, 'campaign.created', 'MarketingCampaign', campaign.id, { name });
  res.json({ ok: true, campaign });
});

router.put('/marketing/campaigns/:id', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const { name, templateId, segmentId } = req.body || {};

  const existing = await prisma.marketingCampaign.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Campaign not found' });

  const campaign = await prisma.marketingCampaign.update({
    where: { id },
    data: {
      name: name || undefined,
      templateId: templateId || undefined,
      segmentId: segmentId || undefined,
    },
  });
  await logMarketingAudit(tenantId, 'campaign.updated', 'MarketingCampaign', campaign.id, { name });
  res.json({ ok: true, campaign });
});

router.post('/marketing/campaigns/:id/preview', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const campaign = await prisma.marketingCampaign.findFirst({
    where: { id, tenantId },
    include: { template: true, segment: true, tenant: true },
  });
  if (!campaign) return res.status(404).json({ ok: false, message: 'Campaign not found' });

  const estimate = await estimateSegment(tenantId, campaign.segment.rules);
  const sampleContact = await evaluateSegmentContacts(tenantId, campaign.segment.rules).then((c) => c[0]);
  const email = sampleContact?.email || 'sample@example.com';
  const token = createUnsubscribeToken({ tenantId, email });
  const unsubscribeUrl = `${PUBLIC_BASE_URL.replace(/\/+$/, '')}/u/${encodeURIComponent(
    campaign.tenant.storefrontSlug || campaign.tenantId
  )}/${encodeURIComponent(token)}`;
  const preferencesToken = createPreferencesToken({ tenantId, email });
  const preferencesUrl = `${PUBLIC_BASE_URL.replace(/\/+$/, '')}/preferences/${encodeURIComponent(
    campaign.tenant.storefrontSlug || campaign.tenantId
  )}/${encodeURIComponent(preferencesToken)}`;

  const { html, errors } = renderMarketingTemplate(campaign.template.mjmlBody, {
    firstName: sampleContact?.firstName || 'Sample',
    lastName: sampleContact?.lastName || 'User',
    email,
    tenantName: tenantNameFrom(campaign.tenant),
    unsubscribeUrl,
    preferencesUrl,
  });

  res.json({ ok: true, estimate, html, errors });
});

router.post('/marketing/campaigns/:id/schedule', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);
  const sendNow = Boolean(req.body?.sendNow);
  const scheduledFor = req.body?.scheduledFor ? new Date(req.body.scheduledFor) : null;

  const campaign = await prisma.marketingCampaign.findFirst({
    where: { id, tenantId },
    include: { segment: true },
  });
  if (!campaign) return res.status(404).json({ ok: false, message: 'Campaign not found' });

  const estimate = await estimateSegment(tenantId, campaign.segment.rules);
  const maxSegment = Number(process.env.MARKETING_MAX_SEGMENT || 20000);
  const role = String(req.user?.role || '').toUpperCase();
  if (estimate.count > maxSegment && role !== 'ADMIN') {
    return res.status(403).json({ ok: false, message: 'Segment too large for your role.' });
  }

  await ensureDailyLimit(tenantId, estimate.count);

  const nextStatus = MarketingCampaignStatus.SCHEDULED;
  const scheduledTime = sendNow ? new Date() : scheduledFor;

  if (!scheduledTime || isNaN(scheduledTime.getTime())) {
    return res.status(400).json({ ok: false, message: 'scheduledFor required' });
  }

  const updated = await prisma.marketingCampaign.update({
    where: { id },
    data: {
      status: nextStatus,
      scheduledFor: scheduledTime,
    },
  });

  await logMarketingAudit(tenantId, 'campaign.scheduled', 'MarketingCampaign', updated.id, {
    scheduledFor: scheduledTime.toISOString(),
  });
  res.json({ ok: true, campaign: updated, estimate });
});

router.post('/marketing/campaigns/:id/cancel', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);

  const existing = await prisma.marketingCampaign.findFirst({ where: { id, tenantId } });
  if (!existing) return res.status(404).json({ ok: false, message: 'Campaign not found' });

  const campaign = await prisma.marketingCampaign.update({
    where: { id },
    data: { status: MarketingCampaignStatus.CANCELLED },
  });

  await logMarketingAudit(tenantId, 'campaign.cancelled', 'MarketingCampaign', campaign.id);
  res.json({ ok: true, campaign });
});

router.get('/marketing/campaigns/:id/logs', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);

  const events = await prisma.marketingEmailEvent.findMany({
    where: { tenantId, campaignId: id },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const recipients = await prisma.marketingCampaignRecipient.findMany({
    where: { tenantId, campaignId: id },
    orderBy: { sentAt: 'desc' },
    take: 200,
  });

  res.json({ ok: true, events, recipients });
});

router.get('/marketing/campaigns/:id/recipients', requireAdminOrOrganiser, async (req, res) => {
  const tenantId = tenantIdFrom(req);
  const id = String(req.params.id);

  const items = await prisma.marketingCampaignRecipient.findMany({
    where: { tenantId, campaignId: id },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const summary = {
    total: items.length,
    sent: items.filter((r) => r.status === MarketingRecipientStatus.SENT).length,
    failed: items.filter((r) => r.status === MarketingRecipientStatus.FAILED).length,
    skipped: items.filter((r) => r.status === MarketingRecipientStatus.SKIPPED_SUPPRESSED).length,
  };

  res.json({ ok: true, items, summary });
});

export default router;
