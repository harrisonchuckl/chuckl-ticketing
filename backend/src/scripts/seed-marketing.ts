import prisma from '../lib/prisma.js';

async function main() {
  const tenant = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
  });

  if (!tenant) {
    console.error('No tenants found to seed marketing data.');
    return;
  }

  const template = await prisma.marketingTemplate.create({
    data: {
      tenantId: tenant.id,
      name: 'Welcome offer',
      subject: 'A special offer just for you',
      fromName: tenant.name || 'TIXL',
      fromEmail: process.env.FROM_EMAIL || 'marketing@example.com',
      mjmlBody: '<mjml><mj-body><mj-section><mj-column><mj-text>Hello {{firstName}},</mj-text><mj-text>Thanks for supporting {{tenantName}}.</mj-text><mj-text><a href="{{unsubscribeUrl}}">Unsubscribe</a></mj-text></mj-column></mj-section></mj-body></mjml>',
    },
  });

  const segment = await prisma.marketingSegment.create({
    data: {
      tenantId: tenant.id,
      name: 'All marketing subscribers',
      rules: { rules: [] },
    },
  });

  const campaign = await prisma.marketingCampaign.create({
    data: {
      tenantId: tenant.id,
      name: 'Launch campaign',
      templateId: template.id,
      segmentId: segment.id,
      status: 'DRAFT',
      createdByUserId: tenant.id,
    },
  });

  console.log('Seeded marketing data', { templateId: template.id, segmentId: segment.id, campaignId: campaign.id });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
