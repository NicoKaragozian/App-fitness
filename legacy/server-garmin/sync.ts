import cron from 'node-cron';
import db from './db.js';
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
  const activities = await garmin.fetchActivities(startDate, endDate);
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO activities (garmin_id, sport_type, category, start_time, duration, distance, calories, avg_hr, max_speed, raw_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const a of activities) {
    const sportType = a.activityType?.typeKey ?? 'unknown';
    stmt.run(
      String(a.activityId),
      sportType,
      categorize(sportType),
      a.startTimeLocal ?? a.startTimeGMT ?? new Date().toISOString(),
      a.duration ?? 0,
      a.distance ?? 0,
      a.calories ?? 0,
      a.averageHR ?? 0,
      a.maxSpeed ?? 0,
      JSON.stringify(a)
    );
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

  const sleepData = await garmin.fetchSleep(fetchDate);
  if (sleepData) {
    const dto = sleepData.dailySleepDTO;
    const storeDate = (dto as any)?.calendarDate ?? dateStr;
    db.prepare(`
      INSERT OR REPLACE INTO sleep (date, score, duration_seconds, deep_seconds, light_seconds, rem_seconds, awake_seconds, raw_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      storeDate,
      (dto as any).sleepScores?.overall?.value ?? null,
      dto.sleepTimeSeconds ?? null,
      dto.deepSleepSeconds ?? null,
      dto.lightSleepSeconds ?? null,
      dto.remSleepSeconds ?? null,
      dto.awakeSleepSeconds ?? null,
      JSON.stringify(sleepData)
    );
  }

  const stressData = await garmin.fetchStress(fetchDate);
  if (stressData) {
    db.prepare(`
      INSERT OR REPLACE INTO stress (date, avg_stress, max_stress, raw_json)
      VALUES (?, ?, ?, ?)
    `).run(
      dateStr,
      stressData.overallStressLevel ?? stressData.avgStressLevel ?? stressData.averageStressLevel ?? null,
      stressData.maxStressLevel ?? null,
      JSON.stringify(stressData)
    );
  }

  const hrvData = await garmin.fetchHRV(fetchDate);
  if (hrvData) {
    db.prepare(`
      INSERT OR REPLACE INTO hrv (date, nightly_avg, status, raw_json)
      VALUES (?, ?, ?, ?)
    `).run(
      dateStr,
      hrvData.hrvSummary?.lastNightAvg ?? null,
      hrvData.hrvSummary?.status ?? null,
      JSON.stringify(hrvData)
    );
  }

  const summary = await garmin.fetchDailySummary(fetchDate);
  if (summary) {
    db.prepare(`
      INSERT OR REPLACE INTO daily_summary (date, steps, calories, body_battery, resting_hr, raw_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      dateStr,
      summary.totalSteps ?? summary.steps ?? null,
      summary.totalKilocalories ?? summary.calories ?? null,
      summary.bodyBatteryMostRecentValue ?? summary.bodyBattery ?? null,
      summary.restingHeartRate ?? summary.restingHR ?? null,
      JSON.stringify(summary)
    );
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

  const logId = db.prepare(
    `INSERT INTO sync_log (sync_type, started_at) VALUES ('initial', datetime('now'))`
  ).run().lastInsertRowid;

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
    db.prepare(
      `UPDATE sync_log SET completed_at = datetime('now'), status = 'completed' WHERE id = ?`
    ).run(logId);
    console.log('[sync] Initial sync completed');
  } catch (err) {
    console.error('[sync] Initial sync error:', err);
    db.prepare(
      `UPDATE sync_log SET completed_at = datetime('now'), status = 'failed' WHERE id = ?`
    ).run(logId);
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
