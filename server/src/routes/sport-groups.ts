import { Router } from 'express';
import db from '../db.js';

const router = Router();

const VALID_METRICS = new Set(['sessions', 'distance', 'duration', 'calories', 'avg_hr', 'max_speed']);

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/, '');
}

function parseGroup(row: any) {
  return {
    id: row.id,
    name: row.name,
    subtitle: row.subtitle,
    color: row.color,
    icon: row.icon,
    sportTypes: JSON.parse(row.sport_types),
    metrics: JSON.parse(row.metrics),
    chartMetrics: JSON.parse(row.chart_metrics),
    sortOrder: row.sort_order,
  };
}

// GET /api/sport-groups
router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM sport_groups ORDER BY sort_order ASC').all();
  res.json(rows.map(parseGroup));
});

// POST /api/sport-groups
router.post('/', (req, res) => {
  const { name, subtitle = '', color = '#6a9cff', icon = '◎', sportTypes, metrics, chartMetrics = [] } = req.body;

  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name is required' });
  if (!Array.isArray(sportTypes) || sportTypes.length === 0) return res.status(400).json({ error: 'sportTypes must be a non-empty array' });
  if (!Array.isArray(metrics) || metrics.length === 0) return res.status(400).json({ error: 'metrics must be a non-empty array' });
  if (metrics.some((m: string) => !VALID_METRICS.has(m))) return res.status(400).json({ error: 'metrics contains invalid values' });

  // Check for sport_type conflicts
  const allGroups = db.prepare('SELECT id, name, sport_types FROM sport_groups').all() as any[];
  for (const g of allGroups) {
    const existing: string[] = JSON.parse(g.sport_types);
    const conflict = (sportTypes as string[]).find((st) => existing.includes(st));
    if (conflict) return res.status(409).json({ error: `Sport "${conflict}" already belongs to group "${g.name}"` });
  }

  // Generate unique slug
  let id = slugify(name);
  let suffix = 2;
  while (db.prepare('SELECT id FROM sport_groups WHERE id = ?').get(id)) {
    id = `${slugify(name)}_${suffix++}`;
  }

  const maxOrder = (db.prepare('SELECT MAX(sort_order) as m FROM sport_groups').get() as any).m ?? -1;

  db.prepare(
    'INSERT INTO sport_groups (id, name, subtitle, color, icon, sport_types, metrics, chart_metrics, sort_order) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(id, name, subtitle, color, icon, JSON.stringify(sportTypes), JSON.stringify(metrics), JSON.stringify(chartMetrics), maxOrder + 1);

  const created = db.prepare('SELECT * FROM sport_groups WHERE id = ?').get(id) as any;
  res.status(201).json(parseGroup(created));
});

// PUT /api/sport-groups/reorder — must go BEFORE /:id
router.put('/reorder', (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of ids' });

  const update = db.prepare('UPDATE sport_groups SET sort_order = ? WHERE id = ?');
  const tx = db.transaction(() => {
    order.forEach((id: string, i: number) => update.run(i, id));
  });
  tx();
  res.json({ ok: true });
});

// PUT /api/sport-groups/:id
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM sport_groups WHERE id = ?').get(id) as any;
  if (!existing) return res.status(404).json({ error: 'Group not found' });

  const { name, subtitle, color, icon, sportTypes, metrics, chartMetrics } = req.body;

  if (metrics && metrics.some((m: string) => !VALID_METRICS.has(m))) {
    return res.status(400).json({ error: 'metrics contains invalid values' });
  }

  const newSportTypes: string[] = sportTypes ?? JSON.parse(existing.sport_types);

  // Check for sport_type conflicts (exclude self)
  const otherGroups = db.prepare('SELECT id, name, sport_types FROM sport_groups WHERE id != ?').all(id) as any[];
  for (const g of otherGroups) {
    const existingTypes: string[] = JSON.parse(g.sport_types);
    const conflict = newSportTypes.find((st) => existingTypes.includes(st));
    if (conflict) return res.status(409).json({ error: `Sport "${conflict}" already belongs to group "${g.name}"` });
  }

  db.prepare(
    'UPDATE sport_groups SET name=?, subtitle=?, color=?, icon=?, sport_types=?, metrics=?, chart_metrics=? WHERE id=?'
  ).run(
    name ?? existing.name,
    subtitle ?? existing.subtitle,
    color ?? existing.color,
    icon ?? existing.icon,
    JSON.stringify(newSportTypes),
    JSON.stringify(metrics ?? JSON.parse(existing.metrics)),
    JSON.stringify(chartMetrics ?? JSON.parse(existing.chart_metrics)),
    id
  );

  const updated = db.prepare('SELECT * FROM sport_groups WHERE id = ?').get(id) as any;
  res.json(parseGroup(updated));
});

// DELETE /api/sport-groups/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT id FROM sport_groups WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Group not found' });

  db.prepare('DELETE FROM sport_groups WHERE id = ?').run(id);
  res.json({ ok: true });
});

export default router;
