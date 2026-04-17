import cron from 'node-cron';
import db from './db/client.js';
import { activities, sleep, stress, hrv, daily_summary, sync_log } from './db/schema/index.js';
import { eq } from 'drizzle-orm';
import * as garmin from './garmin.js';

const SPORT_CATEGORY_MAP: Record<string, string> = {
  surfing: 'water_sports',
  kitesurfing: 'water_sports',
  kiteboarding: 'water_sports',
  windsurfing: 'water_sports',
  stand_up_paddleboarding: 'water_sports',
  sailing: 'water_sports',
  kayaking: 'water_sports',
  tennis: 'tennis',
  strength_training: 'gym',
  gym: 'gym',
  indoor_cardio: 'gym',
};

function categorize(sportType: string): string {
  const key = (sportType?.toLowerCase().replace(/\s+/g, '_') ?? '').replace(/_v\d+$/, '');
  return SPORT_CATEGORY_MAP[key] ?? 'others';
}

export let isSyncing = false;
export let lastSync: string | null = null;
let abortSync = false;

export function signalAbortSync() {
  abortSync = true;
}

async function syncActivities(startDate: Date, endDate: Date) {
  const activityList = await garmin.fetchActivities(startDate, endDate);

  for (const a of activityList) {
    const sportType = a.activityType?.typeKey ?? 'unknown';
    await db.insert(activities).values({
      garmin_id: String(a.activityId),
      sport_type: sportType,
      category: categorize(sportType),
      start_time: a.startTimeLocal ?? a.startTimeGMT ?? new Date().toISOString(),
      duration: a.duration ?? 0,
      distance: a.distance ?? 0,
      calories: a.calories ?? 0,
      avg_hr: a.averageHR ?? 0,
      max_speed: a.maxSpeed ?? 0,
      raw_json: JSON.stringify(a),
    }).onConflictDoUpdate({
      target: activities.garmin_id,
      set: {
        sport_type: sportType,
        category: categorize(sportType),
        start_time: a.startTimeLocal ?? a.startTimeGMT ?? new Date().toISOString(),
        duration: a.duration ?? 0,
        distance: a.distance ?? 0,
        calories: a.calories ?? 0,
        avg_hr: a.averageHR ?? 0,
        max_speed: a.maxSpeed ?? 0,
        raw_json: JSON.stringify(a),
      },
    });
  }
}

// Garmin's API has a systematic 1-day offset: querying date X returns data with calendarDate X-1.
function nextDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return garmin.formatDate(d);
}

async function syncDayData(dateStr: string) {
  const fetchDate = nextDay(dateStr);

  // Sleep
  const sleepData = await garmin.fetchSleep(fetchDate);
  if (sleepData) {
    const dto = sleepData.dailySleepDTO;
    const storeDate = (dto as any)?.calendarDate ?? dateStr;
    await db.insert(sleep).values({
      date: storeDate,
      score: (dto as any).sleepScores?.overall?.value ?? null,
      duration_seconds: dto.sleepTimeSeconds ?? null,
      deep_seconds: dto.deepSleepSeconds ?? null,
      light_seconds: dto.lightSleepSeconds ?? null,
      rem_seconds: dto.remSleepSeconds ?? null,
      awake_seconds: dto.awakeSleepSeconds ?? null,
      raw_json: JSON.stringify(sleepData),
    }).onConflictDoUpdate({
      target: sleep.date,
      set: {
        score: (dto as any).sleepScores?.overall?.value ?? null,
        duration_seconds: dto.sleepTimeSeconds ?? null,
        deep_seconds: dto.deepSleepSeconds ?? null,
        light_seconds: dto.lightSleepSeconds ?? null,
        rem_seconds: dto.remSleepSeconds ?? null,
        awake_seconds: dto.awakeSleepSeconds ?? null,
        raw_json: JSON.stringify(sleepData),
      },
    });
  }

  // Stress
  const stressData = await garmin.fetchStress(fetchDate);
  if (stressData) {
    await db.insert(stress).values({
      date: dateStr,
      avg_stress: stressData.overallStressLevel ?? stressData.avgStressLevel ?? stressData.averageStressLevel ?? null,
      max_stress: stressData.maxStressLevel ?? null,
      raw_json: JSON.stringify(stressData),
    }).onConflictDoUpdate({
      target: stress.date,
      set: {
        avg_stress: stressData.overallStressLevel ?? stressData.avgStressLevel ?? stressData.averageStressLevel ?? null,
        max_stress: stressData.maxStressLevel ?? null,
        raw_json: JSON.stringify(stressData),
      },
    });
  }

  // HRV
  const hrvData = await garmin.fetchHRV(fetchDate);
  if (hrvData) {
    await db.insert(hrv).values({
      date: dateStr,
      nightly_avg: hrvData.hrvSummary?.lastNightAvg ?? null,
      status: hrvData.hrvSummary?.status ?? null,
      raw_json: JSON.stringify(hrvData),
    }).onConflictDoUpdate({
      target: hrv.date,
      set: {
        nightly_avg: hrvData.hrvSummary?.lastNightAvg ?? null,
        status: hrvData.hrvSummary?.status ?? null,
        raw_json: JSON.stringify(hrvData),
      },
    });
  }

  // Daily Summary
  const summary = await garmin.fetchDailySummary(fetchDate);
  if (summary) {
    await db.insert(daily_summary).values({
      date: dateStr,
      steps: summary.totalSteps ?? summary.steps ?? null,
      calories: summary.totalKilocalories ?? summary.calories ?? null,
      body_battery: summary.bodyBatteryMostRecentValue ?? summary.bodyBattery ?? null,
      resting_hr: summary.restingHeartRate ?? summary.restingHR ?? null,
      raw_json: JSON.stringify(summary),
    }).onConflictDoUpdate({
      target: daily_summary.date,
      set: {
        steps: summary.totalSteps ?? summary.steps ?? null,
        calories: summary.totalKilocalories ?? summary.calories ?? null,
        body_battery: summary.bodyBatteryMostRecentValue ?? summary.bodyBattery ?? null,
        resting_hr: summary.restingHeartRate ?? summary.restingHR ?? null,
        raw_json: JSON.stringify(summary),
      },
    });
  }
}

export async function syncActivitiesOnly() {
  if (!garmin.getStatus()) throw new Error('Not logged in');
  const allTimeStart = new Date(0);
  const endDate = new Date();
  await syncActivities(allTimeStart, endDate);
}

export async function syncInitial() {
  if (isSyncing) return;
  isSyncing = true;
  abortSync = false;

  const [log] = await db.insert(sync_log).values({
    sync_type: 'initial',
    started_at: new Date().toISOString(),
  }).returning({ id: sync_log.id });
  const logId = log.id;

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const allTimeStart = new Date(0);
    await syncActivities(allTimeStart, endDate);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      if (abortSync) {
        console.log('[sync] Sync aborted by logout');
        break;
      }
      const dateStr = garmin.formatDate(d);
      await syncDayData(dateStr);
    }

    lastSync = new Date().toISOString();
    await db.update(sync_log)
      .set({ completed_at: new Date().toISOString(), status: 'completed' })
      .where(eq(sync_log.id, logId));
    console.log('[sync] Initial sync completed');
  } catch (err) {
    console.error('[sync] Initial sync error:', err);
    await db.update(sync_log)
      .set({ completed_at: new Date().toISOString(), status: 'failed' })
      .where(eq(sync_log.id, logId));
  } finally {
    isSyncing = false;
  }
}

async function syncToday() {
  if (isSyncing || !garmin.getStatus()) return;
  isSyncing = true;

  try {
    const today = garmin.formatDate(new Date());
    const endDate = new Date();
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    await syncActivities(startDate, endDate);
    await syncDayData(today);
    lastSync = new Date().toISOString();
  } catch (err) {
    console.error('[sync] Periodic sync error:', err);
  } finally {
    isSyncing = false;
  }
}

export function startPeriodicSync() {
  cron.schedule('*/15 * * * *', () => {
    console.log('[sync] Running periodic sync...');
    syncToday();
  });
  console.log('[sync] Periodic sync scheduled (every 15 min)');
}
