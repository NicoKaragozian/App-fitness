import db from './client.js';
import { sport_groups } from './schema/index.js';
import { eq, sql } from 'drizzle-orm';

const DEFAULT_SPORT_GROUPS = [
  {
    name: 'WATER SPORTS',
    subtitle: 'WINGFOIL / SURF',
    color: '#6a9cff',
    icon: '◎',
    sport_types: ['surfing', 'kitesurfing', 'kiteboarding', 'windsurfing', 'stand_up_paddleboarding', 'sailing', 'kayaking'],
    metrics: ['sessions', 'distance', 'duration', 'calories'],
    chart_metrics: [
      { dataKey: 'distance', name: 'DISTANCE KM', type: 'bar' },
      { dataKey: 'maxSpeed', name: 'MAX SPEED KM/H', type: 'line' },
    ],
    sort_order: 0,
  },
  {
    name: 'TENNIS',
    subtitle: 'MATCH / TRAINING',
    color: '#f3ffca',
    icon: '◈',
    sport_types: ['tennis'],
    metrics: ['sessions', 'duration', 'calories'],
    chart_metrics: [
      { dataKey: 'duration', name: 'DURATION MIN', type: 'bar' },
      { dataKey: 'avgHr', name: 'AVG HR BPM', type: 'line' },
    ],
    sort_order: 1,
  },
  {
    name: 'GYM / STRENGTH',
    subtitle: 'STRENGTH / POWER',
    color: '#ff7439',
    icon: '⚡',
    sport_types: ['strength_training', 'gym', 'indoor_cardio'],
    metrics: ['sessions', 'duration', 'calories'],
    chart_metrics: [
      { dataKey: 'calories', name: 'CALORIES KCAL', type: 'bar' },
    ],
    sort_order: 2,
  },
];

export async function seedDefaultSportGroups(userId: string): Promise<void> {
  const [{ count }] = await db.select({ count: sql<number>`COUNT(*)` })
    .from(sport_groups).where(eq(sport_groups.user_id, userId));

  if (Number(count) > 0) return;

  const prefix = userId.slice(0, 8);
  const slugs = ['water_sports', 'tennis', 'gym'];

  await db.insert(sport_groups).values(
    DEFAULT_SPORT_GROUPS.map((g, i) => ({
      id: `${prefix}_${slugs[i]}`,
      user_id: userId,
      ...g,
      created_at: new Date().toISOString(),
    }))
  );

  console.log(`[seed] Default sport groups seeded for user ${userId.slice(0, 8)}`);
}

// Run as script: npx tsx server/src/db/seed.ts --userId=<userId>
const isMain = process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js');
if (isMain) {
  import('dotenv/config').then(async () => {
    const userIdArg = process.argv.find(a => a.startsWith('--userId='))?.split('=')[1];
    if (!userIdArg) {
      console.error('Usage: npx tsx src/db/seed.ts --userId=<userId>');
      process.exit(1);
    }
    await seedDefaultSportGroups(userIdArg);
    console.log('[seed] Done.');
    process.exit(0);
  }).catch((err) => { console.error(err); process.exit(1); });
}
