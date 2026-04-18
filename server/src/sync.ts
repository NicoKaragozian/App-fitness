import cron from 'node-cron';
import { eq, and, sql } from 'drizzle-orm';
import db from './db/client.js';
import { activities, sleep, stress, hrv, daily_summary, sync_log } from './db/schema/index.js';
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

// Track per-user sync state
const syncingUsers = new Set<string>();
const lastSyncByUser = new Map<string, string>();

export function isSyncingForUser(userId: string): boolean {
  return syncingUsers.has(userId);
}

export function getLastSyncForUser(userId: string): string | null {
  return lastSyncByUser.get(userId) ?? null;
}

// Kept for backwards compat with status endpoint (reports first user or null)
export let isSyncing = false;
export let lastSync: string | null = null;
let abortSync = false;

export function signalAbortSync() {
  abortSync = true;
}

// ── Private helpers ────────────────────────────────────────────────────────────

async function syncActivities(client: any, userId: string, startDate: Date, endDate: Date) {
  const activityList = await garmin.fetchActivities(client, startDate, endDate);

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
      user_id: userId,
    }).onConflictDoUpdate({
      // composite unique (user_id, garmin_id) — added in migration 2
      target: [activities.user_id, activities.garmin_id],
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

function nextDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return garmin.formatDate(d);
}

async function syncDayData(client: any, userId: string, dateStr: string) {
  const fetchDate = nextDay(dateStr);

  const sleepData = await garmin.fetchSleep(client, fetchDate);
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
      user_id: userId,
    }).onConflictDoUpdate({
      target: [sleep.user_id, sleep.date],
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

  const stressData = await garmin.fetchStress(client, fetchDate);
  if (stressData) {
    await db.insert(stress).values({
      date: dateStr,
      avg_stress: stressData.overallStressLevel ?? stressData.avgStressLevel ?? stressData.averageStressLevel ?? null,
      max_stress: stressData.maxStressLevel ?? null,
      raw_json: JSON.stringify(stressData),
      user_id: userId,
    }).onConflictDoUpdate({
      target: [stress.user_id, stress.date],
      set: {
        avg_stress: stressData.overallStressLevel ?? stressData.avgStressLevel ?? stressData.averageStressLevel ?? null,
        max_stress: stressData.maxStressLevel ?? null,
        raw_json: JSON.stringify(stressData),
      },
    });
  }

  const hrvData = await garmin.fetchHRV(client, fetchDate);
  if (hrvData) {
    await db.insert(hrv).values({
      date: dateStr,
      nightly_avg: hrvData.hrvSummary?.lastNightAvg ?? null,
      status: hrvData.hrvSummary?.status ?? null,
      raw_json: JSON.stringify(hrvData),
      user_id: userId,
    }).onConflictDoUpdate({
      target: [hrv.user_id, hrv.date],
      set: {
        nightly_avg: hrvData.hrvSummary?.lastNightAvg ?? null,
        status: hrvData.hrvSummary?.status ?? null,
        raw_json: JSON.stringify(hrvData),
      },
    });
  }

  const summary = await garmin.fetchDailySummary(client, fetchDate);
  if (summary) {
    await db.insert(daily_summary).values({
      date: dateStr,
      steps: summary.totalSteps ?? summary.steps ?? null,
      calories: summary.totalKilocalories ?? summary.calories ?? null,
      body_battery: summary.bodyBatteryMostRecentValue ?? summary.bodyBattery ?? null,
      resting_hr: summary.restingHeartRate ?? summary.restingHR ?? null,
      raw_json: JSON.stringify(summary),
      user_id: userId,
    }).onConflictDoUpdate({
      target: [daily_summary.user_id, daily_summary.date],
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

// ── Public API ─────────────────────────────────────────────────────────────────

export async function syncInitial(userId: string): Promise<void> {
  if (syncingUsers.has(userId)) return;
  syncingUsers.add(userId);
  abortSync = false;
  isSyncing = true;

  const client = await garmin.getGarminClient(userId);
  if (!client) {
    console.warn(`[sync] No Garmin tokens found for user ${userId}`);
    syncingUsers.delete(userId);
    isSyncing = syncingUsers.size > 0;
    return;
  }

  const [log] = await db.insert(sync_log).values({
    sync_type: 'initial',
    started_at: new Date().toISOString(),
    user_id: userId,
  }).returning({ id: sync_log.id });
  const logId = log.id;

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const allTimeStart = new Date(0);

    await syncActivities(client, userId, allTimeStart, endDate);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      if (abortSync) break;
      const dateStr = garmin.formatDate(d);
      await syncDayData(client, userId, dateStr);
    }

    const now = new Date().toISOString();
    lastSyncByUser.set(userId, now);
    lastSync = now;
    await db.update(sync_log)
      .set({ completed_at: now, status: 'completed' })
      .where(eq(sync_log.id, logId));
    console.log(`[sync] Initial sync completed for user ${userId}`);
  } catch (err) {
    console.error(`[sync] Initial sync error for user ${userId}:`, err);
    await db.update(sync_log)
      .set({ completed_at: new Date().toISOString(), status: 'failed' })
      .where(eq(sync_log.id, logId));
  } finally {
    syncingUsers.delete(userId);
    isSyncing = syncingUsers.size > 0;
  }
}

async function syncTodayForUser(userId: string): Promise<void> {
  if (syncingUsers.has(userId)) return;

  const client = await garmin.getGarminClient(userId);
  if (!client) return;

  syncingUsers.add(userId);
  isSyncing = true;

  try {
    const today = garmin.formatDate(new Date());
    const endDate = new Date();
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    await syncActivities(client, userId, startDate, endDate);
    await syncDayData(client, userId, today);

    const now = new Date().toISOString();
    lastSyncByUser.set(userId, now);
    lastSync = now;
  } catch (err) {
    console.error(`[sync] Periodic sync error for user ${userId}:`, err);
  } finally {
    syncingUsers.delete(userId);
    isSyncing = syncingUsers.size > 0;
  }
}

export function startPeriodicSync(): void {
  cron.schedule('*/15 * * * *', async () => {
    console.log('[sync] Running periodic sync for all Garmin users...');
    const userIds = await garmin.getAllUsersWithTokens();
    for (const userId of userIds) {
      // Sequential to respect Garmin rate limits
      await syncTodayForUser(userId);
    }
  });
  console.log('[sync] Periodic sync scheduled (every 15 min)');
}
