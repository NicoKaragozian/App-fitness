import 'dotenv/config';
import db from './client.js';
import { sport_groups } from './schema/index.js';
import { sql } from 'drizzle-orm';

async function seed() {
  const [{ count }] = await db.select({ count: sql<number>`COUNT(*)` }).from(sport_groups);

  if (Number(count) > 0) {
    console.log('[seed] sport_groups already populated, skipping.');
    return;
  }

  await db.insert(sport_groups).values([
    {
      id: 'water_sports',
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
      created_at: new Date().toISOString(),
    },
    {
      id: 'tennis',
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
      created_at: new Date().toISOString(),
    },
    {
      id: 'gym',
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
      created_at: new Date().toISOString(),
    },
  ]);

  console.log('[seed] sport_groups seeded successfully.');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
