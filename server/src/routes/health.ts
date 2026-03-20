import { Router } from 'express';
import db from '../db.js';

const router = Router();

const DAY_NAMES = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

router.get('/sleep', (req, res) => {
  const period = (req.query.period as string) || 'weekly';
  const limit = period === 'weekly' ? 7 : 30;

  const rows = db.prepare(
    `SELECT * FROM sleep ORDER BY date DESC LIMIT ?`
  ).all(limit) as any[];

  const data = rows.reverse().map((r) => {
    const d = new Date(r.date + 'T00:00:00');
    return {
      day: period === 'weekly' ? DAY_NAMES[d.getDay()] : d.getDate(),
      hours: r.duration_seconds ? Math.round((r.duration_seconds / 3600) * 10) / 10 : 0,
      score: r.score ?? 0,
      hrv: 0, // Will be joined from hrv table
    };
  });

  // Enrich with HRV data
  const hrvRows = db.prepare(
    `SELECT date, nightly_avg FROM hrv ORDER BY date DESC LIMIT ?`
  ).all(limit) as any[];

  const hrvMap = new Map(hrvRows.map((r) => [r.date, r.nightly_avg]));

  for (let i = 0; i < rows.length && i < data.length; i++) {
    const hrv = hrvMap.get(rows[rows.length - 1 - i]?.date);
    if (hrv) data[i].hrv = Math.round(hrv);
  }

  res.json(data);
});

router.get('/stress', (req, res) => {
  const period = (req.query.period as string) || 'weekly';

  if (period === 'weekly') {
    const rows = db.prepare(
      `SELECT * FROM stress ORDER BY date DESC LIMIT 7`
    ).all() as any[];

    const data = rows.reverse().map((r) => {
      const d = new Date(r.date + 'T00:00:00');
      return {
        day: DAY_NAMES[d.getDay()],
        stress: r.avg_stress ?? 0,
        date: r.date,
      };
    });

    const avg = data.length ? Math.round(data.reduce((a, b) => a + b.stress, 0) / data.length) : 0;

    // Monthly avg
    const monthlyRows = db.prepare(
      `SELECT avg_stress FROM stress ORDER BY date DESC LIMIT 30`
    ).all() as any[];
    const monthlyAvg = monthlyRows.length
      ? Math.round(monthlyRows.reduce((a, b) => a + (b.avg_stress ?? 0), 0) / monthlyRows.length)
      : 0;

    res.json({ data, weeklyAvg: avg, monthlyAvg });
  } else {
    // Monthly: group by week
    const rows = db.prepare(
      `SELECT * FROM stress ORDER BY date DESC LIMIT 30`
    ).all() as any[];

    const weeks: Record<string, number[]> = {};
    rows.forEach((r, i) => {
      const weekKey = `S${Math.floor(i / 7) + 1}`;
      if (!weeks[weekKey]) weeks[weekKey] = [];
      weeks[weekKey].push(r.avg_stress ?? 0);
    });

    const data = Object.entries(weeks).map(([week, values]) => ({
      week,
      stress: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    }));

    const allValues = rows.map((r) => r.avg_stress ?? 0);
    const weeklyAvg = allValues.length >= 7
      ? Math.round(allValues.slice(0, 7).reduce((a, b) => a + b, 0) / 7)
      : 0;
    const monthlyAvg = allValues.length
      ? Math.round(allValues.reduce((a, b) => a + b, 0) / allValues.length)
      : 0;

    res.json({ data, weeklyAvg, monthlyAvg });
  }
});

router.get('/hrv', (req, res) => {
  const period = (req.query.period as string) || 'weekly';
  const limit = period === 'weekly' ? 7 : 30;

  const rows = db.prepare(
    `SELECT * FROM hrv ORDER BY date DESC LIMIT ?`
  ).all(limit) as any[];

  const latest = rows[0];
  const history = rows.reverse().map((r) => {
    const d = new Date(r.date + 'T00:00:00');
    return {
      day: period === 'weekly' ? DAY_NAMES[d.getDay()] : d.getDate(),
      hrv: Math.round(r.nightly_avg ?? 0),
    };
  });

  res.json({
    nightlyAvg: latest ? Math.round(latest.nightly_avg ?? 0) : 0,
    status: latest?.status ?? 'UNKNOWN',
    history,
  });
});

router.get('/summary', (_req, res) => {
  const row = db.prepare(
    `SELECT * FROM daily_summary ORDER BY date DESC LIMIT 1`
  ).get() as any;

  if (!row) {
    res.json({ steps: 0, calories: 0, bodyBattery: 0, restingHR: 0 });
    return;
  }

  res.json({
    steps: row.steps ?? 0,
    calories: row.calories ?? 0,
    bodyBattery: row.body_battery ?? 0,
    restingHR: row.resting_hr ?? 0,
  });
});

export default router;
