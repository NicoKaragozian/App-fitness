import { Router } from 'express';
import { desc, sql, eq, and } from 'drizzle-orm';
import db from '../db/client.js';
import { sleep, hrv, stress, daily_summary } from '../db/schema/index.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.use(requireUser);

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

router.get('/sleep', async (req, res) => {
  const { userId } = req;
  const period = (req.query.period as string) || 'weekly';

  if (period === 'daily') {
    const rows = await db.select({
      date: sleep.date,
      score: sleep.score,
      duration_seconds: sleep.duration_seconds,
      nightly_avg: hrv.nightly_avg,
    })
      .from(sleep)
      .leftJoin(hrv, and(sql`${sleep.date} = ${hrv.date}`, eq(hrv.user_id, userId)))
      .where(and(eq(sleep.user_id, userId), sql`${sleep.score} IS NOT NULL`))
      .orderBy(desc(sleep.date))
      .limit(1);

    if (!rows.length) { res.json([]); return; }
    const row = rows[0];
    res.json([{
      day: 'TODAY',
      hours: row.duration_seconds ? Math.round((row.duration_seconds / 3600) * 10) / 10 : 0,
      score: row.score ?? 0,
      hrv: row.nightly_avg ? Math.round(row.nightly_avg) : 0,
    }]);
    return;
  }

  const limit = period === 'weekly' ? 7 : 49;
  const sleepRows = await db.select().from(sleep)
    .where(and(eq(sleep.user_id, userId), sql`${sleep.score} IS NOT NULL`))
    .orderBy(desc(sleep.date))
    .limit(limit);

  const data = sleepRows.reverse().map((r) => {
    const d = new Date(r.date + 'T00:00:00');
    return {
      day: period === 'weekly' ? DAY_NAMES[d.getDay()] : d.getDate(),
      date: r.date,
      hours: r.duration_seconds ? Math.round((r.duration_seconds / 3600) * 10) / 10 : 0,
      score: r.score ?? 0,
      hrv: 0,
    };
  });

  const hrvRows = await db.select({ date: hrv.date, nightly_avg: hrv.nightly_avg })
    .from(hrv).where(eq(hrv.user_id, userId)).orderBy(desc(hrv.date)).limit(limit);

  const hrvMap = new Map(hrvRows.map((r) => [r.date, r.nightly_avg]));
  for (let i = 0; i < sleepRows.length && i < data.length; i++) {
    const h = hrvMap.get(sleepRows[i]?.date);
    if (h) data[i].hrv = Math.round(h);
  }

  res.json(data);
});

router.get('/stress', async (req, res) => {
  const { userId } = req;
  const period = (req.query.period as string) || 'weekly';

  const getMetrics = (dataRows: (typeof stress.$inferSelect)[]) => {
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
    } : { rest: 35, low: 40, medium: 20, high: 5 };

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
        minStress: minStress === 999 ? 0 : minStress,
      },
    };
  };

  if (period === 'weekly') {
    const rows = await db.select().from(stress)
      .where(eq(stress.user_id, userId)).orderBy(desc(stress.date)).limit(7);
    const metrics = getMetrics(rows);
    const data = rows.reverse().map((r) => {
      const d = new Date(r.date + 'T00:00:00');
      return { day: DAY_NAMES[d.getDay()], stress: r.avg_stress ?? 0, date: r.date };
    });
    const avg = data.length ? Math.round(data.reduce((a, b) => a + b.stress, 0) / data.length) : 0;

    const monthlyRows = await db.select({ avg_stress: stress.avg_stress })
      .from(stress).where(eq(stress.user_id, userId)).orderBy(desc(stress.date)).limit(30);
    const monthlyAvg = monthlyRows.length
      ? Math.round(monthlyRows.reduce((a, b) => a + (b.avg_stress ?? 0), 0) / monthlyRows.length)
      : 0;

    res.json({ data, weeklyAvg: avg, monthlyAvg, ...metrics });
  } else {
    const rows = await db.select().from(stress)
      .where(eq(stress.user_id, userId)).orderBy(desc(stress.date)).limit(30);
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

router.get('/hrv', async (req, res) => {
  const { userId } = req;
  const period = (req.query.period as string) || 'weekly';
  const limit = period === 'weekly' ? 7 : 30;

  const rows = await db.select().from(hrv)
    .where(eq(hrv.user_id, userId)).orderBy(desc(hrv.date)).limit(limit);
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

router.get('/summary', async (req, res) => {
  const { userId } = req;
  const [row] = await db.select().from(daily_summary)
    .where(eq(daily_summary.user_id, userId)).orderBy(desc(daily_summary.date)).limit(1);
  const [sleepRow] = await db.select({ score: sleep.score })
    .from(sleep).where(and(eq(sleep.user_id, userId), sql`${sleep.score} IS NOT NULL`))
    .orderBy(desc(sleep.date)).limit(1);
  const [stressRow] = await db.select({ avg_stress: stress.avg_stress })
    .from(stress).where(and(eq(stress.user_id, userId), sql`${stress.avg_stress} IS NOT NULL`))
    .orderBy(desc(stress.date)).limit(1);
  const [hrvRow] = await db.select({ status: hrv.status, nightly_avg: hrv.nightly_avg })
    .from(hrv).where(and(eq(hrv.user_id, userId), sql`${hrv.nightly_avg} IS NOT NULL`))
    .orderBy(desc(hrv.date)).limit(1);

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
      customHrvScore = Math.round(10 + ((hrvRaw - lowestPossible) / (minBaseline - lowestPossible)) * 35);
    } else if (hrvRaw >= maxBaseline) {
      customHrvScore = 100;
    } else {
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

  let readinessTitle = 'HIGH STRAIN';
  if (compositeScore >= 85) readinessTitle = 'PRIME READINESS';
  else if (compositeScore >= 70) readinessTitle = 'OPTIMAL READINESS';
  else if (compositeScore >= 50) readinessTitle = 'MODERATE STRAIN';

  res.json({
    steps: row?.steps ?? null,
    calories: row?.calories ?? null,
    bodyBattery: row?.body_battery ?? null,
    restingHR: row?.resting_hr ?? null,
    sleepScore: slpScore,
    readiness: {
      score: compositeScore,
      title: readinessTitle,
      breakdown: { sleep: slpScore, stressInverse, hrvScore: customHrvScore, hrvRaw: hrvRow?.nightly_avg ?? 0 },
    },
  });
});

export default router;
