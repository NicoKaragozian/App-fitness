import { Router } from 'express';
import db from '../db.js';

const router = Router();

function getDateRange(period: string): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  const start = new Date(now);

  switch (period) {
    case 'daily':
      start.setDate(start.getDate() - 1);
      break;
    case 'weekly':
      start.setDate(start.getDate() - 7);
      break;
    case 'monthly':
      start.setMonth(start.getMonth() - 1);
      break;
    default:
      start.setDate(start.getDate() - 7);
  }

  return { start: start.toISOString().split('T')[0], end };
}

// Normalize sport_type the same way sync.ts does (strip _v2 suffixes etc.)
function normalizeSportType(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, '_').replace(/_v\d+$/, '');
}

const round = (n: number) => Math.round(n * 10) / 10;

// GET /api/activities/sport-types
router.get('/sport-types', (_req, res) => {
  const rows = db.prepare('SELECT DISTINCT sport_type FROM activities ORDER BY sport_type').all() as any[];
  res.json(rows.map((r) => normalizeSportType(r.sport_type)));
});

router.get('/', (req, res) => {
  const period = (req.query.period as string) || 'weekly';
  const { start, end } = getDateRange(period);

  // Load sport groups
  const groupRows = db.prepare('SELECT * FROM sport_groups ORDER BY sort_order ASC').all() as any[];
  const groups = groupRows.map((g) => ({
    id: g.id,
    name: g.name,
    subtitle: g.subtitle,
    color: g.color,
    icon: g.icon,
    metrics: JSON.parse(g.metrics) as string[],
    chartMetrics: JSON.parse(g.chart_metrics) as { dataKey: string; name: string; type: 'bar' | 'line' }[],
    sportTypes: JSON.parse(g.sport_types) as string[],
    sortOrder: g.sort_order,
  }));

  // Build sport_type → group_id map
  const sportTypeToGroup: Record<string, string> = {};
  for (const g of groups) {
    for (const st of g.sportTypes) {
      sportTypeToGroup[st] = g.id;
    }
  }

  // Activities for selected period
  const rows = db.prepare(
    `SELECT * FROM activities WHERE date(start_time) >= ? AND date(start_time) <= ? ORDER BY start_time DESC`
  ).all(start, end) as any[];

  // Aggregate per group
  const groupData: Record<string, { sessions: number; distance: number; duration: number; calories: number; avg_hr_sum: number; avg_hr_count: number; max_speed: number }> = {};
  for (const g of groups) {
    groupData[g.id] = { sessions: 0, distance: 0, duration: 0, calories: 0, avg_hr_sum: 0, avg_hr_count: 0, max_speed: 0 };
  }

  const others: Record<string, { name: string; sessions: number; distance: number; duration: number }> = {};

  for (const row of rows) {
    const normalized = normalizeSportType(row.sport_type);
    const groupId = sportTypeToGroup[normalized];
    if (groupId && groupData[groupId]) {
      const d = groupData[groupId];
      d.sessions++;
      d.distance += (row.distance ?? 0) / 1000;
      d.duration += (row.duration ?? 0) / 60;
      d.calories += row.calories ?? 0;
      if (row.avg_hr) { d.avg_hr_sum += row.avg_hr; d.avg_hr_count++; }
      if ((row.max_speed ?? 0) * 3.6 > d.max_speed) d.max_speed = (row.max_speed ?? 0) * 3.6;
    } else {
      const name = normalized || 'other';
      if (!others[name]) others[name] = { name, sessions: 0, distance: 0, duration: 0 };
      others[name].sessions++;
      others[name].distance += (row.distance ?? 0) / 1000;
      others[name].duration += (row.duration ?? 0) / 60;
    }
  }

  // Build groups response
  const groupsResponse = groups.map((g) => {
    const d = groupData[g.id];
    const data: Record<string, number> = {
      sessions: d.sessions,
      distance: round(d.distance),
      duration: Math.round(d.duration),
      calories: d.calories,
      avg_hr: d.avg_hr_count > 0 ? Math.round(d.avg_hr_sum / d.avg_hr_count) : 0,
      max_speed: Math.round(d.max_speed),
    };
    return {
      id: g.id,
      name: g.name,
      subtitle: g.subtitle,
      color: g.color,
      icon: g.icon,
      metrics: g.metrics,
      chartMetrics: g.chartMetrics,
      sortOrder: g.sortOrder,
      data,
    };
  });

  // Volume history (last 6 months) — kept for compatibility
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

  const volumeRows = db.prepare(
    `SELECT * FROM activities WHERE date(start_time) >= ? ORDER BY start_time`
  ).all(sixMonthsAgoStr) as any[];

  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const volumeByMonth: Record<string, Record<string, number>> = {};

  for (const row of volumeRows) {
    const d = new Date(row.start_time);
    const key = monthNames[d.getMonth()];
    if (!volumeByMonth[key]) {
      const init: Record<string, number> = {};
      for (const g of groups) init[g.id] = 0;
      volumeByMonth[key] = init;
    }
    const normalized = normalizeSportType(row.sport_type);
    const groupId = sportTypeToGroup[normalized];
    if (groupId) {
      volumeByMonth[key][groupId] = (volumeByMonth[key][groupId] ?? 0) + Math.round((row.duration ?? 0) / 60);
    }
  }
  const volumeHistory = Object.entries(volumeByMonth).map(([month, data]) => ({ month, ...data }));

  // Chart data per group (per-session, last 6 months)
  const chartData: Record<string, any[]> = {};
  for (const g of groups) chartData[g.id] = [];

  for (const row of volumeRows) {
    const normalized = normalizeSportType(row.sport_type);
    const groupId = sportTypeToGroup[normalized];
    if (!groupId) continue;
    chartData[groupId].push({
      date: row.start_time.split('T')[0],
      distance: round((row.distance ?? 0) / 1000),
      maxSpeed: row.max_speed ? Math.round(row.max_speed * 3.6) : 0,
      duration: Math.round((row.duration ?? 0) / 60),
      avgHr: row.avg_hr ?? 0,
      calories: row.calories ?? 0,
    });
  }

  // Recent sessions
  const recentSessions = rows.slice(0, 3).map((r: any) => ({
    sport: (r.sport_type ?? 'unknown').toUpperCase().replace(/_V\d+/g, '').replace(/_/g, ' '),
    date: r.start_time.split('T')[0],
    duration: Math.round((r.duration ?? 0) / 60),
    distance: round((r.distance ?? 0) / 1000),
    hr: r.avg_hr ?? 0,
    calories: r.calories ?? 0,
  }));

  // Training readiness composite score
  const sleepForReadiness = db.prepare(
    `SELECT score FROM sleep WHERE score IS NOT NULL ORDER BY date DESC LIMIT 1`
  ).get() as any;
  const stressForReadiness = db.prepare(
    `SELECT avg_stress FROM stress WHERE avg_stress IS NOT NULL ORDER BY date DESC LIMIT 1`
  ).get() as any;
  const hrvForReadiness = db.prepare(
    `SELECT nightly_avg FROM hrv WHERE nightly_avg IS NOT NULL ORDER BY date DESC LIMIT 1`
  ).get() as any;

  const slp = sleepForReadiness?.score ?? 0;
  const stress = stressForReadiness?.avg_stress ?? 0;
  const stressInv = stress > 0 ? 100 - stress : 0;
  const hrv = hrvForReadiness?.nightly_avg ?? 0;
  let hrvScore = 0;
  if (hrv > 0) {
    if (hrv >= 99) hrvScore = 100;
    else if (hrv <= 20) hrvScore = 10;
    else if (hrv <= 38) hrvScore = Math.round(10 + ((hrv - 20) / 18) * 35);
    else hrvScore = Math.round(45 + ((hrv - 38) / 61) * 55);
  }
  const weights = (slp > 0 ? 0.4 : 0) + (stress > 0 ? 0.3 : 0) + (hrv > 0 ? 0.3 : 0);
  const trainingReadiness = weights > 0
    ? Math.round((slp * (slp > 0 ? 0.4 : 0) + stressInv * (stress > 0 ? 0.3 : 0) + hrvScore * (hrv > 0 ? 0.3 : 0)) / weights)
    : null;

  res.json({
    groups: groupsResponse,
    others: Object.values(others).map((o) => ({
      name: o.name.charAt(0).toUpperCase() + o.name.slice(1).replace(/_/g, ' '),
      sessions: o.sessions,
      distance: round(o.distance) || undefined,
      duration: Math.round(o.duration) || undefined,
    })),
    volumeHistory,
    chartData,
    recentSessions,
    trainingReadiness,
  });
});

router.get('/category/:category', (req, res) => {
  const { category } = req.params;

  // Look up group by id in sport_groups
  const groupRow = db.prepare('SELECT * FROM sport_groups WHERE id = ?').get(category) as any;
  if (!groupRow) {
    return res.status(404).json({ error: 'Grupo no encontrado' });
  }

  const sportTypes: string[] = JSON.parse(groupRow.sport_types);

  // Match by normalized sport_type
  const allRows = db.prepare(`SELECT * FROM activities ORDER BY start_time DESC`).all() as any[];
  const rows = allRows.filter((r) => sportTypes.includes(normalizeSportType(r.sport_type)));

  const activities = rows.map((r) => ({
    id: r.garmin_id,
    date: r.start_time.split('T')[0],
    sportType: r.sport_type,
    duration: Math.round((r.duration ?? 0) / 60),
    distance: round((r.distance ?? 0) / 1000),
    maxSpeed: r.max_speed ? Math.round(r.max_speed * 3.6) : null,
    avgHr: r.avg_hr ?? null,
    calories: r.calories ?? null,
  }));

  const totalSessions = activities.length;
  const totalDuration = activities.reduce((s, a) => s + a.duration, 0);
  const totalCalories = activities.reduce((s, a) => s + (a.calories ?? 0), 0);
  const totalDistance = round(activities.reduce((s, a) => s + a.distance, 0));
  const avgDuration = totalSessions ? Math.round(totalDuration / totalSessions) : 0;
  const hrActivities = activities.filter((a) => a.avgHr);
  const avgHr = hrActivities.length
    ? Math.round(hrActivities.reduce((s, a) => s + (a.avgHr ?? 0), 0) / hrActivities.length)
    : null;

  const hasDistance = activities.some((a) => a.distance > 0);
  const hasSpeed = activities.some((a) => a.maxSpeed != null);

  const longestSession = activities.reduce<typeof activities[0] | null>(
    (best, a) => a.duration > (best?.duration ?? 0) ? a : best, null
  );
  const longestDistance = hasDistance
    ? activities.reduce<typeof activities[0] | null>(
        (best, a) => a.distance > (best?.distance ?? 0) ? a : best, null
      )
    : null;
  const highestSpeed = hasSpeed
    ? activities.reduce<typeof activities[0] | null>(
        (best, a) => (a.maxSpeed ?? 0) > (best?.maxSpeed ?? 0) ? a : best, null
      )
    : null;
  const mostCalories = activities.reduce<typeof activities[0] | null>(
    (best, a) => (a.calories ?? 0) > (best?.calories ?? 0) ? a : best, null
  );

  res.json({
    group: {
      id: groupRow.id,
      name: groupRow.name,
      subtitle: groupRow.subtitle,
      color: groupRow.color,
      icon: groupRow.icon,
      metrics: JSON.parse(groupRow.metrics),
      chartMetrics: JSON.parse(groupRow.chart_metrics),
    },
    activities,
    stats: {
      totalSessions,
      totalDistance: hasDistance ? totalDistance : undefined,
      totalDuration,
      totalCalories,
      avgDuration,
      avgHr: !hasDistance ? avgHr : undefined,
    },
    personalBests: {
      longestSession: longestSession ? { date: longestSession.date, value: longestSession.duration, unit: 'min' } : null,
      longestDistance: longestDistance ? { date: longestDistance.date, value: longestDistance.distance, unit: 'km' } : null,
      highestSpeed: highestSpeed ? { date: highestSpeed.date, value: highestSpeed.maxSpeed, unit: 'km/h' } : null,
      mostCalories: mostCalories ? { date: mostCalories.date, value: mostCalories.calories, unit: 'kcal' } : null,
    },
  });
});

export default router;
