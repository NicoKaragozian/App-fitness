import { Router } from 'express';
import { eq, desc, asc, and, gte, lte, sql } from 'drizzle-orm';
import db from '../db/client.js';
import { activities, sport_groups, sleep, stress, hrv } from '../db/schema/index.js';

const router = Router();

function getDateRange(period: string): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  const start = new Date(now);

  switch (period) {
    case 'daily':  start.setDate(start.getDate() - 1); break;
    case 'weekly': start.setDate(start.getDate() - 7); break;
    case 'monthly': start.setMonth(start.getMonth() - 1); break;
    default: start.setDate(start.getDate() - 7);
  }

  return { start: start.toISOString().split('T')[0], end };
}

function normalizeSportType(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, '_').replace(/_v\d+$/, '');
}

const round = (n: number) => Math.round(n * 10) / 10;

// GET /api/activities/sport-types
router.get('/sport-types', async (_req, res) => {
  const rows = await db.selectDistinct({ sport_type: activities.sport_type })
    .from(activities)
    .orderBy(asc(activities.sport_type));
  res.json(rows.map((r) => normalizeSportType(r.sport_type)));
});

router.get('/', async (req, res) => {
  const period = (req.query.period as string) || 'weekly';

  const groupRows = await db.select().from(sport_groups).orderBy(asc(sport_groups.sort_order));
  const groups = groupRows.map((g) => ({
    id: g.id,
    name: g.name,
    subtitle: g.subtitle,
    color: g.color,
    icon: g.icon,
    metrics: g.metrics as string[],
    chartMetrics: g.chart_metrics as { dataKey: string; name: string; type: 'bar' | 'line' }[],
    sportTypes: g.sport_types as string[],
    sortOrder: g.sort_order,
  }));

  const sportTypeToGroup: Record<string, string> = {};
  for (const g of groups) {
    for (const st of g.sportTypes) {
      sportTypeToGroup[st] = g.id;
    }
  }

  let rows: (typeof activities.$inferSelect)[];
  if (period === 'total') {
    rows = await db.select().from(activities).orderBy(desc(activities.start_time));
  } else {
    const { start, end } = getDateRange(period);
    rows = await db.select().from(activities)
      .where(and(
        gte(sql`LEFT(${activities.start_time}, 10)`, start),
        lte(sql`LEFT(${activities.start_time}, 10)`, end),
      ))
      .orderBy(desc(activities.start_time));
  }

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
    return { id: g.id, name: g.name, subtitle: g.subtitle, color: g.color, icon: g.icon, metrics: g.metrics, chartMetrics: g.chartMetrics, sortOrder: g.sortOrder, data };
  });

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

  const volumeRows = await db.select().from(activities)
    .where(gte(sql`LEFT(${activities.start_time}, 10)`, sixMonthsAgoStr))
    .orderBy(asc(activities.start_time));

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

  const chartData: Record<string, any[]> = {};
  for (const g of groups) chartData[g.id] = [];

  for (const row of volumeRows) {
    const normalized = normalizeSportType(row.sport_type);
    const groupId = sportTypeToGroup[normalized];
    if (!groupId) continue;
    chartData[groupId].push({
      id: row.garmin_id,
      date: row.start_time.slice(0, 10),
      distance: round((row.distance ?? 0) / 1000),
      maxSpeed: row.max_speed ? Math.round(row.max_speed * 3.6) : 0,
      duration: Math.round((row.duration ?? 0) / 60),
      avgHr: row.avg_hr ?? 0,
      calories: row.calories ?? 0,
    });
  }

  const recentSessions = rows.slice(0, 3).map((r) => ({
    sport: (r.sport_type ?? 'unknown').toUpperCase().replace(/_V\d+/g, '').replace(/_/g, ' '),
    date: r.start_time.split('T')[0],
    duration: Math.round((r.duration ?? 0) / 60),
    distance: round((r.distance ?? 0) / 1000),
    hr: r.avg_hr ?? 0,
    calories: r.calories ?? 0,
  }));

  const [sleepForReadiness] = await db.select({ score: sleep.score })
    .from(sleep).where(sql`${sleep.score} IS NOT NULL`).orderBy(desc(sleep.date)).limit(1);
  const [stressForReadiness] = await db.select({ avg_stress: stress.avg_stress })
    .from(stress).where(sql`${stress.avg_stress} IS NOT NULL`).orderBy(desc(stress.date)).limit(1);
  const [hrvForReadiness] = await db.select({ nightly_avg: hrv.nightly_avg })
    .from(hrv).where(sql`${hrv.nightly_avg} IS NOT NULL`).orderBy(desc(hrv.date)).limit(1);

  const slp = sleepForReadiness?.score ?? 0;
  const stressVal = stressForReadiness?.avg_stress ?? 0;
  const stressInv = stressVal > 0 ? 100 - stressVal : 0;
  const hrvVal = hrvForReadiness?.nightly_avg ?? 0;
  let hrvScore = 0;
  if (hrvVal > 0) {
    if (hrvVal >= 99) hrvScore = 100;
    else if (hrvVal <= 20) hrvScore = 10;
    else if (hrvVal <= 38) hrvScore = Math.round(10 + ((hrvVal - 20) / 18) * 35);
    else hrvScore = Math.round(45 + ((hrvVal - 38) / 61) * 55);
  }
  const weights = (slp > 0 ? 0.4 : 0) + (stressVal > 0 ? 0.3 : 0) + (hrvVal > 0 ? 0.3 : 0);
  const trainingReadiness = weights > 0
    ? Math.round((slp * (slp > 0 ? 0.4 : 0) + stressInv * (stressVal > 0 ? 0.3 : 0) + hrvScore * (hrvVal > 0 ? 0.3 : 0)) / weights)
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

router.get('/category/:category', async (req, res) => {
  const { category } = req.params;
  const period = (req.query.period as string) || 'total';

  const [groupRow] = await db.select().from(sport_groups).where(eq(sport_groups.id, category));
  if (!groupRow) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }

  const sportTypes = groupRow.sport_types as string[];

  const allRows = await db.select().from(activities).orderBy(desc(activities.start_time));
  const allGroupRows = allRows.filter((r) => sportTypes.includes(normalizeSportType(r.sport_type)));

  let filteredRows = allGroupRows;
  if (period !== 'total') {
    const { start, end } = getDateRange(period);
    filteredRows = allGroupRows.filter((r) => {
      const d = r.start_time.split('T')[0];
      return d >= start && d <= end;
    });
  }

  const mapActivity = (r: typeof activities.$inferSelect) => ({
    id: r.garmin_id,
    date: r.start_time.split('T')[0],
    sportType: r.sport_type,
    duration: Math.round((r.duration ?? 0) / 60),
    distance: round((r.distance ?? 0) / 1000),
    maxSpeed: r.max_speed ? Math.round(r.max_speed * 3.6) : null,
    avgHr: r.avg_hr ?? null,
    calories: r.calories ?? null,
  });

  const activityList = filteredRows.map(mapActivity);
  const allActivities = allGroupRows.map(mapActivity);

  const totalSessions = activityList.length;
  const totalDuration = activityList.reduce((s, a) => s + a.duration, 0);
  const totalCalories = activityList.reduce((s, a) => s + (a.calories ?? 0), 0);
  const totalDistance = round(activityList.reduce((s, a) => s + a.distance, 0));
  const avgDuration = totalSessions ? Math.round(totalDuration / totalSessions) : 0;
  const hrActivities = activityList.filter((a) => a.avgHr);
  const avgHr = hrActivities.length
    ? Math.round(hrActivities.reduce((s, a) => s + (a.avgHr ?? 0), 0) / hrActivities.length)
    : null;

  const hasDistance = allActivities.some((a) => a.distance > 0);
  const hasSpeed = allActivities.some((a) => a.maxSpeed != null);

  const longestSession = allActivities.reduce<typeof allActivities[0] | null>(
    (best, a) => a.duration > (best?.duration ?? 0) ? a : best, null
  );
  const longestDistance = hasDistance
    ? allActivities.reduce<typeof allActivities[0] | null>(
        (best, a) => a.distance > (best?.distance ?? 0) ? a : best, null
      )
    : null;
  const highestSpeed = hasSpeed
    ? allActivities.reduce<typeof allActivities[0] | null>(
        (best, a) => (a.maxSpeed ?? 0) > (best?.maxSpeed ?? 0) ? a : best, null
      )
    : null;
  const mostCalories = allActivities.reduce<typeof allActivities[0] | null>(
    (best, a) => (a.calories ?? 0) > (best?.calories ?? 0) ? a : best, null
  );

  res.json({
    group: {
      id: groupRow.id,
      name: groupRow.name,
      subtitle: groupRow.subtitle,
      color: groupRow.color,
      icon: groupRow.icon,
      metrics: groupRow.metrics,
      chartMetrics: groupRow.chart_metrics,
    },
    activities: activityList,
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

// GET /api/activities/:id — full session detail from raw_json
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const [row] = await db.select().from(activities).where(eq(activities.garmin_id, id));
  if (!row) { res.status(404).json({ error: 'Activity not found' }); return; }

  const raw = JSON.parse(row.raw_json ?? '{}');

  const hrZones = [1, 2, 3, 4, 5].map((z) => ({
    zone: z,
    seconds: Math.round(raw[`hrTimeInZone_${z}`] ?? 0),
  }));
  const totalZoneSeconds = hrZones.reduce((s, z) => s + z.seconds, 0);

  const mapUrl = (raw.startLatitude && raw.startLongitude)
    ? `https://maps.google.com/?q=${raw.startLatitude},${raw.startLongitude}`
    : null;

  res.json({
    id: row.garmin_id,
    name: raw.activityName ?? 'Activity',
    sportType: row.sport_type,
    date: row.start_time.split('T')[0],
    startTime: row.start_time,
    locationName: raw.locationName ?? null,
    startLat: raw.startLatitude ?? null,
    startLon: raw.startLongitude ?? null,
    hasPolyline: raw.hasPolyline ?? false,
    duration: Math.round((row.duration ?? 0) / 60),
    distance: round((row.distance ?? 0) / 1000),
    avgSpeed: raw.averageSpeed ? round(raw.averageSpeed * 3.6) : null,
    maxSpeed: row.max_speed ? Math.round(row.max_speed * 3.6) : null,
    calories: row.calories ?? null,
    avgHr: row.avg_hr ?? null,
    maxHr: raw.maxHR ?? null,
    aerobicEffect: raw.aerobicTrainingEffect ? round(raw.aerobicTrainingEffect) : null,
    anaerobicEffect: raw.anaerobicTrainingEffect ? round(raw.anaerobicTrainingEffect) : null,
    trainingEffectLabel: raw.trainingEffectLabel ?? null,
    trainingLoad: raw.activityTrainingLoad ? Math.round(raw.activityTrainingLoad) : null,
    differenceBodyBattery: raw.differenceBodyBattery ?? null,
    hrZones: hrZones.map((z) => ({
      ...z,
      pct: totalZoneSeconds > 0 ? Math.round((z.seconds / totalZoneSeconds) * 100) : 0,
    })),
    lapCount: raw.lapCount ?? null,
    garminUrl: `https://connect.garmin.com/modern/activity/${row.garmin_id}`,
    mapUrl,
  });
});

export default router;
