import { Router } from 'express';
import { eq, ne, asc, and, sql } from 'drizzle-orm';
import db from '../db/client.js';
import { sport_groups } from '../db/schema/index.js';
import { requireUser } from '../middleware/auth.js';
import { seedDefaultSportGroups } from '../db/seed.js';

const router = Router();

router.use(requireUser);

const VALID_METRICS = new Set(['sessions', 'distance', 'duration', 'calories', 'avg_hr', 'max_speed']);

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/, '');
}

function parseGroup(row: typeof sport_groups.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    subtitle: row.subtitle,
    color: row.color,
    icon: row.icon,
    sportTypes: row.sport_types,
    metrics: row.metrics,
    chartMetrics: row.chart_metrics,
    sortOrder: row.sort_order,
  };
}

// GET /api/sport-groups
router.get('/', async (req, res) => {
  const userId = req.userId!;
  await seedDefaultSportGroups(userId);
  const rows = await db.select().from(sport_groups)
    .where(eq(sport_groups.user_id, userId))
    .orderBy(asc(sport_groups.sort_order));
  res.json(rows.map(parseGroup));
});

// POST /api/sport-groups
router.post('/', async (req, res) => {
  const { userId } = req;
  const { name, subtitle = '', color = '#6a9cff', icon = '◎', sportTypes, metrics, chartMetrics = [] } = req.body;

  if (!name || typeof name !== 'string') { res.status(400).json({ error: 'name is required' }); return; }
  if (!Array.isArray(sportTypes) || sportTypes.length === 0) { res.status(400).json({ error: 'sportTypes must be a non-empty array' }); return; }
  if (!Array.isArray(metrics) || metrics.length === 0) { res.status(400).json({ error: 'metrics must be a non-empty array' }); return; }
  if (metrics.some((m: string) => !VALID_METRICS.has(m))) { res.status(400).json({ error: 'metrics contains invalid values' }); return; }

  const allGroups = await db.select({ id: sport_groups.id, name: sport_groups.name, sport_types: sport_groups.sport_types })
    .from(sport_groups).where(eq(sport_groups.user_id, userId));
  for (const g of allGroups) {
    const existing = g.sport_types as string[];
    const conflict = (sportTypes as string[]).find((st) => existing.includes(st));
    if (conflict) { res.status(409).json({ error: `Sport "${conflict}" already belongs to group "${g.name}"` }); return; }
  }

  // Use user-prefixed slugs to avoid PK collision between users
  let baseSlug = slugify(name);
  let id = `${userId.slice(0, 8)}_${baseSlug}`;
  let suffix = 2;
  while ((await db.select({ id: sport_groups.id }).from(sport_groups).where(eq(sport_groups.id, id))).length > 0) {
    id = `${userId.slice(0, 8)}_${baseSlug}_${suffix++}`;
  }

  const [{ m }] = await db.select({ m: sql<number>`MAX(${sport_groups.sort_order})` })
    .from(sport_groups).where(eq(sport_groups.user_id, userId));
  const maxOrder = m ?? -1;

  const [created] = await db.insert(sport_groups).values({
    id,
    name,
    subtitle,
    color,
    icon,
    sport_types: sportTypes,
    metrics,
    chart_metrics: chartMetrics,
    sort_order: Number(maxOrder) + 1,
    created_at: new Date().toISOString(),
    user_id: userId,
  }).returning();

  res.status(201).json(parseGroup(created));
});

// PUT /api/sport-groups/reorder — must go BEFORE /:id
router.put('/reorder', async (req, res) => {
  const { userId } = req;
  const { order } = req.body;
  if (!Array.isArray(order)) { res.status(400).json({ error: 'order must be an array of ids' }); return; }

  await db.transaction(async (tx) => {
    for (let i = 0; i < order.length; i++) {
      await tx.update(sport_groups).set({ sort_order: i })
        .where(and(eq(sport_groups.id, order[i]), eq(sport_groups.user_id, userId)));
    }
  });
  res.json({ ok: true });
});

// PUT /api/sport-groups/:id
router.put('/:id', async (req, res) => {
  const { userId } = req;
  const { id } = req.params;
  const [existing] = await db.select().from(sport_groups)
    .where(and(eq(sport_groups.id, id), eq(sport_groups.user_id, userId)));
  if (!existing) { res.status(404).json({ error: 'Group not found' }); return; }

  const { name, subtitle, color, icon, sportTypes, metrics, chartMetrics } = req.body;

  if (metrics && metrics.some((m: string) => !VALID_METRICS.has(m))) {
    res.status(400).json({ error: 'metrics contains invalid values' }); return;
  }

  const newSportTypes: string[] = sportTypes ?? (existing.sport_types as string[]);

  const otherGroups = await db.select({ id: sport_groups.id, name: sport_groups.name, sport_types: sport_groups.sport_types })
    .from(sport_groups).where(and(ne(sport_groups.id, id), eq(sport_groups.user_id, userId)));
  for (const g of otherGroups) {
    const existingTypes = g.sport_types as string[];
    const conflict = newSportTypes.find((st) => existingTypes.includes(st));
    if (conflict) { res.status(409).json({ error: `Sport "${conflict}" already belongs to group "${g.name}"` }); return; }
  }

  await db.update(sport_groups).set({
    name: name ?? existing.name,
    subtitle: subtitle ?? existing.subtitle,
    color: color ?? existing.color,
    icon: icon ?? existing.icon,
    sport_types: newSportTypes,
    metrics: metrics ?? existing.metrics,
    chart_metrics: chartMetrics ?? existing.chart_metrics,
  }).where(and(eq(sport_groups.id, id), eq(sport_groups.user_id, userId)));

  const [updated] = await db.select().from(sport_groups)
    .where(and(eq(sport_groups.id, id), eq(sport_groups.user_id, userId)));
  res.json(parseGroup(updated));
});

// DELETE /api/sport-groups/:id
router.delete('/:id', async (req, res) => {
  const { userId } = req;
  const { id } = req.params;
  const [existing] = await db.select({ id: sport_groups.id }).from(sport_groups)
    .where(and(eq(sport_groups.id, id), eq(sport_groups.user_id, userId)));
  if (!existing) { res.status(404).json({ error: 'Group not found' }); return; }

  await db.delete(sport_groups).where(and(eq(sport_groups.id, id), eq(sport_groups.user_id, userId)));
  res.json({ ok: true });
});

export default router;
