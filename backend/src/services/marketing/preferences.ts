import prisma from '../../lib/prisma.js';

const DEFAULT_TOPICS: Array<{ name: string; description: string }> = [
  { name: 'Comedy', description: 'Stand-up, improv, and comedy nights.' },
  { name: 'Music', description: 'Live gigs, concerts, and music showcases.' },
  { name: 'Family', description: 'Family-friendly shows and experiences.' },
  { name: 'Theatre', description: 'Plays, drama, and stage productions.' },
  { name: 'Dance', description: 'Dance performances and showcases.' },
  { name: 'Festivals', description: 'Festivals and special events.' },
];

export async function ensureDefaultPreferenceTopics(tenantId: string) {
  await prisma.marketingPreferenceTopic.createMany({
    data: DEFAULT_TOPICS.map((topic) => ({
      tenantId,
      name: topic.name,
      description: topic.description,
      isDefault: true,
    })),
    skipDuplicates: true,
  });
}
