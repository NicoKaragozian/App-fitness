import { Router } from 'express';
import db from '../db.js';

const router = Router();

const DAY_NAMES = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

router.get('/sleep', (req, res) => {
  const period = (req.query.period as string) || 'weekly';

  // 'daily' → return only the most recent entry (for the dashboard)
  if (period === 'daily') {
    const row = db.prepare(
      `SELECT s.*, h.nightly_avg FROM sleep s LEFT JOIN hrv h ON s.date = h.date WHERE s.score IS NOT NULL ORDER BY s.date DESC LIMIT 1`
    ).get() as any;
    if (!row) { res.json([]); return; }
    res.json([{
      day: 'HOY',
      hours: row.duration_seconds ? Math.round((row.duration_seconds / 3600) * 10) / 10 : 0,
      score: row.score ?? 0,
      hrv: row.nightly_avg ? Math.round(row.nightly_avg) : 0,
    }]);
    return;
  }

  const limit = period === 'weekly' ? 7 : 49;

  const rows = db.prepare(
    `SELECT * FROM sleep WHERE score IS NOT NULL ORDER BY date DESC LIMIT ?`
  ).all(limit) as any[];

  const data = rows.reverse().map((r) => {
    const d = new Date(r.date + 'T00:00:00');
    return {
      day: period === 'weekly' ? DAY_NAMES[d.getDay()] : d.getDate(),
      date: r.date,
      hours: r.duration_seconds ? Math.round((r.duration_seconds / 3600) * 10) / 10 : 0,
      score: r.score ?? 0,
      hrv: 0,
    };
  });

  // Enrich with HRV data
  const hrvRows = db.prepare(
    `SELECT date, nightly_avg FROM hrv ORDER BY date DESC LIMIT ?`
  ).all(limit) as any[];

  const hrvMap = new Map(hrvRows.map((r) => [r.date, r.nightly_avg]));

  for (let i = 0; i < rows.length && i < data.length; i++) {
    const hrv = hrvMap.get(rows[i]?.date);
    if (hrv) data[i].hrv = Math.round(hrv);
  }

  res.json(data);
});

router.get('/stress', (req, res) => {
  const period = (req.query.period as string) || 'weekly';

  // Helper to extract distribution and momentum from rows
  const getMetrics = (dataRows: any[]) => {
    let rest = 0, low = 0, medium = 0, high = 0;
    let peakDay = '', minDay = '';
    let peakStress = -1, minStress = 999;

    for (const r of dataRows) {
      if (r.avg_stress != null) {
        if (r.avg_stress > peakStress) { peakStress = r.avg_stress; peakDay = r.date; }
        if (r.avg_stress < minStress && r.avg_stress > 0) { minStress = r.avg_stress; minDay = r.date; }
      }
      try {
        if (r.raw_json) {
          const parsed = JSON.parse(r.raw_json);
          rest += parsed.restStressDuration ?? 0;
          low += parsed.lowStressDuration ?? 0;
          medium += parsed.mediumStressDuration ?? 0;
          high += parsed.highStressDuration ?? 0;
        }
      } catch (e) {}
    }

    const total = rest + low + medium + high;
    const distribution = total > 0 ? {
      rest: Math.round((rest / total) * 100),
      low: Math.round((low / total) * 100),
      medium: Math.round((medium / total) * 100),
      high: Math.round((high / total) * 100),
    } : { rest: 35, low: 40, medium: 20, high: 5 }; // default fallbacks if no data

    const formatDay = (dString: string) => {
      if (!dString) return '';
      const d = new Date(dString + 'T00:00:00');
      return DAY_NAMES[d.getDay()];
    };

    return {
      distribution,
      momentum: {
        peakDay: formatDay(peakDay),
        peakStress: peakStress === -1 ? 0 : peakStress,
        minDay: formatDay(minDay),
        minStress: minStress === 999 ? 0 : minStress
      }
    };
  };

  if (period === 'weekly') {
    const rows = db.prepare(
      `SELECT * FROM stress ORDER BY date DESC LIMIT 7`
    ).all() as any[];

    const metrics = getMetrics(rows);
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

    res.json({ data, weeklyAvg: avg, monthlyAvg, ...metrics });
  } else {
    // Monthly
    const rows = db.prepare(
      `SELECT * FROM stress ORDER BY date DESC LIMIT 30`
    ).all() as any[];

    const metrics = getMetrics(rows);
    const weeks: Record<string, number[]> = {};
    rows.forEach((r, i) => {
      const weekKey = `S${Math.floor(i / 7) + 1}`;
      if (!weeks[weekKey]) weeks[weekKey] = [];
      weeks[weekKey].push(r.avg_stress ?? 0);
    });

    const data = Object.entries(weeks).map(([week, values]) => ({
      week,
      stress: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    })).reverse();

    const allValues = rows.map((r) => r.avg_stress ?? 0);
    const weeklyAvg = allValues.length >= 7
      ? Math.round(allValues.slice(0, 7).reduce((a, b) => a + b, 0) / 7)
      : 0;
    const monthlyAvg = allValues.length
      ? Math.round(allValues.reduce((a, b) => a + b, 0) / allValues.length)
      : 0;

    res.json({ data, weeklyAvg, monthlyAvg, ...metrics });
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

  const sleepRow = db.prepare(
    `SELECT score FROM sleep ORDER BY date DESC LIMIT 1`
  ).get() as any;

  const stressRow = db.prepare(
    `SELECT avg_stress FROM stress WHERE avg_stress IS NOT NULL ORDER BY date DESC LIMIT 1`
  ).get() as any;

  const hrvRow = db.prepare(
    `SELECT status, nightly_avg FROM hrv WHERE nightly_avg IS NOT NULL ORDER BY date DESC LIMIT 1`
  ).get() as any;

  // Composite Readiness Calculation
  const slpScore = sleepRow?.score ?? 0;
  const avgStress = stressRow?.avg_stress ?? 0;
  const stressInverse = avgStress > 0 ? (100 - avgStress) : 0;
  
  const hrvRaw = hrvRow?.nightly_avg ?? 0;
  let customHrvScore = 0;
  
  if (hrvRaw > 0) {
    const minBaseline = 38;
    const maxBaseline = 99;
    const lowestPossible = 20;

    if (hrvRaw <= lowestPossible) {
      customHrvScore = 10;
    } else if (hrvRaw <= minBaseline) {
      // Maps 20-38 into 10-45 score
      customHrvScore = Math.round(10 + ((hrvRaw - lowestPossible) / (minBaseline - lowestPossible)) * 35);
    } else if (hrvRaw >= maxBaseline) {
      customHrvScore = 100;
    } else {
      // Maps 38-99 into 45-100 score
      customHrvScore = Math.round(45 + ((hrvRaw - minBaseline) / (maxBaseline - minBaseline)) * 55);
    }
  }

  let compositeScore = 0;
  if (slpScore > 0 || avgStress > 0 || customHrvScore > 0) {
    const sleepWeight = slpScore > 0 ? 0.4 : 0;
    const stressWeight = avgStress > 0 ? 0.3 : 0;
    const hrvWeight = customHrvScore > 0 ? 0.3 : 0;
    
    const totalWeight = sleepWeight + stressWeight + hrvWeight;
    if (totalWeight > 0) {
      compositeScore = Math.round(
        ((slpScore * sleepWeight) + (stressInverse * stressWeight) + (customHrvScore * hrvWeight)) / totalWeight
      );
    }
  }

  // Dynamic Label
  let readinessTitle = 'HIGH STRAIN';
  if (compositeScore >= 85) readinessTitle = 'PRIME READINESS';
  else if (compositeScore >= 70) readinessTitle = 'OPTIMAL READINESS';
  else if (compositeScore >= 50) readinessTitle = 'MODERATE STRAIN';

  const payload = {
    steps: row?.steps ?? null,
    calories: row?.calories ?? null,
    bodyBattery: row?.body_battery ?? null,
    restingHR: row?.resting_hr ?? null,
    sleepScore: slpScore,
    readiness: {
      score: compositeScore,
      title: readinessTitle,
      breakdown: { sleep: slpScore, stressInverse, hrvScore: customHrvScore, hrvRaw: hrvRow?.nightly_avg ?? 0 }
    }
  };

  res.json(payload);
});

export default router;
