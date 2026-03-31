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

function aggregateByCategory(rows: any[], period: string) {
  const categories: Record<string, { sessions: number; distance: number; duration: number; calories: number; volume: number }> = {
    water_sports: { sessions: 0, distance: 0, duration: 0, calories: 0, volume: 0 },
    tennis: { sessions: 0, distance: 0, duration: 0, calories: 0, volume: 0 },
    gym: { sessions: 0, distance: 0, duration: 0, calories: 0, volume: 0 },
  };

  const others: Record<string, { name: string; sessions: number; distance: number; duration: number }> = {};

  for (const row of rows) {
    const cat = row.category;
    if (categories[cat]) {
      categories[cat].sessions++;
      categories[cat].distance += (row.distance ?? 0) / 1000; // m to km
      categories[cat].duration += (row.duration ?? 0) / 60; // s to min
      categories[cat].calories += row.calories ?? 0;
    } else {
      const name = row.sport_type ?? 'other';
      if (!others[name]) others[name] = { name, sessions: 0, distance: 0, duration: 0 };
      others[name].sessions++;
      others[name].distance += (row.distance ?? 0) / 1000;
      others[name].duration += (row.duration ?? 0) / 60;
    }
  }

  const round = (n: number) => Math.round(n * 10) / 10;

  return {
    sports: {
      waterSports: {
        daily: period === 'daily' ? { sessions: categories.water_sports.sessions, distance: round(categories.water_sports.distance), duration: Math.round(categories.water_sports.duration), calories: categories.water_sports.calories } : {},
        weekly: period === 'weekly' ? { sessions: categories.water_sports.sessions, distance: round(categories.water_sports.distance), duration: Math.round(categories.water_sports.duration), calories: categories.water_sports.calories } : {},
        monthly: period === 'monthly' ? { sessions: categories.water_sports.sessions, distance: round(categories.water_sports.distance), duration: Math.round(categories.water_sports.duration), calories: categories.water_sports.calories } : {},
        weeklyHistory: [],
        [period]: { sessions: categories.water_sports.sessions, distance: round(categories.water_sports.distance), duration: Math.round(categories.water_sports.duration), calories: categories.water_sports.calories },
      },
      tennis: {
        daily: {}, weekly: {}, monthly: {},
        weeklyHistory: [],
        [period]: { sessions: categories.tennis.sessions, duration: Math.round(categories.tennis.duration), calories: categories.tennis.calories },
      },
      gym: {
        daily: {}, weekly: {}, monthly: {},
        weeklyHistory: [],
        [period]: { sessions: categories.gym.sessions, duration: Math.round(categories.gym.duration), calories: categories.gym.calories, volume: categories.gym.volume },
      },
      others: Object.values(others).map((o) => ({
        name: o.name.charAt(0).toUpperCase() + o.name.slice(1).replace(/_/g, ' '),
        sessions: o.sessions,
        distance: round(o.distance) || undefined,
        duration: Math.round(o.duration) || undefined,
      })),
    },
  };
}

router.get('/', (req, res) => {
  const period = (req.query.period as string) || 'weekly';
  const { start, end } = getDateRange(period);

  const rows = db.prepare(
    `SELECT * FROM activities WHERE date(start_time) >= ? AND date(start_time) <= ? ORDER BY start_time DESC`
  ).all(start, end);

  const result = aggregateByCategory(rows, period);

  // Volume history (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

  const volumeRows = db.prepare(
    `SELECT * FROM activities WHERE date(start_time) >= ? ORDER BY start_time`
  ).all(sixMonthsAgoStr);

  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const volumeByMonth: Record<string, { water: number; tennis: number; gym: number }> = {};

  for (const row of volumeRows as any[]) {
    const d = new Date(row.start_time);
    const key = monthNames[d.getMonth()];
    if (!volumeByMonth[key]) volumeByMonth[key] = { water: 0, tennis: 0, gym: 0 };
    const dur = Math.round((row.duration ?? 0) / 60);
    if (row.category === 'water_sports') volumeByMonth[key].water += dur;
    else if (row.category === 'tennis') volumeByMonth[key].tennis += dur;
    else if (row.category === 'gym') volumeByMonth[key].gym += dur;
  }

  const volumeHistory = Object.entries(volumeByMonth).map(([month, data]) => ({ month, ...data }));

  // Chart data — per-session, last 6 months, grouped by category
  const allRows = volumeRows as any[];
  const chartData = {
    water_sports: allRows
      .filter((r) => r.category === 'water_sports')
      .map((r) => ({
        date: r.start_time.split('T')[0],
        distance: Math.round(((r.distance ?? 0) / 1000) * 10) / 10,
        maxSpeed: r.max_speed ? Math.round(r.max_speed * 3.6) : 0,
        duration: Math.round((r.duration ?? 0) / 60),
      })),
    tennis: allRows
      .filter((r) => r.category === 'tennis')
      .map((r) => ({
        date: r.start_time.split('T')[0],
        duration: Math.round((r.duration ?? 0) / 60),
        avgHr: r.avg_hr ?? 0,
        calories: r.calories ?? 0,
      })),
    gym: allRows
      .filter((r) => r.category === 'gym')
      .map((r) => ({
        date: r.start_time.split('T')[0],
        duration: Math.round((r.duration ?? 0) / 60),
        calories: r.calories ?? 0,
      })),
  };

  // Recent session
  const lastRow = rows[0] as any;
  const recentSession = lastRow ? {
    sport: (lastRow.sport_type ?? 'unknown').toUpperCase().replace(/_/g, ' '),
    location: '',
    distance: Math.round(((lastRow.distance ?? 0) / 1000) * 10) / 10,
    speed: lastRow.max_speed ? `${Math.round(lastRow.max_speed * 3.6)} KM/H` : 'N/A',
    hr: lastRow.avg_hr ?? 0,
    duration: Math.round((lastRow.duration ?? 0) / 60),
  } : null;

  // Training readiness (use body battery as proxy)
  const todaySummary = db.prepare(
    `SELECT body_battery FROM daily_summary WHERE date = ? LIMIT 1`
  ).get(end) as any;

  res.json({
    ...result,
    volumeHistory,
    chartData,
    recentSession,
    trainingReadiness: todaySummary?.body_battery ?? 94,
  });
});

router.get('/category/:category', (req, res) => {
  const { category } = req.params;
  const allowed = ['water_sports', 'tennis', 'gym'];
  if (!allowed.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  const rows = db.prepare(
    `SELECT * FROM activities WHERE category = ? ORDER BY start_time DESC`
  ).all(category) as any[];

  const activities = rows.map((r) => ({
    id: r.garmin_id,
    date: r.start_time.split('T')[0],
    sportType: r.sport_type,
    duration: Math.round((r.duration ?? 0) / 60),
    distance: Math.round(((r.distance ?? 0) / 1000) * 10) / 10,
    maxSpeed: r.max_speed ? Math.round(r.max_speed * 3.6) : null,
    avgHr: r.avg_hr ?? null,
    calories: r.calories ?? null,
  }));

  const totalSessions = activities.length;
  const totalDuration = activities.reduce((s, a) => s + a.duration, 0);
  const totalCalories = activities.reduce((s, a) => s + (a.calories ?? 0), 0);
  const totalDistance = Math.round(activities.reduce((s, a) => s + a.distance, 0) * 10) / 10;
  const avgDuration = totalSessions ? Math.round(totalDuration / totalSessions) : 0;
  const hrActivities = activities.filter((a) => a.avgHr);
  const avgHr = hrActivities.length
    ? Math.round(hrActivities.reduce((s, a) => s + (a.avgHr ?? 0), 0) / hrActivities.length)
    : null;

  const longestSession = activities.reduce<typeof activities[0] | null>(
    (best, a) => a.duration > (best?.duration ?? 0) ? a : best, null
  );
  const longestDistance = category === 'water_sports'
    ? activities.reduce<typeof activities[0] | null>(
        (best, a) => a.distance > (best?.distance ?? 0) ? a : best, null
      )
    : null;
  const highestSpeed = category === 'water_sports'
    ? activities.reduce<typeof activities[0] | null>(
        (best, a) => (a.maxSpeed ?? 0) > (best?.maxSpeed ?? 0) ? a : best, null
      )
    : null;
  const mostCalories = activities.reduce<typeof activities[0] | null>(
    (best, a) => (a.calories ?? 0) > (best?.calories ?? 0) ? a : best, null
  );

  res.json({
    activities,
    stats: {
      totalSessions,
      totalDistance: category === 'water_sports' ? totalDistance : undefined,
      totalDuration,
      totalCalories,
      avgDuration,
      avgHr: category !== 'water_sports' ? avgHr : undefined,
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
