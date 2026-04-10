import { Router } from 'express';
import db from '../db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { hkActivityToSportType, hkActivityToCategory, aggregateSleepByNight } from '../healthkit-mapper.js';

const router = Router();

interface HKWorkout {
  uuid: string;
  startDate: string;
  endDate: string;
  duration: number;           // horas
  workoutActivityId: number;
  workoutActivityName: string;
  totalEnergyBurned: number;  // kcal
  totalDistance: number;      // metros
}

interface HKSleep {
  uuid: string;
  startDate: string;
  endDate: string;
  duration: number;           // horas
  sleepState: 'InBed' | 'Asleep';
}

interface HKQuantity {
  uuid: string;
  startDate: string;
  endDate: string;
  duration: number;           // horas
  value: number;
  unitName: string;
}

interface SyncBody {
  workouts: HKWorkout[];
  sleep: HKSleep[];
  restingHR: HKQuantity[];
  steps: HKQuantity[];
}

/**
 * POST /api/healthkit/sync
 * Recibe datos de HealthKit y los persiste en la DB.
 */
router.post('/sync', requireAuth, (req: AuthRequest, res) => {
  const { workouts = [], sleep = [], restingHR = [], steps = [] } = req.body as SyncBody;

  let activitiesInserted = 0;
  let sleepInserted = 0;
  let summaryInserted = 0;

  // ─── Actividades ─────────────────────────────────────────────────────────────
  const insertActivity = db.prepare(`
    INSERT INTO activities (garmin_id, sport_type, category, start_time, duration, distance, calories, avg_hr, max_speed, source, raw_json)
    VALUES (@garminId, @sportType, @category, @startTime, @duration, @distance, @calories, @avgHr, @maxSpeed, @source, @rawJson)
    ON CONFLICT(garmin_id) DO NOTHING
  `);

  for (const w of workouts) {
    if (!w.uuid || !w.startDate) continue;
    const sportType = hkActivityToSportType(w.workoutActivityId);
    const category = hkActivityToCategory(w.workoutActivityId);
    const durationMin = Math.round(w.duration * 60);          // horas → minutos
    const distanceKm = w.totalDistance > 0 ? +(w.totalDistance / 1000).toFixed(3) : 0;

    try {
      const info = insertActivity.run({
        garminId: `hk_${w.uuid}`,
        sportType,
        category,
        startTime: w.startDate,
        duration: durationMin,
        distance: distanceKm,
        calories: w.totalEnergyBurned > 0 ? Math.round(w.totalEnergyBurned) : null,
        avgHr: null,   // HealthKit no devuelve avg_hr en workouts (necesitaría query separada)
        maxSpeed: null,
        source: 'healthkit',
        rawJson: JSON.stringify(w),
      });
      if (info.changes > 0) activitiesInserted++;
    } catch (e) {
      console.error('[HealthKit] activity insert error:', e);
    }
  }

  // ─── Sleep ───────────────────────────────────────────────────────────────────
  const dailySleepData = aggregateSleepByNight(sleep);
  const insertSleep = db.prepare(`
    INSERT INTO sleep (date, score, duration_seconds, deep_seconds, light_seconds, rem_seconds, awake_seconds, source)
    VALUES (@date, @score, @durationSeconds, @deepSeconds, @lightSeconds, @remSeconds, @awakeSeconds, @source)
    ON CONFLICT(date) DO UPDATE SET
      score = excluded.score,
      duration_seconds = excluded.duration_seconds,
      source = excluded.source
    WHERE source = 'healthkit' OR source IS NULL
  `);

  for (const s of dailySleepData) {
    if (s.durationSeconds < 60) continue;  // ignorar samples < 1 minuto
    try {
      const info = insertSleep.run({
        date: s.date,
        score: s.score,
        durationSeconds: s.durationSeconds,
        deepSeconds: null,     // HealthKit solo tiene InBed/Asleep, sin etapas
        lightSeconds: null,
        remSeconds: null,
        awakeSeconds: Math.max(0, s.inBedSeconds - s.asleepSeconds),
        source: 'healthkit',
      });
      if (info.changes > 0) sleepInserted++;
    } catch (e) {
      console.error('[HealthKit] sleep insert error:', e);
    }
  }

  // ─── Daily Summary (steps + resting HR) ──────────────────────────────────────
  // Agrupar pasos por día
  const stepsByDay: Record<string, number> = {};
  for (const s of steps) {
    const date = s.startDate.slice(0, 10);
    stepsByDay[date] = (stepsByDay[date] ?? 0) + Math.round(s.value);
  }

  // Resting HR: tomar el más reciente de cada día
  const hrByDay: Record<string, number> = {};
  for (const h of restingHR) {
    const date = h.startDate.slice(0, 10);
    hrByDay[date] = Math.round(h.value);  // el más reciente gana (asumimos orden cronológico)
  }

  const allDays = new Set([...Object.keys(stepsByDay), ...Object.keys(hrByDay)]);
  const insertSummary = db.prepare(`
    INSERT INTO daily_summary (date, steps, resting_hr, calories, body_battery, source)
    VALUES (@date, @steps, @restingHr, @calories, @bodyBattery, @source)
    ON CONFLICT(date) DO UPDATE SET
      steps = COALESCE(excluded.steps, steps),
      resting_hr = COALESCE(excluded.resting_hr, resting_hr),
      source = excluded.source
  `);

  for (const date of allDays) {
    try {
      const info = insertSummary.run({
        date,
        steps: stepsByDay[date] ?? null,
        restingHr: hrByDay[date] ?? null,
        calories: null,
        bodyBattery: null,
        source: 'healthkit',
      });
      if (info.changes > 0) summaryInserted++;
    } catch (e) {
      console.error('[HealthKit] summary insert error:', e);
    }
  }

  res.json({
    ok: true,
    inserted: {
      activities: activitiesInserted,
      sleep: sleepInserted,
      dailySummary: summaryInserted,
    },
  });
});

export default router;
